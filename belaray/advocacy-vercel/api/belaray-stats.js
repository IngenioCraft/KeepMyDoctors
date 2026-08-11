/**
 * Belaray Advocacy Campaign Stats — Vercel serverless function
 * ------------------------------------------------------------
 * Aggregates the anonymous survey_stats events from Plausible into the
 * numbers the staff dashboard (belaray/stats.html) displays:
 * surveys completed, letters sent, and percentage breakdowns per question.
 *
 * Setup (Vercel → Project → Settings → Environment Variables):
 *   PLAUSIBLE_API_KEY   — create at plausible.io → Account Settings → API Keys
 *   PLAUSIBLE_SITE_ID   — "keepmydoctors.com" (default if unset)
 *   STATS_PASS          — any passphrase you choose; staff enter it on stats.html
 *
 * Drop this file next to belaray-letter.js in the api/ folder and deploy.
 * Endpoint: https://<project>.vercel.app/api/belaray-stats?key=<STATS_PASS>
 */

const PROPS = [
  "plan", "county", "years_patient", "offices_called", "wait_quoted", "distance",
  "family_beyond_self", "three_generations", "skin_cancer_care", "surveillance",
  "chronic_or_biologic", "coordinates_care", "avoided_er", "directory_inaccurate",
  "could_not_get_timely_appt", "transport_hardship", "cannot_afford_oop",
  "other_language", "phototherapy", "hair_loss", "mohs_recon_same_day",
  "service_unavailable",
];

const CAMPAIGN_START = "2026-08-01";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.STATS_PASS || req.query.key !== process.env.STATS_PASS) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!process.env.PLAUSIBLE_API_KEY) {
    return res.status(500).json({ error: "PLAUSIBLE_API_KEY not configured" });
  }

  const site = process.env.PLAUSIBLE_SITE_ID || "keepmydoctors.com";
  const dateRange = [CAMPAIGN_START, new Date().toISOString().slice(0, 10)];

  const query = async (body) => {
    const r = await fetch("https://plausible.io/api/v2/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PLAUSIBLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ site_id: site, date_range: dateRange, ...body }),
    });
    if (!r.ok) throw new Error(`Plausible ${r.status}: ${await r.text()}`);
    return r.json();
  };

  try {
    const surveys = await query({
      metrics: ["events"],
      filters: [["is", "event:name", ["survey_stats"]]],
    });
    const sent = await query({
      metrics: ["events"],
      filters: [["is", "event:name", ["letter_sent"]]],
    });
    const generated = await query({
      metrics: ["events"],
      filters: [["is", "event:name", ["generate_letter"]]],
    });

    const breakdowns = {};
    for (const p of PROPS) {
      try {
        const r = await query({
          metrics: ["events"],
          filters: [["is", "event:name", ["survey_stats"]]],
          dimensions: [`event:props:${p}`],
        });
        breakdowns[p] = (r.results || []).map((row) => ({
          value: row.dimensions[0],
          count: row.metrics[0],
        }));
      } catch (e) {
        breakdowns[p] = [];
      }
    }

    return res.status(200).json({
      since: CAMPAIGN_START,
      surveys: surveys.results?.[0]?.metrics?.[0] ?? 0,
      lettersGenerated: generated.results?.[0]?.metrics?.[0] ?? 0,
      lettersSent: sent.results?.[0]?.metrics?.[0] ?? 0,
      breakdowns,
    });
  } catch (e) {
    console.error("Stats error", e && e.message);
    return res.status(502).json({ error: "stats_fetch_failed", detail: String(e && e.message) });
  }
}
