# Website cleanup — 15 September 2026

## Apply

Extract the update ZIP and upload its contents into the existing GitHub repository, replacing the matching files. Keep the existing Cloudflare D1 configuration. Wait for Cloudflare to deploy, then reload the website.

This package updates the hosted website and README. It does not change the Chrome extension package or local Python interface. No extension reinstall or Web Store resubmission is needed.

## Changes

- Course selection uses only selected / not selected. Legacy outcome labels and priority no longer affect preparation. Existing selection checkboxes are preserved.
- Copy CRNs appears beside Paste CRNs in Timetable and CRNs.
- The timetable always fits the day, ignoring the old view preference. Compact blocks retain their text and can scroll when space is short; readable section details also appear below the grid.
- Timetable blocks, catalog section links and CRN links open the matching SUIS section page for the current term.
- Seats automatically follows selected sections. Custom watchlist, saved-alternative controls and repeated component summary cards are removed.
- Check intervals include 30 and 60 seconds. New watch settings default to 30 seconds; existing saved intervals are preserved.
- The Worker public seat cache also expires after 30 seconds. Requests still share a global queue with a 10-second gap. For example, 13 watched sections need at least about 130 seconds for a full pass, plus queue/network delay. The screen shows this estimate.
- Notifications are labeled explicitly, including Telegram notifications.
- README rewritten as a short project overview with usage and setup.

## Quick check after deployment

1. Open Timetable. Confirm your selected sections survived. Click Copy CRNs, paste into a text editor, and open a course-page link. View the complete section details below the fitted grid.
2. Open CRNs. Switch between Selected and Not selected. Toggle a section, then check that Seats follows the change automatically.
3. While paused, choose 30 seconds in Seats, save and start. Check the observation timestamps. Send a Telegram test from Telegram notifications if connected.

Automated checks cover old plans, selection changes during monitoring, clipboard output, extension bridge compatibility, timetable geometry and full details, 251 registration rules, 30-second Worker cache expiry, shared queue behavior, and Telegram opening transitions with simulated network responses. Worker dry-run build passed. Actual SUIS form compatibility and live deployment behavior still require verification.

## Published extension guide

The Extension page now links to the public Chrome Web Store listing and uses three short, aligned Install / Connect / Fill cards. The README uses store installation instructions. Existing ZIP users can find migration instructions in the collapsed help section.

The Install card uses the supplied, actual Chrome Web Store screenshot. The image is included unchanged.
