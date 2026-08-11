# Advocacy Letter Worker — 5-Minute Setup

The letter tool at `keepmydoctors.com/belaray/advocate.html` works two ways:

- **Without this worker**: it assembles a solid template letter in the browser (no AI, works today).
- **With this worker**: it calls Claude (your Anthropic API key) to write a fully custom,
  natural-sounding letter from each patient's answers. The key stays secret on Cloudflare —
  it is never visible in the web page.

## Deploy the worker (free, no coding tools)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it something like `belaray-advocate`, click **Deploy**, then **Edit code**.
3. Delete the sample code, paste the entire contents of `worker.js`, click **Deploy**.
4. Go to the worker's **Settings → Variables and Secrets** → **Add**:
   - Type: **Secret**
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from [console.anthropic.com](https://console.anthropic.com) (starts with `sk-ant-`)
5. Copy the worker's URL (looks like `https://belaray-advocate.YOURNAME.workers.dev`).
6. Open `belaray/advocate.html`, find the line near the top of the `<script>` section:

   ```js
   const WORKER_URL = "";
   ```

   and paste your URL between the quotes:

   ```js
   const WORKER_URL = "https://belaray-advocate.YOURNAME.workers.dev";
   ```

7. Commit/push the site. Done — the tool now uses AI letters, with the template as automatic fallback if the worker is ever unreachable.

## Recommended: rate limiting

To keep a bot from running up your Anthropic bill:

- Cloudflare dashboard → your worker's zone → **Security → WAF → Rate limiting rules** →
  create a rule limiting requests to the worker hostname to ~5 per minute per IP.

Also note the worker already:
- only accepts requests from `keepmydoctors.com` (CORS),
- caps every free-text field at 700 characters,
- builds the AI prompt server-side, so the page can't be abused as a general AI endpoint.

## Cost

Each letter generation is one Claude Opus request (~$0.05–0.10). A few hundred patient
letters ≈ tens of dollars. You can watch usage at console.anthropic.com.

## Privacy note

Patient answers are sent to Cloudflare and Anthropic to draft the letter and are not stored
by the worker. The page tells patients not to include DOB, medical record numbers, or
details they don't want in a letter. Standard API traffic to Anthropic is not used to train
models.
