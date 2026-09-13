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
