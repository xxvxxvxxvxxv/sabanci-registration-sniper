# v0.6.2 beta

Local course planning and public seat monitoring for Sabancı students.

- Distinct course colors with matching lecture/companion colors; overlapping meetings turn red with yellow warning triangles.
- Build a weekly timetable with independently selected lecture, lab and recitation sections.
- Paste CRNs from Sutable and preview sections, meeting times and conflicts before saving.
- Monitor public seat counts, including shared capacity when provided by the source.
- Receive short sound alerts, desktop notifications and optional private Telegram messages.
- Keep the Chrome side panel open while working. Autofill supports the bundled local test form only.

## Install

Download `sabanci-registration-sniper-v0.6.2.zip`, extract it and run `python3 app.py` inside the extracted folder. Python 3.9+; no pip dependencies. Windows: `py app.py`. Follow README.md for extension and Telegram setup.

For upgrades, copy your existing `plan.json`, `plan.monitor.json` and `plan.phone.json` into the new folder if present. Keep those files private.

## Validation and limitations

79 Python tests, 10 extension guard tests and DOM integration checks pass locally. Public counts, Telegram test delivery and the persistent panel have also been exercised by the project owner on macOS. This does not establish reliability under registration-day load.

Real SUIS autofill and automatic registration are not implemented. Monitoring requires an awake computer with Python running; sound and desktop alerts also require the app tab. Polling intervals do not guarantee acceptance by the university. Access blocks pause monitoring. This release is a downloadable local app, not a hosted web app.
