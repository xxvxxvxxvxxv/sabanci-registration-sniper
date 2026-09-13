# Verification record

## Confirmed

- User smoke test on the Cloudflare deployment: catalog displayed, a selected course survived reload, public seat counts loaded, and the sound test played.
- Python suite: 79 tests passed.
- Extension core: 10 tests passed.
- Desktop DOM suites: planning, monitoring controls, alert deduplication, mock-form fill/rollback and side-panel navigation invalidation passed.
- Web behavior and SQLite queue checks passed, including plan storage, atomic imports, overlap colors, stale revision rejection, simulated full-to-open transitions, and request destinations.
- Regression check: a queued-feed banner clears after recovery and does not erase an unrelated notification error.
- Cloudflare Wrangler dry-run bundle succeeded.

## Remaining live checks

- Grant desktop notification permission and verify delivery from a real opening event.
- Pair a personal Telegram bot on the deployed website and send its test message. Local-app pairing is separate.
- Observe a genuine full-to-open transition. Unit tests simulate this transition; public seat retrieval alone does not verify delivery end to end.
- Real SUIS form autofill and hosted-site-to-extension integration are not implemented. Mock-form checks do not establish either feature.

The running website must keep its tab open and device awake. Sound is opt-in and needs enabling again after reload. Counts can lag due to the polling interval, shared cache and queue. No live timing benchmark or maximum delivery latency is claimed.
