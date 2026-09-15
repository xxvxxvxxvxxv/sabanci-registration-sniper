# Extension 0.10.0

## Controls

- Autofill Add/Drop fills recognized empty CRN fields. Enabled by default.
- Auto submit submits matching CRNs through a recognized registration Submit button. Off by default; remembered for this browser session.
- Aimbot: Auto-submit CRNs on available seats. Requires Seats monitoring and fresh availability for every selected CRN. It can act immediately if all sections already have seats. It stops after one attempt.

The planner and SUIS tabs are detected automatically. Keep the panel and planner open. If multiple SUIS tabs exist, activate the intended tab before enabling Aimbot.

## Session handling

Expired sessions and password forms pause automation. Sign in yourself and return to Add/Drop; automation resumes. Passwords are never read or stored. No keepalive endpoint or automatic login has been implemented. Closing the panel stops automation.

## Submission

Only same-term, recognized POST registration forms in /prod/ or /dolly/ qualify. Filled CRNs must exactly match the plan. Drop/withdrawal selections, changed destinations, ambiguous Submit controls and stale plans stop submission. A browser-session record prevents a second automatic attempt for the same tab, environment, plan revision and CRN list, including uncertain results. Check SUIS after an attempt; a click is not proof of successful registration. Retry manually after an error or uncertain result.

Tests use simulated Chrome APIs, JSDOM forms and a serialized service-worker claim test. They cover optional submission, duplicate prevention, destination changes, drop selections, session detection and available-seat triggers. Actual trial and production SUIS forms have not been tested; use Load unpacked on the trial form before public release.

## Website update

The interval selector has been removed. Stored slower preferences reset to the shortest supported target (30 seconds). Browser result collection runs every 10 seconds; the shared upstream queue still determines actual per-class refresh time. This does not guarantee every class updates in 30 seconds.
