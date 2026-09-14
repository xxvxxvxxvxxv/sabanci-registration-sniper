# Time conflict override

On the website, open **CRNs** and enable **Allow time conflicts for this plan**. The preference is off by default and saved with the plan in this browser.

With the preference enabled, overlaps become warnings: CRN copying, extension autofill preparation, and Aimbot prepare mode can use the prepared list. Red timetable blocks and warning triangles remain visible. SUIS determines registration eligibility and any required permissions. Final submission remains manual.

Other preparation errors still block the list. Changing this preference increments the plan revision; refresh CRNs and preview again in the extension. Re-arm Aimbot after changing the plan. Importing a plan resets this preference to off.

## Install this website update

Extract the update ZIP and upload its web and docs folders into the GitHub repository root. Let Cloudflare deploy, then refresh the website. No extension update or Chrome Web Store resubmission is needed; this update works with extension 0.9.0.

## Validation

The web integration checks cover opt-in/off, persisted preference, visible overlap warnings, unchanged course selections, the released extension bridge, revision changes, and continued blocking of wrong-term and duplicate selections. Browser APIs and seat observations are simulated. Live SUIS form compatibility remains unverified.
