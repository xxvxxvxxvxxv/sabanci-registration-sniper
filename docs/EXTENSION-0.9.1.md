# Extension 0.9.1 — test build

Finds the planner automatically, keeps the selected CRNs current, and fills a recognized Add/Drop form when it becomes the active tab. The panel stays open during use. Only Copy CRNs is normally shown as a button; Open planner appears when needed. Autofill can be switched off. Aimbot remains optional and chooses the active SUIS tab automatically.

Local app port/key controls, localhost permission and the mock adapter are removed. Old session connection settings are cleared. Clipboard copying works with overlapping classes. Autofill still uses the planner checks and its overlap setting. Trial and production adapters require a matching term and keep their form destinations separate.

## Test

1. Disable the published 0.9.0 copy at chrome://extensions.
2. Extract registration-sniper-extension-0.9.1.zip. Enable Developer mode, choose Load unpacked, and select the extracted folder containing manifest.json.
3. Open your planner, then the extension side panel. Your selected CRNs should appear without connecting.
4. Sign in to SUIS and open Add/Drop for the same term. Recognized empty CRN fields fill automatically. Existing unrelated values are preserved.

This build does not click the final Submit button or claim registration success. Automatic submission and result handling require the actual SUIS Add/Drop form and response pages. A login page or No term available page is insufficient to implement that step. No automatic login or session renewal is included.

## Verification

Run `node --test extension/test-autofill.cjs`, `node extension/test-browser-flow.cjs` (after npm ci in web), and `npm test --prefix web`.

Tests passed for automatic discovery, DOM field writes/readback, changed forms, mismatched terms, trial/production isolation, copy despite preparation conflicts, closed planner recovery, and website regressions. Chrome APIs are simulated with JSDOM; no live SUIS registration or real-browser test has been performed.

The extension-only ZIP is ready for Load unpacked or a later Web Store upload. It has not been submitted to the store. The GitHub update ZIP contains source and tests; delete the obsolete extension/mock-adapter.js from the repository when applying it.
