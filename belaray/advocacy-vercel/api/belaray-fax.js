/**
 * Belaray fax advocacy — Vercel serverless function
 * -------------------------------------------------
 * Two modes:
 *
 * 1) Batch (the one-tap "send my letters" panel):
 *    POST { recipients: ["assembly-15","senate-5","healthfirst"],
 *           letters: { "assembly-15": "...", ... },
 *           labels: { "assembly-15": "Assemblyman Jake Blumencranz, 15th Assembly District", ... },
 *           patientName, patientTown, patientContact, planType }
 *
 * Legislator recipient ids are "assembly-<district>" / "senate-<district>",
 * where <district> is the real NY legislative district number the page
 * discovers live (via NY State's own GIS district-boundary service) from the
 * patient's ZIP — not a hand-picked region. `labels` is cosmetic text for the
 * fax cover page only; the fax NUMBER always comes from this file's own
 * district-keyed tables below, never from the client.
 *
 * 2) Legacy single grievance (kept for the per-card fax button):
 *    POST { letterText, patientName, patientTown, patientContact, planType }
 *
 * Letters are rendered as simple PDFs (no dependencies) with a cover page
 * naming the patient and their reply contact, then sent via Sinch Fax API v3.
 * Destinations are ONLY ever chosen from the server-side whitelist below, so
 * this endpoint can never be used as an open fax relay.
 *
 * Env vars (Vercel → Project → Settings → Environment Variables):
 *   SINCH_PROJECT_ID                          — Sinch project ID (dashboard URL / overview)
 *   SINCH_KEEPMYBELARAYDOCTORS_ACCESS_KEY     — Sinch access key ID
 *   SINCH_KEEPMYBELARAYDOCTORS_SECRET         — Sinch access key secret
 *   SINCH_FAX_FROM                            — optional; a Sinch fax number you own, E.164
 *   FAX_TEST_TO                               — optional; overrides EVERY destination for testing.
 *                                               DELETE it (and redeploy) to go live.
 */

