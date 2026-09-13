# Distribution and online architecture

## Ready in this release

- Source with a `.gitignore` for standard personal-state files.
- Network-free Python, UI and extension tests; a GitHub Actions workflow to run them after upload.
- `scripts/build_release.py`, which creates a release from an explicit source allowlist.
- `extension-package.zip` inside the delivered archive: runtime extension files with `manifest.json` at ZIP root.
- `PRIVACY.md` describing the actual data flow.

Source repository: https://github.com/xxvxxvxxvxxv/sabanci-registration-sniper. The Test and release workflow publishes the v0.6.2 prerelease after tests pass on main. No Pages deployment or Web Store listing is included. No general source license has been selected. The bundled font keeps its existing license.

## GitHub release: existing architecture

Upload the source to a chosen repository after reviewing the staged files. Never upload an existing working directory containing personal data blindly. The generated release ZIP is suitable for friends: each person runs their own Python app, keeps their own plan, pairs their own phone if desired, and loads their own local extension copy.

Check the repository Actions page for the hosted test and release result. Local checks have run. It does not perform live university requests or use secrets.

## A URL that opens an app with local private data

The intended online architecture is feasible, but it is a separate migration:

1. GitHub Pages serves static HTML, CSS, JavaScript and public catalog data.
2. The browser stores the private plan in IndexedDB, scoped to that browser/profile/site origin, without uploading it to a shared database.
3. A installed extension performs explicitly enabled public seat checks, stores watch state locally, provides notifications and hosts the persistent side panel. Python responsibilities must be ported and tested there.
4. Site-to-extension communication must use an exact published origin allowlist, a small validated message schema, user-controlled pairing and no arbitrary URLs or arbitrary script execution.
5. Phone delivery remains optional and necessarily sends a message to its provider.

An intermediate alternative can retain Python as a local companion, but the public site must connect through a specifically authorized extension bridge. Version 0.6.2 does **not** implement that public-site bridge.

Do not simply deploy the current `index.html` as a working app: it expects a localhost Python API. GitHub Pages is static hosting and does not execute that backend. A plain web page also cannot promise continuous checks after its tab is closed. This release keeps those limitations explicit rather than showing an online monitor that does not work.

Source: [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Extension distribution

Immediate sharing: extract the app ZIP, open Chrome's Extensions page, enable Developer mode and Load unpacked → `extension/`. Disable the old extension before loading a new folder to avoid duplicate icons.

The browser action opens a global side panel using Chrome's supported Side Panel API. A click elsewhere on the page does not dismiss it. Switching tabs clears a prepared field preview. Chrome 116+ is required. Live SUIS form filling is still deferred; the adapter only recognizes the bundled localhost mock form.

For Web Store distribution, use the included `extension-package.zip` as the code package. Publication additionally needs the owner's developer account, listing assets, accurate privacy declarations, test instructions and review. The ZIP has not been submitted, and store approval is not guaranteed. The listing must clearly describe the required local companion and mock-only filling until real form support exists.

Sources: [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [Publish in Chrome Web Store](https://developer.chrome.com/docs/webstore/publish).
