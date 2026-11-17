/**
 * Epic Cash Monthly Webinar: sign-up and invite sender (Google Apps Script).
 *
 * What it does: the webinar page sends it an email address. It saves the address in this
 * Google Sheet and emails that person a calendar invite for the next 12 monthly sessions.
 * The invite is a standard calendar file (.ics), so it opens in Outlook, Yahoo, Apple,
 * Gmail and any other calendar.
 *
 * Emails are sent by the Google account that publishes ("deploys") this script. They show
 * CONFIG.SEND_FROM as the sender once that address is set up in that account's Gmail under
 * Settings > Accounts > "Send mail as". Until then they show the Google account's own address.
 */

/* ---------- Settings: the only lines to edit ---------- */
const CONFIG = {
  SENDER_NAME: 'Epic Cash Monthly Webinar', // name subscribers see as the sender
  SEND_FROM: 'info@epiccashnetwork.com', // address subscribers see as the sender; must be a Gmail "Send mail as" address of the sending account
  REPLY_TO: '',        // address replies should go to; empty = the sender address
  PAGE_URL: '',        // public address of the webinar page, once it is live; empty = not mentioned
  JOIN_URL: '',        // link to the live session; empty = "the join link is on the webinar page"
  SESSIONS: 12,        // how many monthly sessions the invite covers
  DURATION_MIN: 60,    // session length in minutes
  DAILY_CAP: 300,      // most invite emails per day (Google allows about 1,500 on Workspace, 100 on free Gmail)
  RESEND_HOURS: 24,    // the same address cannot be sent another invite within this many hours
  SHEET_NAME: 'Subscribers',
};
/* ------------------------------------------------------ */

const TZ = 'America/New_York';
const TITLE = 'Epic Cash Monthly Webinar';
const START_HOUR = 10; // 10 = 10:00 AM New York time (24-hour clock). Keep the same as START_HOUR in index.html
const HOSTS = 'Romain Daniellou and Jose Enrique Castellón, with Max Freeman, founder of Epic Cash, as guest';