const ALLOWED_ORIGINS = [
  "https://keepmydoctors.com",
  "https://www.keepmydoctors.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

// Healthfirst is the one fixed destination (Appeals & Grievances Dept, per
// Healthfirst's own forms).
const HEALTHFIRST_REC = {
  fax: "+16463134618",
  label: "Healthfirst Appeals and Grievances Department",
  kind: "grievance",
};

// Legislator fax numbers, verified by the practice and keyed by the REAL NY
// legislative district number — not by ZIP or region nickname. The page now
// discovers a patient's district live from New York State's own GIS district
// service (any address in the state, not just hand-mapped neighborhoods),
// then asks this endpoint to fax "assembly-<district>" / "senate-<district>".
// A district with no entry here simply has no fax option — add a line here
// (and nowhere else) once that office's fax number is confirmed.
// Sourced from each member's own assembly.state.ny.us / nyassembly.gov
// contact page (district office fax, not the Albany office) unless noted.
// Districts with no comment marker below have no fax published on their
// official page as of Aug 2026 — those offices are email/DFS-portal only
// until a phone call turns up a number.
const ASSEMBLY_FAX = {
  1: "+16317252372", // Schiavoni
  2: "+16317270426", // Giglio
  3: "+16317321798", // DeStefano
  4: "+16317510280", // Kassay
  5: "+16315850310", // Smith
  6: "+16314353239", // Ramos, called by the practice Aug 2026
  7: "+16315890487", // Gandolfo
  8: "+16317243024", // Fitzpatrick
  9: "+15165414625", // Durso
  10: "+16314245984", // Stern, called by the practice Aug 2026
  11: "+16319572998", // O'Pharrow
  12: "+16312612992", // Brown
  13: "+15166760071", // Lavine
  14: "+15164092073", // McDonough
  15: "+15169373632", // Blumencranz
  17: "+15167950496", // Mikulin
  18: "+15165383155", // Burroughs, called by the practice Aug 2026
  19: "+15165354097", // Ra
  20: "+15162952498", // A. Brown
  21: "+15165618223", // Griffin, called by the practice Aug 2026
  22: "+15165993768", // Solages
  // 16 (Norber) intentionally has no entry: office says they have no fax —
  // the practice plans to call back and try again later.
  23: "+17189459549", // Pheffer Amato
  24: "+17184543178", // Weprin
  25: "+17188200414", // Rozic, called by the practice Aug 2026
  26: "+17183575947", // Braunstein
  27: "+17189698326", // Berger
  28: "+17182635688", // Hevesi, called by the practice Aug 2026
  30: "+17186513027", // Raga
  33: "+17184647128", // Vanel
  34: "+17183358254", // González-Rojas
  35: "+17184573640", // Hooks
  37: "+17184720648", // Valdez
  38: "+17188050953", // Rajkumar
  39: "+17184782371", // Cruz
  40: "+17189391238", // Kim
  42: "+17189400154", // Bichotte Hermelyn
  43: "+17187713276", // Cunningham
  44: "+17189659378", // R. Carroll
  46: "+17182665391", // Brook-Krasny
  48: "+17184365734", // Eichenstein
  49: "+17182340986", // Chang
  51: "+17187654186", // Mitaynes
  53: "+17184431424", // Davila
  54: "+17183864575", // Dilan
  55: "+17183421258", // Walker
  59: "+17182522417", // J. Williams
  60: "+17182572590", // Lucas
};
const SENATE_FAX = {
  1: "+16317272905", // Palumbo
  2: "+16313615367", // Mattera
  3: "+16312891035", // Murray
  4: "+16313829861", // Martinez
  5: "+15167311751", // Rhoads
  6: "+15167477430", // Bynoe
  7: "+15167470203", // Martins
  9: "+15167668011", // Canzoneri-Fitzpatrick
  // 8 (Weik) intentionally has no entry: office confirmed by phone they have
  // no working fax.
  10: "+17185233670", // Sanders
  11: "+17184458398", // Stavisky
  12: "+17184408368", // Gianaris
  13: "+17182054145", // Ramos
  14: "+17184540186", // Comrie, confirmed with the practice Aug 2026
  15: "+17182960495", // Addabbo
  16: "+17183573491", // Liu, confirmed with the practice Aug 2026
  17: "+17182382468", // Chan
  19: "+17186497661", // Persaud
  20: "+17182823585", // Myrie
  21: "+17186296420", // Parker
};

// Resolves a recipient id to a destination. The fax NUMBER always comes from
// the tables above (never from the client); `clientLabel` is cosmetic text
// for the cover page only — worst case a wrong label, never a wrong fax.
function resolveRecipient(id, clientLabel) {
  if (id === "healthfirst") return HEALTHFIRST_REC;
  const m = /^(assembly|senate)-(\d{1,3})$/.exec(String(id || ""));
  if (!m) return null;
  const chamber = m[1];
  const district = parseInt(m[2], 10);
  const fax = (chamber === "assembly" ? ASSEMBLY_FAX : SENATE_FAX)[district];
  if (!fax) return null;
  const fallbackLabel = (chamber === "assembly" ? "Assembly District " : "Senate District ") + district;
  return { fax, label: String(clientLabel || "").trim().slice(0, 120) || fallbackLabel, kind: "legislator" };
}

const MAX_LETTER_CHARS = 8000;
const MAX_BATCH = 4;

// Best-effort per-instance rate limit (serverless instances don't share
// memory, so this is a speed bump, not a wall — fine for this use).
const RATE_LIMIT = 3; // requests per window (a batch counts as one)
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
  const patientName = String(b.patientName || "").trim().slice(0, 120);
  const patientTown = String(b.patientTown || "").trim().slice(0, 80);
  const patientContact = String(b.patientContact || "").trim().slice(0, 120);
  const patientPhone = String(b.patientPhone || "").trim().slice(0, 30);
  const patientEmail = String(b.patientEmail || "").trim().slice(0, 120);
  const patientZip = String(b.patientZip || "").trim().slice(0, 10);
  const planType = String(b.planType || "").trim().slice(0, 80);

  // A fax with no reply path is easy to dismiss, and every fax leaves the
  // same sending number. Require a per-patient contact for the cover page.
  if (!patientContact) return res.status(400).json({ error: "contact_required" });

  const patient = { patientName, patientTown, patientContact, patientPhone, patientEmail, patientZip, planType };
  const creds = { projectId, keyId, keySecret };

  // ---- Batch mode -----------------------------------------------------
  if (Array.isArray(b.recipients)) {
    const wanted = [...new Set(b.recipients.map(String))].slice(0, MAX_BATCH);
    const lettersIn = b.letters && typeof b.letters === "object" ? b.letters : {};
    const labelsIn = b.labels && typeof b.labels === "object" ? b.labels : {};
    if (!wanted.length) return res.status(400).json({ error: "no_recipients" });

    const results = [];
    for (const id of wanted) {
      const rec = resolveRecipient(id, labelsIn[id]);
      const letter = String(lettersIn[id] || "").trim().slice(0, MAX_LETTER_CHARS);
      if (!rec || !rec.fax) {
        results.push({ recipient: id, ok: false, error: "unknown_or_no_fax" });
        continue;
      }
      if (letter.length < 40) {
        results.push({ recipient: id, ok: false, error: "letter_too_short" });
        continue;
      }
      const pdf = buildPdf(coverFor(rec, patient), letter);
      // Sequential on purpose: gentler on the fax API, and per-recipient
      // failures stay isolated.
      const sent = await sendFax(creds, rec.fax, pdf, `${id}.pdf`);
      results.push({ recipient: id, ok: sent.ok, id: sent.id || null, detail: sent.detail });
    }

    const allOk = results.every((r) => r.ok);
    console.log("fax_batch", JSON.stringify({ ip, results }));
    try {
      await sheetAppend([
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        "fax_batch",
        patientName, patientTown, planType, patientContact, "",
        JSON.stringify(results).slice(0, 45000),
        "",
      ]);
    } catch (e) { console.error("sheet log failed", e && e.message); }
    return res.status(200).json({ ok: allOk, results });
  }

  // ---- Legacy single-grievance mode -----------------------------------
  const letterText = String(b.letterText || "").trim().slice(0, MAX_LETTER_CHARS);
  if (letterText.length < 40) return res.status(400).json({ error: "letter_too_short" });

  const rec = HEALTHFIRST_REC;
  const pdf = buildPdf(coverFor(rec, patient), letterText);
  const sent = await sendFax(creds, rec.fax, pdf, "grievance.pdf");
  if (!sent.ok) return res.status(502).json({ error: "fax_failed" });
  console.log("fax_queued", JSON.stringify({ id: sent.id || null }));
  try {
    await sheetAppend([
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
      "fax_single_grievance",
      patientName, patientTown, planType, patientContact, "",
      JSON.stringify({ id: sent.id || null }).slice(0, 45000),
      "",
    ]);
  } catch (e) { console.error("sheet log failed", e && e.message); }
  return res.status(200).json({ ok: true, id: sent.id || null });
}

