# Aimbot — prepare mode (0.9)

Aimbot reacts to a new watched-seat opening and prepares the existing SUIS registration form. **It does not yet implement automatic login, session renewal or final registration submission.** Those features require inspection and verification of the live trial flow. There is no hidden auto-submit switch.

## Use

1. Select the exact CRN bundle in the planner. Resolve preparation errors and check eligibility.
2. Start Seats monitoring for every CRN in the bundle.
3. Connect the website tab in the Registration Sniper side panel.
4. Sign in normally and open SUIS Add/Drop or its semester selection page. Select **Use this SUIS tab**.
5. Enable **Prepare on a new seat opening**. Keep the planner tab, side panel and computer awake.
6. After a new full-to-available event, every selected CRN must have fresh available-seat data. Registration Sniper follows a recognized Add/Drop link, selects the exact semester if necessary, previews and fills recognized CRN fields once, then disarms. Review and submit manually.

Already-available seats do not trigger it on arming. It does not register a partial bundle or substitute a fallback automatically. Registration-day labels remain advisory; SUIS enforces prerequisites, program restrictions, holds and available seats.

## Stops

Arming expires after 30 minutes. It stops if the plan changes, monitoring stops, the source or SUIS tab closes or changes origin, the session expires, a challenge appears, required fields cannot be verified, navigation repeats, page loading times out, or a step fails. Existing values are protected by the autofill adapter. Turning the toggle off cancels subsequent steps; a browser navigation or field write already dispatched cannot be recalled. Closing the side panel loses the armed state. Reopen and arm explicitly.

A two-second poll reads the existing browser monitor snapshot. It does **not** poll university pages every two seconds. The public seat feed retains its shared rate limits. No periodic SUIS reload or authenticated keepalive request is added.

## Verification boundary

The current adapter recognizes only the known `suis.sabanciuniv.edu/prod/` Banner registration namespace. The trial URL has not been supplied, and production markup has not been verified. Tests use synthetic forms and simulated Chrome APIs. Passing them is not a claim of live trial compatibility.

Next live work: obtain the trial URL; inspect the login, term, Add/Drop and result pages; verify autofill; then implement one explicitly armed registration submission with success/error reconciliation. Credentials should remain with the browser password manager. Expired sessions and CAPTCHA/2FA require normal authentication; no session timeout bypass is planned.
