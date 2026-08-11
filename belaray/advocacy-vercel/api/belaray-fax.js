/**
 * Belaray fax-a-grievance — Vercel serverless function
 * ----------------------------------------------------
 * POST { letterText, patientName, patientTown }
 *
 * Renders the member's grievance letter as a simple PDF (no dependencies)
 * and faxes it to Healthfirst's Appeals & Grievances Department via the
 * Sinch Fax API v3. The destination number is hardcoded server-side so
 * this endpoint can never be used as an open fax relay.
 *
 * Env vars (Vercel → Project → Settings → Environment Variables):
 *   SINCH_PROJECT_ID                          — Sinch project ID (dashboard URL / overview)
 *   SINCH_KEEPMYBELARAYDOCTORS_ACCESS_KEY     — Sinch access key ID
 *   SINCH_KEEPMYBELARAYDOCTORS_SECRET         — Sinch access key secret
 *   SINCH_FAX_FROM                            — optional; a Sinch fax number you own, E.164
 */

const ALLOWED_ORIGINS = [
  "https://keepmydoctors.com",
  "https://www.keepmydoctors.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

// Healthfirst Appeals & Grievances Department fax (per Healthfirst's own
// AOR form and medicare-coverage page). Never accept a destination from
// the client. For end-to-end testing, set the env var FAX_TEST_TO to a fax
// number you control (e.g. the office fax) and every fax goes there instead;
// DELETE that env var (and redeploy) to go live against Healthfirst.
const HEALTHFIRST_FAX = "+16463134618";

const MAX_LETTER_CHARS = 8000;

// Best-effort per-instance rate limit (serverless instances don't share
// memory, so this is a speed bump, not a wall — fine for this use).
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader(
    "Access-Control-Allow-Origin",
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const projectId = process.env.SINCH_PROJECT_ID;
  const keyId = process.env.SINCH_KEEPMYBELARAYDOCTORS_ACCESS_KEY;
  const keySecret = process.env.SINCH_KEEPMYBELARAYDOCTORS_SECRET;
  if (!projectId || !keyId || !keySecret) {
    console.error("fax: missing Sinch env vars");
    return res.status(500).json({ error: "fax_not_configured" });
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too_many_requests" });

  const b = req.body || {};
  const letterText = String(b.letterText || "").trim().slice(0, MAX_LETTER_CHARS);
  const patientName = String(b.patientName || "").trim().slice(0, 120);
  const patientTown = String(b.patientTown || "").trim().slice(0, 80);
  const patientContact = String(b.patientContact || "").trim().slice(0, 120);
  const planType = String(b.planType || "").trim().slice(0, 80);
  if (letterText.length < 40) return res.status(400).json({ error: "letter_too_short" });
  // A grievance with no reply path is easy to dismiss, and every fax leaves
  // the same sending number. Require a per-patient contact for the cover page.
  if (!patientContact) return res.status(400).json({ error: "contact_required" });

  const date = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric",
  });
  const cover = [
    { t: "FAX - MEMBER GRIEVANCE", b: true },
    { t: "" },
    { t: "To: Healthfirst Appeals and Grievances Department" },
    { t: "Fax: 1-646-313-4618  |  Mail: P.O. Box 5166, New York, NY 10274-5166" },
    { t: "From: " + (patientName || "Healthfirst member") + (patientTown ? ", " + patientTown + ", NY" : "") },
    { t: "Reply to this member at: " + patientContact },
    ...(planType ? [{ t: "Plan: " + planType }] : []),
    { t: "Date: " + date },
    { t: "Re: Formal member grievance - access to dermatology care (Belaray Dermatology)" },
    { t: "" },
    { t: "This fax was sent by the member named above, using an online tool at" },
    { t: "keepmydoctors.com that lets patients write and send their own letters." },
    { t: "Please log this as a formal grievance and provide a written response" },
    { t: "with a grievance reference number." },
    { t: "------------------------------------------------------------------" },
  ];

  const pdf = buildPdf(cover, letterText);

  const destination = process.env.FAX_TEST_TO || HEALTHFIRST_FAX;
  if (process.env.FAX_TEST_TO) {
    console.warn("fax TEST MODE: sending to FAX_TEST_TO, not Healthfirst:", destination);
  }

  try {
    const form = new FormData();
    form.append("to", destination);
    if (process.env.SINCH_FAX_FROM) form.append("from", process.env.SINCH_FAX_FROM);
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "grievance.pdf");

    const apiResp = await fetch(
      `https://fax.api.sinch.com/v3/projects/${encodeURIComponent(projectId)}/faxes`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
        },
        body: form,
      }
    );

    const data = await apiResp.json().catch(() => ({}));
    if (!apiResp.ok) {
      console.error("Sinch fax error", apiResp.status, JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: "fax_failed" });
    }

    console.log("fax_queued", JSON.stringify({ id: data.id || null, pages: null }));
    return res.status(200).json({ ok: true, id: data.id || null });
  } catch (e) {
    console.error("fax function error", e && e.message);
    return res.status(502).json({ error: "fax_failed" });
  }
}

/* ---------- minimal dependency-free PDF (Letter, Helvetica) ---------- */

function pdfEscape(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Fold to WinAnsi-safe characters; Helvetica can't render non-Latin glyphs.
function toLatin1(s) {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x0A\x20-\xFF]/g, "?");
}

function wrapText(text, width) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += " " + word;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

function buildPdf(coverLines, bodyText) {
  const lines = coverLines.map((l) => ({ t: toLatin1(l.t || ""), b: !!l.b }));
  lines.push({ t: "", b: false });
  for (const t of wrapText(toLatin1(bodyText), 88)) lines.push({ t, b: false });

  const LINES_PER_PAGE = 40;
  const pages = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }

  // Object layout: 1 Catalog, 2 Pages, 3 F1 (Helvetica), 4 F2 (Bold),
  // then for page i: object 5+2i is the Page, 6+2i its content stream.
  const kids = pages.map((_, i) => `${5 + 2 * i} 0 R`).join(" ");
  let out = "%PDF-1.4\n";
  const offsets = [];
  const addObj = (n, body) => {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${body}\nendobj\n`;
  };

  addObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  addObj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  addObj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  pages.forEach((pageLines, i) => {
    const pageNum = 5 + 2 * i;
    const contentNum = pageNum + 1;
    addObj(pageNum,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
      `/Contents ${contentNum} 0 R >>`);
    const stream =
      "BT\n72 720 Td\n16 TL\n" +
      pageLines
        .map((l) => `${l.b ? "/F2 13" : "/F1 11"} Tf (${pdfEscape(l.t)}) Tj T*`)
        .join("\n") +
      "\nET";
    addObj(contentNum, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const total = 4 + 2 * pages.length;
  const xrefPos = out.length;
  out += `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= total; n++) {
    out += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  }
  out += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(out, "latin1");
}
