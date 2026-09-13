# Deploy on Cloudflare

The repository contains both the original local Python app and an isolated web application in `web/`. Only `web/public/` is served to website visitors. Personal plan files and Telegram tokens must never be committed.

## First publication

1. Extract the GitHub package. Upload its **contents**, including `README.md`, `docs/`, `web/` and the existing app files, into the root of `xxvxxvxxvxxv/sabanci-registration-sniper` on the `main` branch. Do not upload only the ZIP or create an extra enclosing directory.
2. Open the repository README and click **Deploy to Cloudflare**. Sign in to Cloudflare and connect GitHub when prompted.
3. The button targets the isolated `web/` directory. Cloudflare's template flow creates a repository copy; verify the destination name before continuing. The resulting website source may therefore be in that new repository.
4. Keep the Worker name `sabanci-registration-sniper` or choose another. Keep the D1 binding named **DB** and provision a new database for the public cache. The all-zero database ID in the template is a placeholder; Cloudflare must replace it with the newly created ID.
5. Use **no build command** and **`npm run deploy`** as the deploy command. It applies D1 migrations and deploys the Worker plus static assets. The Node version must be 22 or newer.
6. Wait for deployment to finish. Open the exact `workers.dev` URL Cloudflare returns. That is the public website link; visitors do not need a Cloudflare account.

Cloudflare documents the [Deploy button and automatic provisioning](https://developers.cloudflare.com/workers/platform/deploy-buttons/). A GitHub repository containing the local HTML alone cannot run the shared backend.

## Keep the existing GitHub repository as the deployment source

Instead of the template button, create a Worker through Cloudflare's Git integration and select the existing repository. Set its root directory to **web**, leave the build command empty and use **npm run deploy** as the deploy command.

Create a D1 database, keep its binding name **DB**, and replace `database_id` in `web/wrangler.jsonc` with its actual ID before the first deployment. Cloudflare handles the GitHub authorization in its own interface. No API token needs to be pasted into this app or chat.

## Verify before sharing widely

- Open the URL in a private browser window. It should show an empty personal plan and the course catalog.
- Import a CRN list; reload and verify that the plan remains. A second browser should have a separate empty plan.
- Start one watched CRN and compare the count and timestamp with the linked official section page. A cached observation is not a live reservation.
- Enable Sound and use Test. Grant desktop notification permission if desired.
- Pair a personal Telegram bot and use Send test. Check that the message reaches the intended phone.
- Confirm that `/api/seat` failures show Unknown or pause monitoring; they must not appear as available seats.

Real free-seat transitions and actual SUIS autofill require separate verification. There is no production Cloudflare deployment confirmed in this package.

## Local web development

```bash
cd web
npm install
npx wrangler d1 migrations apply DB --local
npm run dev
```

For a deployment through the CLI, sign in with `npx wrangler login`, create a D1 database, set its real ID in `wrangler.jsonc`, then run `npm run deploy`. This changes resources in the signed-in Cloudflare account.

## Operations

- Public observations share one queue and a D1 cache. The gate prevents simultaneous source requests and enforces a pause between requests. More visitors can increase queue latency.
- Upstream authorization errors, rate-limit responses and access challenges persistently stop the public seat feed. Review the source response and university guidance before changing the `source_gate` record. Never rotate addresses or automatically clear a block to evade it.
- D1 stores public catalog/count data and queue coordination only. Browser plans and Telegram tokens remain client-side.
- Closing a browser tab stops its monitoring and alert delivery. Continuous monitoring with all browsers closed is not provided.
- A custom domain can be added later in Cloudflare's Worker domain settings.
