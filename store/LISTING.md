# Registration Sniper — Chrome Web Store submission draft

**Status:** package and brand assets prepared. Not submitted. Live SUIS compatibility and a clean screenshot of the installed extension are still required before public distribution.

Name: Registration Sniper — CRN Side Panel

Short description: Prepare course CRNs in a side panel, preview and fill recognized SUIS fields, or prepare once after a seat opening. Manual submission.

Suggested category: Productivity / education-related tooling (select an available category in the dashboard).

## Description

Registration Sniper brings prepared course registration numbers from the Registration Sniper timetable into a persistent Chrome side panel.

- Connect the hosted planner without a connection key.
- Reload or copy the current prepared CRNs.
- Preview the semester and CRN-to-field mapping.
- Fill recognized SUIS registration fields and read back the result.
- Optionally prepare the form once after a new watched-seat opening, when all selected CRNs have fresh available seats.

The user signs into SUIS and submits registration. Registration Sniper does not log in, bypass enrollment restrictions, renew sessions automatically, or press the registration Submit button. Live compatibility is pending verification; an unfamiliar form stops filling.

The planner tab and computer must remain awake for monitoring. Aimbot prepare mode also needs its side panel open. Available seats do not establish eligibility or guarantee registration.

This independent reference project is not affiliated with or endorsed by Sabancı University.

## Links

Website: https://sabanci-registration-sniper.sitegap-tools.workers.dev/

Privacy: https://sabanci-registration-sniper.sitegap-tools.workers.dev/privacy.html

Support/source: https://github.com/xxvxxvxxvxxv/sabanci-registration-sniper

## Permission justifications

- activeTab: identify the page selected by the user for connection or CRN preparation.
- scripting: read the prepared planner packet and inspect/fill recognized registration fields; execute recognized semester-selection actions in opt-in prepare mode.
- storage: keep the planner tab connection or optional local-app bridge settings in browser session storage. No cross-device synchronization.
- sidePanel: keep CRNs and controls visible while changing tabs.
- clipboardWrite: copy prepared CRNs after the user presses Copy.
- hosted planner origin: read the user's prepared plan and seat-monitor snapshot from that page.
- SUIS origin: inspect the registration page, choose a semester and fill CRN fields after user action or explicit arming.
- 127.0.0.1: support users who choose the optional local Python app, authenticated with their local bridge key.

## Data handling for dashboard review

The extension handles website content (CRNs, semester, field layout and seat observations) and, for optional local mode, an authentication bridge key. It does not read or store the university password. It does not use advertising, analytics, remote executable code, or sale/transfer of user data to a developer collection service. Review the dashboard's current definitions when completing declarations; do not claim that no data is handled simply because processing is local.

## Remaining publication steps

1. Upload/deploy the GitHub update, including privacy.html.
2. Verify the installed extension against the live trial form and update the limitations accurately.
3. Capture at least one screenshot of the installed extension using sample data, with no personal browser tabs, bookmarks, account identifiers or credentials. Required size: 1280×800 or 640×400. No personal screenshots are included here.
4. In the Chrome Developer Dashboard, upload registration-sniper-extension-0.9.0.zip. Supply the icon, small promotional image, real screenshot, listing, privacy declarations, distribution and reproducible reviewer instructions.
5. Submit for review. Account setup and publication are performed by the owner. Store approval is not guaranteed.

Official guidance: https://developer.chrome.com/docs/webstore/publish
Image requirements: https://developer.chrome.com/docs/webstore/images
