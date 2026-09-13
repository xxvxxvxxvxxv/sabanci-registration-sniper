# Data handling — version 0.6.2

The app has no analytics, cloud account, shared application database or telemetry endpoint.

| Data | Storage or destination |
| --- | --- |
| Selected courses, alternatives and recorded outcomes | Local `plan.json` and its backup |
| Watch list, counts and alert history | Local `plan.monitor.json` |
| Telegram token, paired chat and delivery preferences | Local `plan.phone.json`, created with owner-only POSIX file permissions on macOS/Linux |
| Extension connection key and port | Chrome session storage; no Chrome Sync storage |
| CRN packet for autofill | Local app → installed extension → local mock form |
| Catalog refresh | Direct request to Sutable for the selected semester |
| Seat checks | Direct requests to public SUIS section pages containing the term and watched CRN |
| Phone alert, disabled by default | Telegram Bot API; default text contains no CRN, course or timetable |

SUIS and Sutable can observe the requests sent to their servers and associated network metadata. Local storage does not mean those public data sources receive no requests.

Telegram delivery requires an explicit opt-in after pairing a private chat. Telegram receives the bot authentication, chat identifier, message and delivery/network metadata. Detailed term/CRN/count text has a separate opt-in. The university password is never requested or stored. A generic phone alert still reveals that Registration Sniper generated an alert.

The phone token is not returned by the local status API, included in plan export, logged in HTTP errors, or packaged in a release. Disabling delivery stops new queued messages from being sent; a message already in flight cannot be recalled. Disconnect removes the local phone configuration; messages already in Telegram remain there. An exposed bot token should be revoked through BotFather.

The app binds to `127.0.0.1`, checks the Host header and requires a session token for mutation requests. The extension uses a separate session connection key. These protections do not defend against other software running with access to the same user's files or browser.

The release builder uses an explicit source allowlist. Personal plans, observations, tokens and backups are excluded. Custom `--data` paths should be outside a source repository because `.gitignore` cannot anticipate arbitrary filenames. Review staged files before publishing a repository.

Version 0.6.2 is a localhost application. Source and a downloadable beta are distributed through GitHub. There is no hosted app instance or Chrome Web Store listing. Any future public hosting provider also receives ordinary page/asset requests; it must not receive the private plan through app telemetry or a shared database.