/**
 * Append one row to the practice's campaign Google Sheet using a service
 * account (no npm dependencies: hand-rolled RS256 JWT + REST).
 * Env vars: GSHEET_ID (spreadsheet id), GSA_EMAIL (service account email),
 * GSA_KEY (service account private key; \n escapes are handled).
 * Silently no-ops if the env vars aren't configured.
 */
async function sheetAppend(row) {
  const sheetId = process.env.GSHEET_ID;
  const saEmail = process.env.GSA_EMAIL;
  let saKey = process.env.GSA_KEY;
  if (!sheetId || !saEmail || !saKey) return;
  saKey = saKey.replace(/\\n/g, "\n");

  const { createSign } = await import("node:crypto");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: "RS256", typ: "JWT" }) + "." +
    b64({
      iss: saEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signature = createSign("RSA-SHA256").update(unsigned).sign(saKey).toString("base64url");

  const tokResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" + unsigned + "." + signature,
  });
  const tok = await tokResp.json().catch(() => ({}));
  if (!tok.access_token) {
    console.error("sheet token error", JSON.stringify(tok).slice(0, 300));
    return;
  }

  const appendResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        authorization: "Bearer " + tok.access_token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!appendResp.ok) {
    console.error("sheet append error", appendResp.status, (await appendResp.text()).slice(0, 300));
  }
}

