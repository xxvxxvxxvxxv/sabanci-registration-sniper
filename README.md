<img src="assets/reticle.svg" width="56" height="56" alt="Registration Sniper reticle">

# Sabancı Registration Sniper

**v0.6.2 beta · Local Python app for course planning and seat alerts**

Build a weekly timetable, paste CRNs from Sutable, track public seat counts, and receive desktop, sound or optional Telegram alerts. Each user runs their own copy and keeps their own plan and Telegram token locally.

| Feature | Beta status |
| --- | --- |
| Timetable, CRN import and overlap checks | Available |
| Public seat monitoring and alerts | Available; computer must remain awake |
| Chrome side panel | Available |
| Autofill | Bundled local test form only |
| Real SUIS registration, login or automatic seat taking | Not implemented |

This is an independent student project, not an official Sabancı University service. Observed free seats do not establish eligibility or reserve a place. The app does not guarantee registration.

[Download v0.6.2 beta](https://github.com/xxvxxvxxvxxv/sabanci-registration-sniper/releases/tag/v0.6.2) and extract its ZIP, then follow the setup below. The included catalog is a dated snapshot; refresh it for the intended term.

Private local Python app: **Timetable · Seats · CRNs**, plus the Chrome autofill extension. Python 3.9+; standard library only. No pip install, university password or cloud account required.

## Setup / upgrade on Mac

1. For an upgrade, stop the old app with **Ctrl+C** in its Terminal window.
2. Extract `sabanci-registration-sniper-v0.6.2.zip`.
3. For an upgrade, copy `plan.json`, `plan.monitor.json` and `plan.phone.json` (when present) from the old app folder into `registration-sniper-v0.6.2/`. Keep the old folder as a backup. Do not overwrite it with an empty plan. Existing selections, priorities and saved alternatives are preserved.
4. Start the new app:

```bash
cd ~/Downloads/registration-sniper-v0.6.2
python3 app.py
```

The app opens `http://127.0.0.1:8765`. Keep Terminal open. Double-clicking `start-mac.command` is an alternative; if it is not executable, use the command above. Windows: `py app.py` or `start-windows.bat`. Optional flags: `--port 8766`, `--no-browser`, `--data /absolute/path/plan.json`.

For the persistent side panel, disable the older extension in `chrome://extensions`, choose **Load unpacked**, and select the new `registration-sniper-v0.6.2/extension/` folder. Click the extension toolbar icon to open the panel. Clicking elsewhere on the page leaves it open. Reconnect with **Extension → Copy connection key** after restarting Python. Chrome 116+ is required.

## New in 0.6.2

- Distinct muted colors organize courses; lectures and their catalog companion sections share a color. The palette is deterministic for the saved course set, with distinct colors for up to ten course identities.
- Only meeting blocks that actually overlap turn red. A yellow warning triangle and a time-conflict accessibility label identify each affected block. Other meetings of the same section keep their course color.
- Split lanes and exact minute positioning are preserved.

## New in 0.6.1

- **Paste CRNs → Preview → Add to plan** imports an entire Sutable selection. Spaces, tabs, newlines, commas and semicolons work. Course, section and meeting times are resolved from the local catalog; no extra university requests are made.
- Preview shows exact sections, catalog timestamp and preparation issues. Conflicting schedules can be saved for editing; unresolved conflicts still block prepared autofill lists.
- Existing rows, outcomes, priorities and selections remain unchanged. New groups for an occupied component become unselected alternatives. Repeated CRNs are deduplicated. Unknown CRNs reject the whole import. Revision and catalog checks prevent applying stale previews.
- Timetable conflict messages now include the exact weekday and overlap interval.
- The extension is unchanged from 0.6; an installed 0.6 side panel can be kept. Reconnect its key after restarting Python.

## Features carried forward from 0.6

- **Follow timetable** keeps monitoring in sync with saved selections. **Include saved alternatives** also watches backups for currently selected, unregistered component types. Registered components are not polled. The existing 20-CRN limit remains; an invalid/oversized followed list pauses monitoring instead of silently omitting sections.
- Course cards summarize the availability of all **selected** components, including manually confirmed registrations. They do not discover or confirm official required components or pairing rules. Counts come from separate observations, not one atomic reservation.
- Available fitting backups appear as opportunities. **Review replacement → Select & prepare CRNs** revalidates current plan revision, observed availability, companion availability, known times, conflicts and the catalog before saving. It never drops registered sections or replaces a locked section. Source freshness is rechecked from stored observations; the action does not force an extra university request.
- CRNs are prepared automatically after plan changes. Copy checks the latest plan again.
- A global Chrome side panel replaces the dismissible popup. Switching tabs or navigating clears its previous field preview.
- Optional phone alerts use a private Telegram chat. Setup below. Web Store code package and publication notes are included, but nothing has been published.


## Validation for this update

79 Python tests and 10 extension guard tests pass. DOM integration exercises bulk import through the real Python resolver, exact conflict intervals, notification deduplication and autofill rollback. A local integration test runs parsed seat counts through the monitor and Telegram delivery queue using a simulated Telegram transport. It makes no university requests or real Telegram sends. Actual macOS rendering and the real SUIS registration adapter remain unverified.

## Timetable

Search by course code, name, instructor or CRN. Select each main section and companion group independently. Each section owns one CRN and may contain multiple weekly meetings. **Instructor names and section prefixes do not have to match in the planner.** Official corequisite and pairing rules still determine which combinations SUIS accepts; the app does not infer them from names.

Teaching cells start at `:40`, end at `:30`, and show the intervening break separately. Event positions and cell boundaries use the same minute-based axis. A 50-minute meeting fills one teaching cell; a 110-minute meeting spans two cells and the intervening break. Unusual meeting times remain at their real minute offsets. Overlapping meetings occupy separate lanes. TBA times remain unknown. Holidays, semester date ranges and travel times are not modeled.

The bundled Sutable snapshot has 475 courses / 1,284 CRNs for term 202601, downloaded on 13 September 2026. Hover over the catalog count for the download timestamp. It is a snapshot, not a live timetable guarantee. Public SUIS details may change independently of Sutable.

**Settings** (top right) contains catalog refresh, plan import/export and alternative search. Refresh downloads one public Sutable page, validates the term, and preserves the old cache on failure. At most one manual catalog refresh per minute. Saved selections are checked for changed course, section, CRN or meeting data before preparation.

Saved alternatives remain available below section choices. Alternative search uses saved choices by default; Settings can expand it to all catalog sections. Registered/locked sections stay fixed. Full/rejected choices are excluded; uncertain outcomes and unknown fixed meeting times block the search. Results require review before applying.

The new reticle is a local SVG with a transparent background. All fonts and assets are bundled.

## Seats and alerts

1. Open **Seats → From timetable**, or enter up to 20 CRNs separated by spaces.
2. Enable **Follow timetable** and optionally **Include saved alternatives**, choose an interval, then **Start**. Start also saves an edited watch list. Pause before changing the list.
3. Click **Sound off** to enable the alarm; it plays a short test signal. **Test** repeats it.
4. Click **Desktop** to request desktop notification permission. Chrome and macOS must both allow it.

The Python worker reads public SUIS section-detail pages, without login. These pages supply **Capacity / Actual / Remaining**. When a **Cross List Seats** row exists, displayed availability and alerts use the smaller of section remaining and shared remaining. Shared remaining is also shown separately. Waitlist capacity is not treated as an ordinary free seat.

Default target interval: 120 seconds per CRN; alternatives: 300 or 600 seconds. There is one worker and at least 10 seconds between requests across the entire watch list. With many CRNs, slow responses or errors, a cycle takes longer. Additional browser tabs do not create extra university polling workers. The interface polls only the local Python app for updates.

These intervals are conservative app settings, **not a university-approved rate or a guarantee against blocking**. The fetcher identifies itself as `RegistrationSniper/0.6.2`; it does not impersonate a browser. HTTP 401/403/429, redirects and detected access challenges stop monitoring. Other failures back off; three consecutive failures for a section pause monitoring. There is no automatic attempt to bypass a block.

The first successful observation establishes a baseline. An alert is generated when previously nonpositive availability becomes positive. Repeated positive observations do not repeat the alarm. Previously saved observations persist across restarts; a new observation can reveal that a section opened since the last successful check. Recent alerts remain in the app, and old alerts are not sounded again on page reload.

Unknown, failed and stale checks are distinguished from zero seats. Last successful time is displayed in Istanbul time. Observations older than twice the nominal cycle are marked stale. Source publication/cache age is unknown; the displayed timestamp is the app's observation time. Counts do not establish registration eligibility or reserve a seat.

**Runtime:** keep the Mac awake and Python running for checks. Keep the app tab open for sound and desktop alerts; delivery may be delayed when Chrome throttles background tabs. Allow sound in Chrome and notifications in macOS, and test locally before relying on them. Closing the tab stops browser alert delivery; Python can continue logging observations. Closing Python stops checks. A restarted app begins paused and requires Start. Sound must be enabled again after reloading the page.

Watch configuration, observations and recent events are saved in `plan.monitor.json` beside `plan.json` (or beside the custom `--data` file). This file contains no university credentials. Plan export covers the plan; copy the monitor file too if its history is needed on another installation.

## Phone notifications

Open **Seats → Phone**:

1. In Telegram, create a personal bot with **@BotFather → /newbot**.
2. Paste its token into **Bot token → Save bot token**. Do not send the token to anyone or commit it to GitHub.
3. Send the displayed `/start RS-…` command to **the new bot**, in a private chat, within 10 minutes. Click **Confirm phone** in the app. Group chats do not pair.
4. Enable **Send alerts to this phone** and click **Send test**. Confirm the message and phone notification arrive.

By default the message only says a seat opened or monitoring stopped. No course, CRN or timetable is included. A separate option allows the term, CRN and count to be sent. Telegram necessarily receives the chosen message and delivery metadata; this channel is optional and is not an entirely local data path.

Phone delivery runs in Python independently of the app tab. The computer must remain awake and Python must stay running. Telegram/phone network connectivity and notification settings affect delivery. Failures are recorded in Phone settings with no automatic resend. Queued phone messages are memory-only; they do not survive app shutdown. A response accepted by Telegram is not proof that the phone displayed it.

The bot token and pairing are stored in a separate `plan.phone.json` with owner-only file permissions on macOS. It is excluded from release archives and plan export. Copy it privately when upgrading if the same phone connection is needed, or pair again. **Disconnect** removes it. Use a dedicated personal bot without a webhook or another consumer of its incoming updates.

## CRNs and extension

**CRNs** automatically collects selected unregistered CRNs in priority order. Duplicates, known timetable conflicts, catalog mismatches and unresolved recorded outcomes block preparation. Eligibility and registration-window uncertainties are collapsed into a details section. **Copy CRNs** rechecks the plan before copying.

The extension remains a **local mock-form adapter only**. It fills and verifies separate horizontal inputs on the bundled `/mock` page; live SUIS autofill is not implemented because the registration form was unavailable for inspection. No enrollment or automatic submission is performed. Real form support cannot be claimed from the mock test.

To test: **Extension → Copy connection key → extension side panel → Connect → Test autofill → Load plan & preview fields → Fill & verify**. Existing occupied fields, changed term/revision, stale packets and insufficient input count block filling. Matching values are recognized as already filled. Failed readback triggers best-effort rollback. University credentials, cookie access and persistent university host permissions are not used.

The user verified v0.4 mock filling in Chrome on Mac. The adapter and packet format are retained; the new side-panel interaction requires a Chrome check on the actual Mac.

## Clock and historical reference

The header clock displays seconds in `Europe/Istanbul`, using the computer clock. Enable **Set time and date automatically** in macOS for accurate system time. This is not synchronization with a university registration clock.

The original Spring 2025–2026 registration-day PDF remains under Settings as a historical reference. It cannot establish Fall 2026–2027 restrictions or opening times. Legacy override drafts/history remain in plan JSON for compatibility, with no editor or main navigation tab.

## Validation

72 Python tests cover planning, persistence, catalog integrity, alternatives, real Banner-style table parsing, shared capacity, full-to-open transitions, deduplication, request spacing, backoff, access-block stop, stale results, restart behavior, pause races, followed backups, combination status, reviewed replacements, private phone pairing and authenticated local controls.

10 Node tests cover extension guards. DOM integration tests exercise selection across different instructor/section names, cell/event coordinates, editor persistence, monitor controls, notification/sound deduplication, unknown-seat states, automatic CRN preparation, phone setup, reviewed replacement and autofill/rollback. Side-panel tests check toolbar behavior configuration and invalidation on tab/navigation changes. Public lecture and lab responses for CRNs 10119 / 10123 were downloaded and their actual seat tables parsed. No live enrollment, sustained university polling, live Telegram delivery or new macOS side-panel/notification delivery was tested. Phone tests use a mocked Telegram transport; perform Send test after pairing. DOM tests do not substitute for a rendered Chrome layout check.

```bash
python3 -m unittest discover -v
node --test extension/test-autofill.cjs
```

Optional DOM tests require Node compatible with jsdom 30:

```bash
cd dev-tests
npm install
npm test
```

Node/npm are not needed to run the app or extension.

## Sources

- [Sutable catalog](https://sutable.vercel.app/202601)
- [Official registration hub](https://bannerweb.sabanciuniv.edu/)
- [Public section detail example](https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched?term_in=202601&crn_in=10119)
- [Technical warnings](https://mysu.sabanciuniv.edu/sr/en/technical-warnings) — also provided as a user screenshot.
- [Spring registration-day PDF](https://mysu.sabanciuniv.edu/sr/sites/mysu.sabanciuniv.edu.sr/files/2026-02/CourseRegistrationDays_20260209_0.pdf)
- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)
- [Web Audio practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

Typography: Nimbus Sans Narrow Bold; license in `assets/FONT-LICENSE.txt`. Reticle: original code-native SVG.

## Share and publish

See **PUBLISHING.md** for GitHub, static hosting architecture and extension distribution. **PRIVACY.md** lists every data destination. This remains a localhost Python app; deploying its HTML directly to GitHub Pages will not provide a working backend. The online browser-storage/extension-worker migration is not implemented in 0.6.2.

Run `python3 scripts/build_release.py` to package shareable source without personal state. The delivered ZIP also includes `extension-package.zip` with the extension manifest at its root. A Web Store listing still needs the owner's developer account, listing assets, privacy declarations and review.
