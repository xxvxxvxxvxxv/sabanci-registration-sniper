![Registration Sniper](docs/images/banner.png)

# Registration Sniper

A timetable planner and seat tracker for Sabancı University. Pick your sections, keep their CRNs together, and get notified when a full section opens up.

[Open the website](https://sabanci-registration-sniper.sitegap-tools.workers.dev/)

## Features

- Weekly timetable with course colors, conflict highlights, room details and links to SUIS course pages.
- Registration-day labels for your major, with the official registration PDF available in the app.
- Copy or paste CRNs. Your selected sections automatically become your seat watchlist.
- Seat alerts through sound, desktop notifications or Telegram.
- Chrome side panel that previews and fills recognized SUIS CRN fields.
- Optional **Aimbot prepare mode** to prepare the form after a new seat opening.

Plans are saved in your browser. No account is needed. If you want to keep overlapping classes, enable **Allow overlapping classes in extension autofill** in Settings. Copying CRNs always includes your selected sections.

## Using it

1. Open the website and choose your course sections in **Timetable**.
2. Choose your major to see registration-day labels.
3. Open **Seats**, choose an interval and click **Start**. Enable whichever notifications you want.
4. Copy your CRNs, or follow the **Extension** page to install and connect the Chrome side panel.

Keep the website open and your device awake while monitoring. Checks can run as often as every 30 seconds per section, but the shared queue can make a full watchlist take longer. Alerts fire when a previously full section becomes available; the first check establishes a baseline.

Install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/bheoacdoacbliaddomhdnaecepojhadn) using **Add to Chrome**. Then open its side panel on the website and choose **Use this website tab**.

Version **0.9.1** is available in source for testing: automatic planner detection and autofill, with no local-app connection. Trial and production form adapters pass sample-form tests; actual SUIS compatibility and automatic registration submission still need work. The store instructions above apply to published 0.9.0.

**Autofill is still in beta.** Version 0.9 has been tested with sample forms, but the live SUIS Add/Drop form is not verified yet. The `/dolly/` trial system is not supported in this version. Login and final registration submission are manual; Aimbot does not keep sessions alive or register courses for you.

## Running locally

The local Python version starts with:

```bash
python3 app.py
```

Then open `http://127.0.0.1:8765`. See the [local setup guide](docs/LOCAL-APP.md).

The hosted version is in `web/` and uses Cloudflare Workers and D1:

```bash
cd web
npm ci
npm run dev
```

See [deployment instructions](docs/DEPLOYMENT.md) for database setup and publishing. The browser interface and local Python app are maintained separately.

## Development

```bash
cd web
npm test
npm run check
```

The Chrome extension source is in `extension/`. [Autofill notes](docs/AUTOFILL.md) · [Aimbot notes](docs/AIMBOT.md) · [Privacy](PRIVACY.md)

Course data comes from [Sutable](https://sutable.vercel.app/202601) and [SUIS](https://suis.sabanciuniv.edu/). Registration-day labels use the official table dated 14 September 2026.

Made by xxv. Independent student project, not affiliated with Sabancı University.
