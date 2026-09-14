# Seat monitor scheduling fix

## Install

1. Extract this ZIP and upload its web and docs folders into the GitHub repository root, replacing the matching files. Upload the contents, not the ZIP itself.
2. Wait for the Cloudflare deployment to succeed.
3. Reload the website, start monitoring and check that HUM 207 (10690) and HUM 207D (10693) receive first-check timestamps. Shared feed load may still delay observations.

Database configuration, plans and extension files are not included in this patch.

## Change

Select the oldest due CRN instead of the first due entry in list order. Previously, pending retries could repeatedly select early entries while later CRNs never received a first check. The existing request interval, upstream gate and access-block handling remain in effect.

Phone settings now explicitly explain the alert trigger: a watched section changes from full to available. The initial reading establishes a baseline; already-open seats and routine checks do not send messages. A successful test message confirms Telegram delivery, not a real seat-opening event. The monitoring tab must remain open on an awake device, with phone alerts enabled in that same tab.

## Verification

The new regression failed before the scheduling fix and passes after it. Tests cover all nine CRNs being requested despite pending responses, first readings for HUM 207/D, and automatic Telegram delivery on a simulated zero-to-positive transition. Also verified: no initial alert, no repeated alert while a section stays open, opt-out, generic message privacy, and visible delivery errors. Telegram HTTP is mocked; no real messages or university requests were sent during these tests. Existing browser and database-queue tests pass.
