# Registration Sniper · Cloudflare web app

A standalone Cloudflare Worker serving the existing lightweight HTML/CSS/JavaScript interface and a read-only public seat-data API. No Sites or ChatGPT runtime, branding, authentication or hosting configuration is required.

- `public/`: browser planner, local storage, timetable, alerts and direct Telegram connection.
- `src/worker.ts`: request routing.
- `src/feed.ts`: shared D1 cache and upstream request queue.
- `src/parsers.mjs`: public catalog/seat parsing with identity and arithmetic checks.
- `migrations/`: public cache schema.

Node 22+ is required for development/deployment. Website visitors only need a browser.

```bash
npm install
npx wrangler d1 migrations apply DB --local
npm run dev
```

`npm run check` bundles a dry run without publishing. `npm run deploy` applies remote D1 migrations and publishes to the signed-in Cloudflare account. Set a real D1 database ID before a manual deployment. Cloudflare's Deploy button provisions a fresh database and rewrites the template binding.

No personal data or university credentials are seeded. The bundled catalog is a dated Fall 2026–27 snapshot. Production Cloudflare requests and real alert delivery still need verification after deployment.

Run the browser behavior and shared queue checks with `npm test`. These checks use local fixtures and do not submit registrations.

## Registration-day reference and extension guide

The Timetable major/program selector and earned-credit band are saved under `sniper-registration-profile-v1` in localStorage. They do not change or verify the registration plan. Labels come from the bundled Fall 2026–2027 PDF (14 September 2026, 09:51), extracted into `public/registration-data.js`.

- `D1?` requires at least 94 earned SU credits when the credit band is unspecified. Critical courses bypass only the senior restriction on Day 1.
- `!` retains the PDF’s extra class restriction warning on every day.
- Components use their explicit catalog parent course. Unknown manual codes and different semesters show **Check PDF**; no suffix-based pairing is invented.
- The PDF supplies day numbers, not calendar dates or opening times. These are advisory labels, not permission to register.
- **Registration days** opens the original bundled PDF in a new tab. **Extension** opens an illustrated guide within the app. Guide illustrations contain sample values and no personal screenshots.

To regenerate this edition, install `pdfplumber` in the development environment and run `python scripts/import_registration_days.py path/to/CourseRegistrationDays_20260914.pdf` from the repository root. The importer validates the edition and table structure. Updating to a new semester requires reviewing the source metadata and tests.
