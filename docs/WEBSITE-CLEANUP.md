# Website cleanup — 15 September 2026

## Apply

Extract the update ZIP and upload its contents into the existing GitHub repository, replacing the matching files. Keep the existing Cloudflare D1 configuration. Wait for Cloudflare to deploy, then reload the website.

This package updates the hosted website and README. It does not change the Chrome extension package or local Python interface. No extension reinstall or Web Store resubmission is needed.

## Changes

- Course selection uses only selected / not selected. Legacy outcome labels and priority no longer affect preparation. Selections remain editable in Timetable.
- CRNs shows only selected courses, sections and linked CRNs, with one Copy CRNs button. Manual entry, Edit, filters and the preparation sidebar are removed. Paste CRNs remains on Timetable.
- Copying includes all selected CRNs, including overlapping classes. Extension autofill still uses its existing checks; its overlap option is now in Settings.
- Timetable legend and other helper text are shorter.
- Timetable has Fit day and Full info views again. The previous view preference is remembered. Full info uses a taller, scrollable grid; individual meetings do not scroll. The extra details cards below the grid have been removed.
- Timetable blocks, catalog section links and CRN links open the matching SUIS section page for the current term.
- Seats automatically follows selected sections. Custom watchlist, saved-alternative controls and repeated component summary cards are removed.
- Check intervals include 30 and 60 seconds. New watch settings default to 30 seconds; existing saved intervals are preserved.
- The Worker public seat cache also expires after 30 seconds. Requests still share a global queue with a 10-second gap. For example, 13 watched sections need at least about 130 seconds for a full pass, plus queue/network delay. The interval is a refresh target; the shared source queue can extend it.
- Notifications are labeled explicitly, including Telegram notifications.
- README rewritten as a short project overview with usage and setup.

## Quick check after deployment

1. Open Timetable. Confirm your selected sections survived. Click Copy CRNs, paste into a text editor, and open a course-page link. Switch between Fit day and Full info and confirm the choice survives a refresh.
2. Open CRNs and copy the list, including any overlapping classes. Change a selection in Timetable, then check that CRNs and Seats follow the change.
3. In Seats, click Start. Check the observation timestamps. Send a Telegram test from Telegram notifications if connected.

Automated checks cover old plans, selection changes during monitoring, clipboard output, extension bridge compatibility, timetable geometry and full details, 251 registration rules, 30-second Worker cache expiry, shared queue behavior, and Telegram opening transitions with simulated network responses. Worker dry-run build passed. Actual SUIS form compatibility and live deployment behavior still require verification.

## Published extension guide

The Extension page contains the Web Store link, three short usage steps and a keep-open note. Images and setup explanations have been removed. The instructions describe the new automatic extension flow; published 0.9.0 still needs the 0.9.1 update.

## Seat monitoring repair

The browser now requests the whole watchlist through /api/seats every ten seconds. The server queues due sections together and returns all stored observations, retaining their original timestamps beyond the short shared cache TTL. This removes the old result-collection race. Shared upstream checks still run one at a time with a ten-second gap. The 30/60/120-second settings determine when sections become due; they cannot make twelve upstream requests complete within thirty seconds.

Transient connection errors retry with bounded backoff and a request timeout. University access blocks still pause monitoring. The sound Test button, interval selector and toolbar timing summary are removed. Stored slower preferences reset to 30 seconds. Enabling sound plays a sample.

Upload both public and src files in this package so the new browser and Worker endpoints deploy together. No database migration is needed. Tests cover whole-watchlist queueing, collecting old results, each interval, notifications and website flows. University responses are simulated; deployment and live source performance still need checking.
