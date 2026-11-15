# Epic Cash Monthly Webinar: landing page

A one-page website for the Epic Cash Monthly Webinar, held on the first Tuesday of every month at
10:00 AM New York time, for one hour. Visitors can add a year of sessions to their calendar and
subscribe by email to receive the invite.

It is a plain website: one HTML file plus images. There is nothing to install or build.

## What is in this folder

| File or folder | What it is | Goes on the website? |
| --- | --- | --- |
| `index.html` | The whole page: content, design, animations and behaviour | Yes |
| `assets/` | The logo, coin and the photos of the guest and two hosts | Yes |
| `vercel.json` | Safety and speed settings that Vercel applies when serving the page | Yes (read by Vercel) |
| `.vercelignore` | Tells Vercel which files not to put on the website | Read by Vercel |
| `.gitignore` | Tells GitHub tools which files to leave out | Read by Git |
| `email-service/Code.gs` | The Google script that saves subscribers and emails the invite. It runs on Google, not on the website. Kept here as the master copy. | No |
| `README.md` | This guide | No |

Do **not** upload the `.claude` folder. It only holds settings for the local preview.

## How to publish

### 1. Put it on GitHub
1. On github.com, create a **New repository** (for example `epic-cash-webinar`). Private is fine; Vercel can still publish it.
2. Choose **uploading an existing file**, then drag in: `index.html`, `vercel.json`, `.vercelignore`,
   `.gitignore`, `README.md`, the `assets` folder and the `email-service` folder.
3. Click **Commit changes**.

### 2. Publish with Vercel
1. On vercel.com, click **Add New → Project** and import the repository.
2. Framework preset: **Other**. Leave Build Command and Output Directory empty.
3. Click **Deploy**. Vercel gives you a web address ending in `.vercel.app`.
4. To use your own domain, add it under **Project → Settings → Domains** and follow the instructions shown.

From then on, every change committed to GitHub is published automatically within a minute or so.
To undo a bad change, open **Deployments** in Vercel, pick the previous one and choose
**Promote to Production** (or "Instant Rollback").

### 3. After the first publish
- [ ] Open the live address on a computer and a phone. Check the countdown, the menu links and both calendar buttons.
- [ ] Subscribe with a test email address. Check the invite email arrives and a row appears in the Google Sheet.
- [ ] Put the live address into the Google script (see "Settings" below) so the invite email links back to the page.

## Settings you may need to change

### In `index.html`
Near the bottom of the file, under the heading `Settings: the only lines to edit`:

| Setting | What it does | Now |
| --- | --- | --- |
| `JOIN_URL` | Link to the live session (Zoom, YouTube and so on). When set, the button in the countdown box becomes "Join" from 30 minutes before the start. | Empty: the page says the link "will be published here" |
| `SIGNUP_ENDPOINT` | Web address of the Google script that receives sign-ups | Set |
| `DURATION_MIN` | Session length in minutes | 60 |
| `SESSIONS` | How many monthly sessions the calendar invite covers | 12 |

The dates and the countdown work themselves out from the calendar. Nothing needs editing each month.

### In the Google script (`email-service/Code.gs`)
The script lives in the Google Sheet "Epic Cash Webinar Subscribers" (open the Sheet, then
**Extensions → Apps Script**). At the top, under `CONFIG`:

| Setting | What it does | Now |
| --- | --- | --- |
| `PAGE_URL` | Public address of this page, used as a link in the invite email | Empty |
| `JOIN_URL` | Link to the live session, shown in the email and the calendar entry | Empty |
| `SENDER_NAME` | Name subscribers see as the sender | Epic Cash Monthly Webinar |
| `REPLY_TO` | Address that replies go to | Empty: replies go to the sending Google account |
| `DAILY_CAP` | Most invite emails sent per day | 300 |

**After any change to the script**, it must be re-published or the change has no effect:
**Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The web address stays the same.
If you edit the script in Google, copy the same change into `email-service/Code.gs` here so the two stay identical.

## How subscribing works
1. A visitor types their email and presses the subscribe button.
2. The calendar invite downloads on the page straight away.
3. The page sends the email address to the Google script.
4. The script saves it in the Sheet and emails the invite, with the calendar file attached, from the Google account that published the script.

The invite is a standard calendar file, so it works in Outlook, Apple, Yahoo, Gmail and others. The
recipient opens the attachment once, and their calendar adds all 12 sessions in their own time zone.

Protection built in:
- The same address is not emailed again within 24 hours.
- No more than 300 invite emails are sent per day.
- Nothing a visitor types is put into the email, except their own address as the recipient.
- A hidden field catches simple automated sign-ups.

## Looking after it
- **Subscriber list:** the Google Sheet. It holds people's email addresses, so share it only with those who need it.
- **Unsubscribes:** the email asks people to reply "unsubscribe". Someone then deletes that row from the Sheet by hand.
- **Sending limits:** Google allows roughly 1,500 emails a day on a Workspace account and 100 on a free Gmail account.
- **After a year:** each invite covers 12 sessions from the date it was sent, then ends. Subscribers would need a new invite after that.
- **Changing the start time:** change `START_HOUR` in both `index.html` and the Google script (24-hour clock, New York time), and the "10:00 AM" wording in `index.html`. Then re-publish the script.
- **Changing the guest, hosts or wording:** edit `index.html`. Their names also appear in the calendar entry (`desc` near the bottom of `index.html`) and in `HOSTS` at the top of the Google script.
- **Changing photos or the logo:** replace the file in `assets/` with one of the same name. Host photos are square, 360 by 360 pixels.

## Still to decide
- Where the webinar is held, and so the join link (`JOIN_URL` in both places).
- Whether the invite emails should come from an Epic Cash address. If so, the script must be published again from that Google account, and `SIGNUP_ENDPOINT` in `index.html` updated to the new web address.
- Whether "10 AM EST" means New York time all year (how the page works now) or fixed winter time.
- Confirmation from the hosts of the four agenda topics and of the wording about Max Freeman.