/* ---------- cover pages ---------- */

function fmtPhone(s) {
  const d = String(s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : String(s || "");
}

function coverFor(rec, p) {
  const date = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric",
  });
  const who = rec.kind === "grievance" ? "member" : "constituent";
  const from = (p.patientName || "Healthfirst member") +
    (p.patientTown ? ", " + p.patientTown + ", NY" + (p.patientZip ? " " + p.patientZip : "") : "");

  // Clearly labeled reply channels, so nobody tries to fax a cell number.
  const replyLines = [];
  if (p.patientPhone) replyLines.push({ t: "Cell phone (call or text this " + who + "): " + fmtPhone(p.patientPhone) });
  if (p.patientEmail) replyLines.push({ t: "Email this " + who + ": " + p.patientEmail });
  if (!p.patientPhone && !p.patientEmail && p.patientContact) {
    replyLines.push({ t: "Reply to this " + who + " at: " + p.patientContact });
  }
  if (process.env.SINCH_FAX_FROM) {
    replyLines.push({ t: "Written replies by fax: " + fmtPhone(process.env.SINCH_FAX_FROM) + " (attn: " + (p.patientName || "the " + who + " above") + ")" });
  }

  if (rec.kind === "grievance") {
    return [
      { t: "FAX - MEMBER GRIEVANCE", b: true },
      { t: "" },
      { t: "To: " + rec.label },
      { t: "Fax: 1-646-313-4618  |  Mail: P.O. Box 5166, New York, NY 10274-5166" },
      { t: "From (Healthfirst member): " + from },
      ...replyLines,
      ...(p.planType ? [{ t: "Plan: " + p.planType }] : []),
      { t: "Date: " + date },
      { t: "Re: Formal member grievance - access to dermatology care (Belaray Dermatology)" },
      { t: "" },
      { t: "This fax was sent by the member named above, using an online tool" },
      { t: "that lets patients write and send their own letters." },
      { t: "Please log this as a formal grievance and provide a written response" },
      { t: "with a grievance reference number." },
      { t: "------------------------------------------------------------------" },
    ];
  }

  return [
    { t: "FAX - LETTER FROM A CONSTITUENT", b: true },
    { t: "" },
    { t: "To: " + rec.label },
    { t: "From (your constituent): " + from },
    ...replyLines,
    ...(p.planType ? [{ t: "Health plan: " + p.planType }] : []),
    { t: "Date: " + date },
    { t: "Re: Healthfirst network access to Belaray Dermatology" },
    { t: "" },
    { t: "This fax was sent by the constituent named above, using an online tool" },
    { t: "that lets patients write and send their own letters." },
    { t: "------------------------------------------------------------------" },
  ];
}

/* ---------- Sinch send ---------- */

async function sendFax(creds, destination, pdf, filename) {
  const to = process.env.FAX_TEST_TO || destination;
  if (process.env.FAX_TEST_TO) {
    console.warn("fax TEST MODE: sending to FAX_TEST_TO, not", destination, "->", to);
  }
  try {
    const form = new FormData();
    form.append("to", to);
    if (process.env.SINCH_FAX_FROM) form.append("from", process.env.SINCH_FAX_FROM);
    form.append("file", new Blob([pdf], { type: "application/pdf" }), filename);

    const apiResp = await fetch(
      `https://fax.api.sinch.com/v3/projects/${encodeURIComponent(creds.projectId)}/faxes`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64"),
        },
        body: form,
      }
    );
    const data = await apiResp.json().catch(() => ({}));
    if (!apiResp.ok) {
      const detail = apiResp.status + " " + JSON.stringify(data).slice(0, 400);
      console.error("Sinch fax error", detail);
      // Expose the provider error in the API response only while FAX_TEST_TO
      // (test mode) is set — never in production responses.
      return { ok: false, detail: process.env.FAX_TEST_TO ? detail : undefined };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("fax send error", e && e.message);
    return { ok: false, detail: process.env.FAX_TEST_TO ? String(e && e.message) : undefined };
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
    .replace(/ /g, " ")
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
