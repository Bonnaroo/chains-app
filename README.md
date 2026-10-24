# chains-app — the Chains app (production)

**What this is:** the Chains disc golf app, served by GitHub Pages at https://bonnaroo.github.io/chains-app/
Score your rounds, names on every course, weekly challenges and 100 trophies, course leagues, friends, bags; plus the fantasy DGPT league (next season 2027).

**Files**
- `index.html` — the whole production app in one file (React, built with Claude Design). The code lives inside it as 72
  gzip+base64 blobs (`"data":"..."`), so plain text search finds nothing — decompress first (see CHAINS_SYSTEM.md §7).
  `CHAINS_VERSION = "vNNN"` is the version marker shown in the app's sidebar.
- `test.html` — staging copy. Deploy here first, verify, then copy to `index.html`. Read-only against the league database.
- `sw.js` — service worker (offline shell).
- `about.html` — the public landing page. `stickers/` — printable QR stickers (one per course, `#course=<id>`).
- `docs/` — deployment notes and lessons learned.

**Backends it talks to**
- Firebase `chains-fantasy` — the league (picks, scores, live feed, draft). Written by the Railway engine (repo `chains-poller`).
- Firebase `chains-app-f38f8` — accounts, friends, Go Throw rounds, bags, league codes.
- `chains-dgpt-data` (raw GitHub) — schedule, registered field, results, course and disc catalogs.
- `chains-dgpt-assets` (jsDelivr CDN) — avatars, hole art, emblem.

**Rules of the road:** never claim a change is live from a browser tab alone (CDN lags minutes) — verify the git blob, then the
URL, then a real session. Log every production deploy in `chains-agent-log/AGENT_LOG.md`.
