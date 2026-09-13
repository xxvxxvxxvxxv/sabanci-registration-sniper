# Privacy and data destinations

| Data | Local Python app | Cloudflare website |
|---|---|---|
| Plan and preferences | Files on the computer | Browser local storage |
| Watched term and CRN | Sent to the public SUIS page | Sent to the public-feed Worker and then SUIS; shared public counts cached in D1 |
| Course catalog | Public Sutable page; local snapshot | Public Sutable page; shared cache and bundled snapshot |
| Telegram token / chat | Local private configuration file; sent to Telegram | Tab session storage; sent directly to Telegram |
| University password | Not requested | Not requested |

The web backend does not receive complete plans or Telegram tokens. Hosting and source providers still receive normal connection metadata such as IP addresses and requested URLs. There are no analytics scripts in the application.

Telegram alerts are optional. Generic messages omit course details; a separate opt-in includes term, CRN and seat count. Telegram receives message content and delivery metadata. Disconnect removes saved browser Telegram credentials. Browser session recovery can restore session storage after a restart.

Clearing browser storage deletes its saved plan. Export backups through Settings. Exported plans and screenshots may contain personal course selections; review before sharing. Never upload `plan.json`, `*.phone.json`, `*.monitor.json` or access tokens to a public repository.

The website requires an open tab and an awake device for monitoring and notifications. The local version requires Python to keep running. A successful notification test does not prove a future seat event will be delivered or accepted by the registration system.
