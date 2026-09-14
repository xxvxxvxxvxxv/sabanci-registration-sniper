# CRN autofill — extension 0.8

## Install and use

1. Extract `registration-sniper-extension-0.8.zip` into a permanent folder. In `chrome://extensions`, enable Developer mode and load the folder containing `manifest.json`. To update an existing unpacked installation, replace its files and click Reload. Accept Chrome's requested access to SUIS if prompted.
2. Open the hosted planner, open the extension side panel and choose **Use this website tab**. Keep this source tab open. Alternatively, connect the local Python app using its port and bridge key.
3. Sign into SUIS normally and open the actual Add/Drop course registration form for the same term.
4. Select **Preview CRN fields** in the side panel. Review the term and each CRN-to-field mapping.
5. Select **Fill & verify** within 60 seconds. Review the values on SUIS and submit the form yourself.

The extension never logs in, presses Submit or retries registration. The SUIS adapter sets native input values without firing keyboard, input, change or click events. Hidden fields and non-CRN inputs are not modified.

## Recognition requirements

This is a conservative adapter based on expected Banner-style fields, not captured live SUIS markup. It accepts only HTTPS `suis.sabanciuniv.edu` registration paths matching `/prod/bwskfreg.*`, one POST form pointing to that same registration namespace, and text inputs named exactly `crn_in`. Each input must have `maxlength=5`, or `size=5` with no maxlength. The term must be unambiguous and explicitly present in `term_in` or `term` inputs or URL parameters. The inputs must be visible, enabled and writable.

Missing or different markup stops the fill. No term is guessed and no arbitrary text fields are used. If SUIS shows “Term not available,” there is no registration form to fill yet.

Existing CRN values block replacement unless all fields already match the prepared list. Changes to the plan, form, field values or element identities after preview invalidate the operation. A failed write restores original values in fields still attached to the document.

## Test status

Nineteen sample-form checks cover normal fill, read-back, no submission/events, unchanged unrelated values, inputs without IDs, wrong/missing/ambiguous terms, unsupported pages, unexpected destinations, occupied/hidden/disabled/readonly inputs, insufficient fields, multiple forms, element replacement, stale previews, plan changes and rollback. Side-panel tests cover routing preview/fill to the SUIS adapter. Existing website-transfer, local mock and monitoring tests are also retained.

These are automated tests with synthetic forms and simulated Chrome APIs. **Actual live SUIS form compatibility and installed-Chrome operation remain to be verified.** If recognition fails, report the exact extension error and the CRN-field markup only, excluding credentials, cookies and other personal fields.
