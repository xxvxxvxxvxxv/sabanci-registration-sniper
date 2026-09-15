# Chrome Web Store update

Open the existing Registration Sniper item in the developer dashboard. Choose Package → Upload New Package and upload registration-sniper-extension-0.10.0.zip without extracting it. This is a new version of the existing extension.

Update Store listing with the description below. Update Privacy with the permission justifications below where the current text says local app, localhost or manual-only registration. Keep the existing privacy-policy URL, after deploying the updated website privacy page. Save draft, then Submit for review. Automatic publishing after approval can be selected in the submission dialog.

## Description

Registration Sniper brings your selected course CRNs from the planner into SUIS Add/Drop.

Open the planner and extension side panel. Your selected CRNs appear automatically.

• Copy your selected CRNs.
• Autofill recognized Add/Drop fields.
• Enable Auto submit to submit matching CRNs automatically.
• Enable Aimbot to fill and submit when all selected sections have fresh available seats.

Keep the planner and panel open. Sign in to SUIS yourself; if the session expires, sign back in to resume. The extension does not read or store your university password.

Check SUIS after submission for registration results. Unrecognized forms stop automation. Live SUIS compatibility is still being tested.

An independent student project for Sabancı University. Not affiliated with or endorsed by the university.

## Single purpose

Transfer selected course registration numbers from the Registration Sniper planner to SUIS registration forms, with optional user-enabled submission and seat-triggered registration.

## Permission justification updates

activeTab: Access the user-selected planner or SUIS tab when the extension is used.

scripting: Read selected CRNs from the planner and inspect, fill, verify and optionally submit recognized SUIS registration forms through packaged scripts.

storage: Remember the autofill preference and keep the Auto submit preference and duplicate-submission records in browser-session storage. No browser synchronization is used.

sidePanel: Display selected CRNs and automation controls beside the planner and registration form.

clipboardWrite: Copy selected CRNs when the user clicks Copy CRNs.

Host permissions: Access the Registration Sniper planner to read selected CRNs and seat observations, and SUIS to detect session expiry, inspect matching registration forms, fill CRNs and optionally submit after the user enables automation. No localhost access is requested.

Remote code: No. The extension executes only JavaScript included in its package; planner and seat data are read as data.

Instructions: https://developer.chrome.com/docs/webstore/update
