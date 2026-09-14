<p align="center">
  <img src="docs/images/banner.png" alt="Registration Sniper — Timetables. Seat alerts. CRNs." width="100%">
</p>

<p align="center">
  <strong>A reference project for course availability notifications.</strong><br>
  Built around Sabancı University. A practical starting point for similar systems elsewhere.
</p>

<p align="center">
  <a href="#the-idea">The idea</a> ·
  <a href="https://sabanci-registration-sniper.sitegap-tools.workers.dev">Live website</a> ·
  <a href="#how-it-works">Architecture</a> ·
  <a href="#adapting-the-project">Adaptation</a> ·
  <a href="#run-the-project">Setup</a>
</p>

---

## The idea

A full course can become available at any moment. Without notifications, students have to revisit registration pages and check the same sections repeatedly.

**Registration Sniper explores a more useful workflow:** choose sections, observe availability, and receive an alert when a previously full section has an opening. A timetable and prepared course identifiers connect that notification to the student's registration plan.

The current implementation uses Sabancı's public course data. Its broader purpose is to demonstrate how availability monitoring, personal subscriptions and notifications can fit together—for another university, a workshop booking system, or another service with limited capacity.

**This is a working example with institution-specific integrations, not a universal registration platform.** Adapting it requires a suitable data source and the destination system's own rules.

## What the project demonstrates

| Capability | Purpose |
| :--- | :--- |
| Section watchlists | Follow relevant courses and saved alternatives |
| Availability-change detection | Alert on a full-to-available transition after establishing an initial baseline |
| Sound, desktop and optional Telegram alerts | Bring an opening to the student's attention |
| Timetable planning | Compare sections, visualize overlaps and prepare alternatives |
| CRN preparation | Collect the selected section identifiers for registration |
| Shared public-data cache | Reuse observations across website visitors and coordinate upstream requests |
| Local personal storage | Keep plans on the device instead of collecting them in an application account |

## How it works

The system separates **observing availability** from **completing registration**. A source adapter reads course and capacity data; the monitor compares observations; notification channels report relevant changes. Enrollment remains in the institution's registration system.

| Layer | Current implementation | Adaptation point |
| :--- | :--- | :--- |
| Data source | Sutable catalog and public SUIS section pages | Official API, permitted public feed or institution-provided integration |
| Availability model | Term, section CRN, capacity, enrollment and remaining seats | Local identifiers, waitlists, shared capacity and reservation rules |
| Monitoring | Local Python process, or an open browser tab using a shared Cloudflare feed | Scheduling and event delivery appropriate to the host environment |
| Notifications | Sound, desktop and a personal Telegram bot | Notification channels supported by the deployment |
| User workspace | Timetable, watchlist and prepared CRNs | Local course structure and registration workflow |

The web backend uses **Cloudflare Workers + D1** to cache public observations and coordinate requests. Personal plans stay in browser storage. Optional web Telegram delivery connects directly from the browser to Telegram.

Unknown or failed observations must remain unknown. An available seat is not a reservation or proof that a particular student is eligible.

## Timing and reliability

The default monitor interval is 120 seconds per CRN. Public observations are cached for 120 seconds, and upstream seat requests share a queue with a minimum 10-second gap after a completed request. Cache age, queue load, network latency and browser suspension can delay an alert beyond two minutes. Very brief openings can be missed. The observation timestamp is the freshness indicator; this is not an instant seat feed.

## Adapting the project

1. **Connect the data source.** Replace the Sabancı adapters with the institution's supported integration. The current code is in `catalog.py`, `seats.py` and `web/src/parsers.mjs`.
2. **Define availability correctly.** Map identifiers and capacity fields. Account for reserved seats, waitlists and shared quotas where applicable.
3. **Model course relationships.** Specify which lectures, labs, recitations or discussions belong together. Instructor names alone do not establish valid combinations.
4. **Set the monitoring policy.** Match the source's update frequency and access requirements. Reuse cached observations and stop on access blocks rather than repeatedly retrying them.
5. **Validate notification behavior.** Check first observations, genuine openings, stale data, source failures and delivery to the intended recipient before rollout.

The same pattern can be explored for seminar seats, laboratory sessions, appointments or equipment bookings. Those environments are **potential adaptations**, not integrations included in this repository.

## Run the project

| Version | Start here |
| :--- | :--- |
| Local Python app | Run `python3 app.py`, then open `http://127.0.0.1:8765`. [Local guide](docs/LOCAL-APP.md) |
| Hosted website and public-data backend | Deploy `web/` to Cloudflare Workers + D1. [Deployment guide](docs/DEPLOYMENT.md) |
| Chrome side panel | Load `extension/` through Chrome's extension developer settings. [Setup and limitations](docs/EXTENSION-AND-VIEW.md) |

The website requires no Python installation for visitors. Browser monitoring needs an open tab and an awake device; local monitoring needs the Python process to remain running. Continuous server-side personal subscriptions are not implemented.

## Implementation status

- **Available:** local planning, public seat monitoring, notification channels and the persistent extension side panel.
- **Deployed on Cloudflare:** browser planner and shared public-data backend. Plan persistence, seat retrieval and sound were confirmed in a user smoke test. Real opening-event delivery and web Telegram delivery still require live verification.
- **Autofill integration:** Extension 0.8 transfers prepared CRNs from the hosted website or local Python app and can fill recognized SUIS registration inputs after preview. It verifies the term and field layout, protects existing values and reads back the result. Automated tests use sample forms and simulated Chrome APIs; compatibility with the actual live SUIS form remains unverified. Registration submission is manual. [Autofill setup](docs/AUTOFILL.md)

The project does not log into SUIS or automatically enroll students. Institution-wide deployment would require further integration, operational testing and review of the institution's registration requirements.

<details>
<summary><strong>Development checks</strong></summary>

```bash
python3 -m unittest discover -v
node --test extension/test-autofill.cjs
```

For the web application:

```bash
cd web
npm ci
npm test
npm run check
```

Checks cover planning, persistence, imports, overlap rendering, monitor transitions, mock-form guards and shared queue coordination. A passing local test does not establish compatibility with a live registration system. See the [web development notes](web/README.md).

</details>

## Data and privacy

Plans are stored locally. The public-feed backend receives requested terms and CRNs; it does not receive complete plans or web Telegram tokens. Hosting and source providers still receive normal connection metadata. University passwords are not requested.

See [privacy and data destinations](PRIVACY.md) for storage, notification and backup details.

## Sources and credits

The Sabancı example uses [Sutable](https://sutable.vercel.app/202601), [public SUIS section data](https://suis.sabanciuniv.edu/) and the [official registration hub](https://bannerweb.sabanciuniv.edu/).

The bundled Fall 2026–27 catalog is a dated snapshot. The included Spring 2026 registration PDF is historical and does not define Fall registration windows.

Typography: Nimbus Sans Narrow Bold — [font license](assets/FONT-LICENSE.txt). Banner: original generated project artwork.

**Independent student project. Not affiliated with or endorsed by Sabancı University.**
