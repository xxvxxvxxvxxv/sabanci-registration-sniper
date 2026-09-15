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
3. Open **Seats**, click **Start**. Enable whichever notifications you want.
4. Copy your CRNs, or follow the **Extension** page to install and connect the Chrome side panel.

Keep the website open and your device awake while monitoring. Checks can run as often as every 30 seconds per section, but the shared queue can make a full watchlist take longer. Alerts fire when a previously full section becomes available; the first check establishes a baseline.

Install the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/bheoacdoacbliaddomhdnaecepojhadn). Version 0.10.0 detects your planner automatically. Open its side panel and SUIS Add/Drop; enable **Auto submit** if you want it to submit the filled CRNs. **Aimbot** waits until all selected sections have fresh available seats, then fills and submits once.

**0.10.0 is a test build until published.** Automatic submission passes sample-form tests; live SUIS compatibility remains unverified. If SUIS signs you out, sign back in to resume. The extension does not store your password or keep the session alive. After a submission attempt, check SUIS for acceptance or errors.

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
