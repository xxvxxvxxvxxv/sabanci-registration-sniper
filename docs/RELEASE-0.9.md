# Registration Sniper 0.9 — release handoff

## Included

- Existing Registration Sniper name and reticle retained; matching extension icons added.
- First-visit homepage. Returning browsers enter the planner directly.
- Initial loading mark with no minimum artificial delay; a Show page action and four-second failsafe prevent a stuck overlay.
- Major/credit-band selection and September 14 registration-day reference, illustrated extension guide and direct PDF link.
- Aimbot **prepare mode**: explicit arming, new opening + all-component availability, recognized navigation/semester choice, one verified fill, manual final submission.
- Store package, promotional assets, privacy page, listing draft and repository metadata.

## Upload

Extract the GitHub update ZIP and upload its contents to the repository root, preserving subfolders. It includes the website's downloadable extension ZIP. Cloudflare should redeploy using the existing connection. No D1 migration or database configuration change is required.

Reload the updated unpacked extension in Chrome. The extension version should read 0.9.0. Reconnect the website tab. Saved plans retain their existing storage keys and website origin.

The optional local Python UI receives the Registration Sniper name/logo. The new homepage and major/day UI are hosted-web features; Aimbot prepare mode requires the hosted planner's monitor.

Copy docs/GITHUB-METADATA.json fields into the repository's About settings. This update does not rename the repository or Cloudflare worker/address.

## Remaining, explicitly unfinished

- Trial URL and installed-Chrome/live SUIS verification.
- Automatic login, session renewal and final submission/result reconciliation.
- A real, privacy-clean store screenshot after verification.
- Authenticated GitHub metadata write and Chrome Web Store submission/review.

No published deployment, store listing or live registration was performed while preparing this package.
