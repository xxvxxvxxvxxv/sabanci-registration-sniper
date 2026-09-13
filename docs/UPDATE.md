# Apply this update

1. Extract `registration-sniper-update.zip` and upload its contents into the existing repository root with GitHub's Add file → Upload files. Preserve the web/ and docs/ directories.
2. Delete `docs/images/timetable.png` from GitHub separately. Uploading an archive's extracted contents does not delete old files. This is the personal browser screenshot; README now uses only the generated banner.
3. Commit the update. Cloudflare's connected main-branch build should redeploy the website. If no build starts, use Retry build in Cloudflare.
4. In the repository About gear, apply the description, Website and topics from `docs/GITHUB-ABOUT.md`.
5. Reload the website. Enable Sound again if desired. The queued-feed status now clears after recovery and no longer appears as a red error.

This patch does not contain wrangler.jsonc and therefore does not overwrite the deployed D1 database ID. No extension behavior is changed.

Deleting a screenshot from the current branch does not purge its Git history or previously published download copies. Review those separately before treating it as fully removed from public access.