/** The webinar page calls this with { "email": "..." }. */
function doPost(e) {
  let out;
  try {
    out = handle_(e);
  } catch (err) {
    console.error(err);
    out = { ok: false, error: 'server' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Opening the web address in a browser shows this, to confirm the script is live. */
function doGet() {
  return ContentService.createTextOutput('Epic Cash webinar sign-up service is running.');
}

function handle_(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return { ok: false, error: 'email' }; }
  if (body.website) return { ok: true }; // hidden field filled in = a bot; pretend success, do nothing

  const email = String(body.email || '').trim().toLowerCase();
  if (!isValidEmail_(email)) return { ok: false, error: 'email' };

  const lock = LockService.getScriptLock(); // one sign-up at a time, so nothing is counted or saved twice
  lock.waitLock(20000);
  try {
    const sheet = getSheet_();
    const now = new Date();
    const props = PropertiesService.getScriptProperties();
    const dayKey = 'sent_' + Utilities.formatDate(now, 'UTC', 'yyyyMMdd');
    const sentToday = Number(props.getProperty(dayKey) || 0);

    // Is this address already on the list?
    let row = 0, lastSent = null;
    const last = sheet.getLastRow();
    if (last > 1) {
      const values = sheet.getRange(2, 1, last - 1, 3).getValues();
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][0]).toLowerCase() === email) { row = i + 2; lastSent = values[i][2]; break; }
      }
    }
    // Recently sent: do not send again. Stops the form being used to flood someone's inbox.
    if (row && lastSent && now.getTime() - new Date(lastSent).getTime() < CONFIG.RESEND_HOURS * 3600000) {
      return { ok: true, already: true };
    }
    if (sentToday >= CONFIG.DAILY_CAP) {
      if (!row) sheet.appendRow([email, now, '', 'waiting: daily limit reached, invite not sent']);
      return { ok: false, error: 'busy' };
    }

    sendInvite_(email, now);
    props.setProperty(dayKey, String(sentToday + 1));
    if (row) {
      sheet.getRange(row, 3, 1, 2).setValues([[now, 'invite sent']]);
    } else {
      sheet.appendRow([email, now, now, 'invite sent']);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Strict on purpose: must start with a letter or digit, so a sheet cell can never be read as a formula. */
function isValidEmail_(email) {
  return email.length <= 254 && /^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(email);
}

function getSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['Email', 'First signed up', 'Invite last sent', 'Status']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** First Tuesday of a month at the start hour, New York time, as an exact moment (handles summer/winter clocks). */
function sessionFor_(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const y = first.getUTCFullYear(), m = first.getUTCMonth();
  const day = 1 + ((2 - first.getUTCDay() + 7) % 7);
  let t = Date.UTC(y, m, day, START_HOUR + 5, 0, 0);
  const hour = Number(Utilities.formatDate(new Date(t), TZ, 'H'));
  t -= (hour - START_HOUR) * 3600000;
  return { start: new Date(t), end: new Date(t + CONFIG.DURATION_MIN * 60000), y: y, m: m, day: day };
}

/** The next sessions that have not finished yet. */
function upcoming_(now, count) {
  const out = [];
  for (let i = 0; out.length < count && i < count + 3; i++) {
    const s = sessionFor_(now.getUTCFullYear(), now.getUTCMonth() + i);
    if (s.end.getTime() > now.getTime()) out.push(s);
  }
  return out;
}

function pad_(n) { return (n < 10 ? '0' : '') + n; }
function utcStamp_(d) { return Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'"); }
function icsText_(t) { return String(t).replace(/([,;\\])/g, '\\$1'); }

function joinLine_() {
  if (CONFIG.JOIN_URL) return 'Join link: ' + CONFIG.JOIN_URL;
  if (CONFIG.PAGE_URL) return 'The join link is on the webinar page: ' + CONFIG.PAGE_URL;
  return 'The join link is published on the webinar page before each session.';
}

/** The calendar file: one entry repeating on the first Tuesday of each month, 12 times. */
function buildIcs_(next, now) {
  const rule = 'RRULE:FREQ=MONTHLY;BYDAY=1TU;COUNT=' + CONFIG.SESSIONS;
  const local = function (h, min) { return '' + next.y + pad_(next.m + 1) + pad_(next.day) + 'T' + pad_(h) + pad_(min) + '00'; };
  const endH = START_HOUR + Math.floor(CONFIG.DURATION_MIN / 60), endM = CONFIG.DURATION_MIN % 60;
  const desc = 'One-hour monthly live update on Epic Cash, hosted by ' + HOSTS +
    ': development, network and mining, ecosystem, live Q&A. ' + joinLine_();
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Epic Cash Monthly Webinar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:' + TZ,
    'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:epic-cash-monthly-update@webinar',
    'SEQUENCE:1', // version of the invite: raised when the time moved to 10:00 AM, so calendars that already hold it update it
    'DTSTAMP:' + utcStamp_(now),
    'DTSTART;TZID=' + TZ + ':' + local(START_HOUR, 0),
    'DTEND;TZID=' + TZ + ':' + local(endH, endM),
    rule,
    'SUMMARY:' + icsText_(TITLE),
    'DESCRIPTION:' + icsText_(desc),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText_(TITLE), 'TRIGGER:-PT30M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}

function googleCalendarLink_(next) {
  const desc = 'One-hour monthly live update on Epic Cash, hosted by ' + HOSTS + '. ' + joinLine_();
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(TITLE) +
    '&dates=' + utcStamp_(next.start) + '/' + utcStamp_(next.end) +
    '&ctz=' + encodeURIComponent(TZ) +
    '&recur=' + encodeURIComponent('RRULE:FREQ=MONTHLY;BYDAY=1TU;COUNT=' + CONFIG.SESSIONS) +
    '&details=' + encodeURIComponent(desc);
}

/** Builds and sends the invite email. Nothing typed by the visitor goes into it except their address as the recipient. */
function sendInvite_(email, now) {
  const sessions = upcoming_(now, 3);
  const next = sessions[0];
  const when = function (s) { return Utilities.formatDate(s.start, TZ, "EEEE, MMMM d, yyyy 'at' h:mm a z"); };
  const dates = sessions.map(when);
  const gcal = googleCalendarLink_(next);
  const unsub = 'To stop these emails, reply with the word "unsubscribe".';

  const text = [
    'You are subscribed to the ' + TITLE + '.',
    '',
    'Next session: ' + dates[0] + ' (New York time), 1 hour.',
    'Hosted by ' + HOSTS + '.',
    '',
    'ADD IT TO YOUR CALENDAR',
    'Open the attached file "epic-cash-monthly-webinar.ics". It adds the next ' + CONFIG.SESSIONS +
      ' monthly sessions to Outlook, Apple Calendar, Yahoo Calendar or any other calendar, in your own time zone.',
    'Google Calendar: ' + gcal,
    '',
    'Coming up:',
    dates.map(function (d) { return '- ' + d; }).join('\n'),
    '',
    joinLine_(),
    '',
    'For information only. Nothing in the sessions is financial advice.',
    unsub
  ].join('\n');

  const link = function (url, label) { return '<a href="' + url + '" style="color:#c98a3e">' + label + '</a>'; };
  const html =
    '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px">' +
    '<h2 style="margin:0 0 8px">You are subscribed to the ' + TITLE + '</h2>' +
    '<p><b>Next session:</b> ' + dates[0] + ' (New York time), 1 hour.<br>Hosted by ' + HOSTS + '.</p>' +
    '<h3 style="margin:20px 0 6px">Add it to your calendar</h3>' +
    '<p>Open the attached file <b>epic-cash-monthly-webinar.ics</b>. It adds the next ' + CONFIG.SESSIONS +
      ' monthly sessions to Outlook, Apple Calendar, Yahoo Calendar or any other calendar, in your own time zone.</p>' +
    '<p><a href="' + gcal + '" style="display:inline-block;background:#e4bc38;color:#120d02;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:999px">Add to Google Calendar</a></p>' +
    '<h3 style="margin:20px 0 6px">Coming up</h3><ul style="padding-left:20px;margin:0">' +
    dates.map(function (d) { return '<li>' + d + '</li>'; }).join('') + '</ul>' +
    '<p>' + (CONFIG.JOIN_URL ? 'Join link: ' + link(CONFIG.JOIN_URL, CONFIG.JOIN_URL)
            : CONFIG.PAGE_URL ? 'The join link is on ' + link(CONFIG.PAGE_URL, 'the webinar page') + '.'
            : 'The join link is published on the webinar page before each session.') + '</p>' +
    '<p style="font-size:13px;color:#666">For information only. Nothing in the sessions is financial advice.<br>' + unsub + '</p>' +
    '</div>';

  const options = {
    to: email,
    subject: 'Your invite: ' + TITLE + ' (next ' + CONFIG.SESSIONS + ' sessions)',
    body: text,
    htmlBody: html,
    name: CONFIG.SENDER_NAME,
    attachments: [Utilities.newBlob(buildIcs_(next, now), 'text/calendar', 'epic-cash-monthly-webinar.ics')]
  };
  if (CONFIG.REPLY_TO) options.replyTo = CONFIG.REPLY_TO;

  const from = sendFrom_();
  if (from) {
    // GmailApp is the only Apps Script mail service that can send as another address.
    const gmailOptions = { from: from, htmlBody: options.htmlBody, name: options.name, attachments: options.attachments };
    if (options.replyTo) gmailOptions.replyTo = options.replyTo;
    GmailApp.sendEmail(options.to, options.subject, options.body, gmailOptions);
  } else {
    MailApp.sendEmail(options);
  }
}

/** CONFIG.SEND_FROM if this Google account is allowed to send as it, otherwise '' (send as the account itself). */
function sendFrom_() {
  const wanted = String(CONFIG.SEND_FROM || '').toLowerCase();
  if (!wanted) return '';
  const aliases = GmailApp.getAliases().map(function (a) { return a.toLowerCase(); });
  return aliases.indexOf(wanted) === -1 ? '' : wanted;
}

/**
 * Run this once by hand from the script editor (choose "testSendToMe", press Run).
 * It asks for permission the first time, then sends the invite to your own address so you can see it.
 */
function testSendToMe() {
  const me = Session.getActiveUser().getEmail();
  sendInvite_(me, new Date());
  console.log('Test invite sent to ' + me + ', from ' + (sendFrom_() || me + ' (' + CONFIG.SEND_FROM + ' is not a "Send mail as" address of this account yet)'));
}
