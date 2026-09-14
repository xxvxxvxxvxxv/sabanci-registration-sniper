# Extension 0.8 and timetable fit view

## Update the website

Upload the extracted contents of the update ZIP into the GitHub repository root, replacing matching files. Wait for the Cloudflare deployment and reload the website. This patch also includes the earlier seat-monitor scheduling fix. It does not contain the database configuration or personal data.

The timetable defaults to **Fit day**. Switch to **Detailed** to show full card details with vertical scrolling. The choice stays in this browser. Compact cards show the course and time; hover for section, CRN and room details. Overlaps retain red cards, warning triangles and separate columns.

## Update the extension

1. Download the extension ZIP from the website's Extension dialog, or use the separate extension ZIP supplied with this update.
2. Extract it into a permanent folder on the computer.
3. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**, selecting the extracted folder containing `manifest.json`. If replacing files in an already installed extension folder, click its Reload button instead.
4. Open the hosted Registration Sniper website and the extension's side panel. Select **Use this website tab**.
5. The prepared CRNs appear in the side panel. **Copy CRNs** re-reads the source tab before copying, including when another tab is active. Keep the source tab open.

The updated extension requests access to the exact hosted app origin and clipboard writing, in addition to its existing local-app and side-panel permissions. Version 0.8 also requests access to the exact SUIS origin for CRN autofill. It does not request blanket website access. The website origin is fixed in `extension/web-source.js` and `manifest.json`; update both if moving to a custom domain.

## Verify on Chrome

- Load a valid prepared plan and check the term, count and CRNs.
- Switch to another tab: the side panel and list remain available.
- Change the plan in the source tab, then Copy CRNs: the copied list must match the latest saved plan.
- Reload or close the source tab: stale values must not be copied. Refresh CRNs after the page finishes loading, or connect to the new tab.
- Local app users can still connect with the local port and bridge key. Mock preview/fill remains available.

## Implementation status

Website transfer, fresh-plan copying, tab navigation, source-origin restrictions and revision changes pass automated tests with simulated Chrome APIs. Existing mock autofill tests pass. Installed-Chrome testing must still be completed by the user. Version 0.8 includes a guarded SUIS autofill adapter tested against sample forms; actual live form compatibility remains unverified. See [Autofill setup](AUTOFILL.md). No login or registration submission is performed.

## Monitoring architecture

On the hosted website, Cloudflare fetches public university pages through a shared cache and queue. Each user's open browser requests observations, detects seat openings, plays sound and optionally sends Telegram messages directly. There is no always-running server-side monitor or Telegram dispatcher in this release. Closing the monitoring tab or sleeping the device stops that user's alerts. The original Python version fetches public university pages from the user's own computer.
