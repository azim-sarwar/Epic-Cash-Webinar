// Calendar invite for the Epic Cash Monthly Webinar, served at /calendar.ics (see vercel.json).
//
// The invite is sent as a normal file from a normal web address, not built inside the visitor's browser,
// because iPhones ignore browser-built files in many apps (Telegram, X, Chrome...). Opened from a real address,
// an iPhone shows its own "Add to Calendar" screen and other devices download the file.
//
// These settings must match the ones at the bottom of index.html (and email-service/Code.gs).
var JOIN_URL = '';          // Link to the live session. Empty = "see the event page".
var DURATION_MIN = 60;      // Session length in minutes.
var SESSIONS = 12;          // How many monthly sessions the invite covers.
var TZ = 'America/New_York', START_HOUR = 10; // 10 = 10:00 AM New York time (24-hour clock)
var TITLE = 'Epic Cash Monthly Webinar';
var HOSTED_BY = 'hosted by Romain Daniellou and Jose Enrique Castellón, with Max Freeman, founder of Epic Cash, as guest';

var pad = function (n) { return (n < 10 ? '0' : '') + n; };

// First Tuesday of a month at 10:00 AM New York time, as an exact moment (handles summer/winter clock changes).
function session(y, m) {
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  var dow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  var day = 1 + ((2 - dow + 7) % 7);
  var t = Date.UTC(y, m, day, START_HOUR + 5);
  var h = +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(t);
  t -= (h - START_HOUR) * 3600000;
  return { start: new Date(t), end: new Date(t + DURATION_MIN * 60000), y: y, m: m, day: day };
}

// The next session that has not finished yet.
function nextSession(now) {
  var d = new Date(now);
  for (var i = 0; i < 3; i++) {
    var s = session(d.getUTCFullYear(), d.getUTCMonth() + i);
    if (s.end.getTime() > now) return s;
  }
  return session(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function buildIcs(now) {
  var next = nextSession(now);
  var joinOk = /^https:\/\//i.test(JOIN_URL);
  var desc = 'One-hour monthly live update on Epic Cash, ' + HOSTED_BY + ': development, network and mining, ecosystem, live Q&A.' +
             (joinOk ? ' Join: ' + JOIN_URL : ' Join link: see the event page.');
  var utc = function (d) { return d.toISOString().replace(/[-:]|\.\d{3}/g, ''); };
  var localStamp = function (s, h, min) { return '' + s.y + pad(s.m + 1) + pad(s.day) + 'T' + pad(h) + pad(min) + '00'; };
  var endH = START_HOUR + Math.floor(DURATION_MIN / 60), endM = DURATION_MIN % 60;
  var esc = function (t) { return t.replace(/([,;\\])/g, '\\$1'); };
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Epic Cash Monthly Webinar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:' + TZ,
    'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'UID:epic-cash-monthly-update@webinar',
    'SEQUENCE:1', // version of the invite: raised when the time moved to 10:00 AM, so calendars that already hold it update it
    'DTSTAMP:' + utc(new Date(now)),
    'DTSTART;TZID=' + TZ + ':' + localStamp(next, START_HOUR, 0),
    'DTEND;TZID=' + TZ + ':' + localStamp(next, endH, endM),
    'RRULE:FREQ=MONTHLY;BYDAY=1TU;COUNT=' + SESSIONS, // first Tuesday of each month, for a year
    'SUMMARY:' + esc(TITLE),
    'DESCRIPTION:' + esc(desc),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(TITLE), 'TRIGGER:-PT30M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n') + '\r\n';
}

module.exports = function (req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  // "inline" lets an iPhone open its Add to Calendar screen; browsers that cannot show a calendar file save it under this name.
  res.setHeader('Content-Disposition', 'inline; filename="epic-cash-monthly-webinar.ics"');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600');
  res.end(buildIcs(Date.now()));
};
module.exports.buildIcs = buildIcs;
