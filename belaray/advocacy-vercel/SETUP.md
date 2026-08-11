# Advocacy Letter API — Vercel Setup (recommended, since you already use Vercel)

> **Ready-to-upload copy:** the `erx1-anthropic-conneciton/` folder at the repo root
> contains these same functions pre-arranged as `api/savemydoctors/letter.js` +
> `api/savemydoctors/stats.js` with step-by-step instructions in its README-UPLOAD.md.
> Use that folder for the actual upload to the Invest repo; this folder is the
> reference/documentation copy.

The letter tool at `keepmydoctors.com/belaray/advocate.html` calls a tiny server
endpoint that holds your Anthropic API key. Two ways to host it on Vercel:

## Option A — Add to your existing Invest project (fastest, ~2 minutes)

Your `IngenioCraft/Invest` repo already has `ANTHROPIC_API_KEY` configured in Vercel,
so you can reuse it directly:

1. Copy `api/belaray-letter.js` from this folder into the Invest repo's `api/` folder
   (create the folder at the repo root if it doesn't exist — for Next.js apps, put it
   in `pages/api/` or use an `api/` folder at the root, both work on Vercel).
2. Commit and push. Vercel deploys automatically.
3. Your endpoint is now: `https://<your-invest-project>.vercel.app/api/belaray-letter`
4. Open `belaray/advocate.html` in this repo, find near the top of the `<script>`:

   ```js
   const WORKER_URL = "";
   ```

   and set it to your endpoint:

   ```js
   const WORKER_URL = "https://<your-invest-project>.vercel.app/api/belaray-letter";
   ```

5. Push the KeepMyDoctors site. Done.

> Note: the function only accepts requests from keepmydoctors.com (CORS), so it won't
> interfere with anything in the Invest app.

## Option B — Separate tiny Vercel project (cleaner separation)

Vercel env vars are **per-project**, so a new project won't see Invest's key
automatically — but the same key value can be used in both places (same Anthropic
account, same billing):

1. Make a new repo (or folder deployed via Vercel CLI) containing just `api/belaray-letter.js`.
2. Import it in Vercel → new project.
3. Project → Settings → Environment Variables → add `ANTHROPIC_API_KEY` = your key
   (copy the value from console.anthropic.com or from the Invest project's settings).
4. Deploy, grab `https://<project>.vercel.app/api/belaray-letter`, and paste it into
   `WORKER_URL` in `advocate.html` as above.

## Optional: staff stats dashboard

`api/belaray-stats.js` powers the staff dashboard at `keepmydoctors.com/belaray/stats.html`
(unlisted — share the URL with staff only). It reads the anonymous survey statistics out
of Plausible. To enable it, add these to the same Vercel project's environment variables:

- `PLAUSIBLE_API_KEY` — create at plausible.io → Account Settings → API Keys
- `PLAUSIBLE_SITE_ID` — `keepmydoctors.com` (default if unset)
- `STATS_PASS` — any passphrase you choose; staff type it into stats.html

Then on stats.html, enter the endpoint URL
(`https://<project>.vercel.app/api/belaray-stats`) and the passphrase once — the page
remembers them per device and shows: surveys completed, letters generated/sent, the key
network-adequacy percentages (couldn't get timely appointment, directory inaccuracies,
service unavailable, etc.), and full breakdowns of plan type, wait times, and distances.

## Important: match the env var name

The function reads `process.env.ANTHROPIC_API_KEY`. If your Invest project stored the
key under a different name (e.g. `ANTHROPIC_KEY` or `CLAUDE_API_KEY`), either rename it
in Vercel settings or change that one line in the function.

## Safety rails already built in

- CORS locked to keepmydoctors.com
- All free-text fields capped at 700 characters
- The AI prompt is assembled server-side — the page can't be abused as a general AI endpoint
- If the endpoint is down or not yet configured, the page automatically falls back to a
  built-in template letter, so patients are never stuck

Optional: in Vercel → Project → Firewall you can add a rate-limit rule (e.g. 5 requests
per minute per IP) to keep bots from running up API costs.

## Cost

Each generation is one Claude request (~$0.05–0.10). A few hundred patient letters ≈
tens of dollars. Watch usage at console.anthropic.com.

(The `../advocacy-worker/` folder has an equivalent Cloudflare Worker version if you
ever prefer that — you only need one of the two.)
