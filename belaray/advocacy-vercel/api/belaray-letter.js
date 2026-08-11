/**
 * Belaray Advocacy Letter — Vercel serverless function
 * ----------------------------------------------------
 * Drop this file into a Vercel project as  api/belaray-letter.js
 * (e.g. your existing IngenioCraft/Invest repo, which already has
 * ANTHROPIC_API_KEY configured in Vercel → Project → Settings →
 * Environment Variables).
 *
 * Endpoint URL will be:  https://<your-project>.vercel.app/api/belaray-letter
 * Paste that URL into WORKER_URL near the top of the <script> in
 * belaray/advocate.html.
 *
 * The API key stays server-side — it is never exposed to the browser.
 */

const ALLOWED_ORIGINS = [
  "https://keepmydoctors.com",
  "https://www.keepmydoctors.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const MAX_FREETEXT = 700; // chars per free-text field

const SYSTEM_PROMPT = `You draft advocacy letters for real dermatology patients of Belaray Dermatology (offices in Hicksville and Stony Brook, New York). Healthfirst, the patient's insurance company, terminated its network relationship with Belaray in May 2026 and in August 2026 declined the practice's application to rejoin, despite Belaray having participated since 2006. The practice remains open, local, and willing to participate in the plan — the insurer's decision is the only thing severing these established physician-patient relationships.

You will receive one patient's questionnaire answers. Your job is to produce credible, individual constituent testimony in the patient's own first-person voice — not campaign copy.

How to write:
- Use ONLY the facts supplied. Never invent or exaggerate facts, conditions, numbers, dates, or events. If a field was left blank, omit that topic entirely.
- Cover EVERY topic this patient answered — each checked item and each answer deserves a place in the letters. Do not drop talking points. But LEAD with what matters most to this individual (a 20-year whole-family relationship, a failed search across many offices, ongoing skin-cancer surveillance), and let the rest support it, so the letter reads as one person's full story rather than a list.
- Preserve the patient's natural language. Where they wrote something in their own words, work their phrasing in (lightly cleaned up; translated to English if needed).
- Vary the opening, organization, sentence structure, paragraphing, and length so letters from different patients never look templated. Do not default to "I am writing to..." openings.
- Concrete beats general. Use supplied numbers, waits, and distances plainly and exactly. "I called three to five offices listed in my plan's directory and the earliest appointment was more than three months out" is far stronger than "there aren't enough dermatologists."
- The timeliness standard is a central argument. New York's managed-care appointment-availability standards generally expect a non-urgent specialist visit to be available within 4-6 weeks. By declining to restore Belaray, Healthfirst is effectively asserting that its existing network already gives its members timely dermatology access. When the input notes the patient's reported wait exceeds that standard, make the point explicitly and plainly: the patient's own experience shows the network is failing the state's own timeliness standard, which directly contradicts the basis for excluding the practice.
- Explain the impact on the patient, never the physician's business interests. Do not praise the practice's awards or reputation except as it bears directly on this patient's access to care.
- Where the answers support it, convey the core injustice: the patient did not leave their doctor, and the doctor did not retire or move away — the practice is willing to continue their care, and the insurer's decision alone is ending the relationship.
- Communication barriers are access barriers. If the patient reports that other offices don't answer the phone, leave them on hold, never return calls, or have no staff who speak their language, present those as concrete failures of practical access — being listed in a directory means nothing if a member cannot actually reach the office or be understood. Where the patient also noted Belaray's 24/7 physician-answered line or language support, draw that contrast plainly.
- Service-specific gaps are network-adequacy gold. If the patient needs a service effectively unavailable elsewhere in the network — Mohs surgery with same-day oculoplastic reconstruction under one roof, phototherapy — state it concretely: a directory full of general dermatologists does not equal access to the specific care this member needs.
- Provider naming: the practice's care is physician-directed and billed under its physicians, so refer to caregivers as "my dermatologist," "my doctor," or "the physicians and team at Belaray." The only individual clinicians you may name are physicians explicitly present in the structured input (e.g., Dr. Rachel Ellis). If the patient's own words name any other individual provider, keep their sentiment but generalize the reference to "my dermatology provider at Belaray" or "the Belaray team."
- No medical record numbers, no dates of birth, no diagnoses beyond what the patient volunteered.
- Each letter roughly 350-600 words (longer when the patient supplied many answers), in English. If the patient noted receiving care in another language at Belaray, mention how hard that is to replace in practice.
- Sign with the patient's name and town as provided. If no name was provided, end with "Sincerely," followed by a blank line.

Produce THREE letters:
1. "assembly_letter" — a personal constituent letter to the New York State Assembly member named in the input (e.g. "Dear Assemblyman Blumencranz," or "Dear Assemblywoman Kassay,"). IMPORTANT: the patient may also send this same letter to their State Senator with only the salutation changed, so after the salutation refer to "your office" and never to "the Assembly" or chamber-specific titles in the body. End with a clear, specific ask: that your office contact Healthfirst about this decision, raise the issue with the New York State Department of Health, and investigate whether Healthfirst's dermatology network is genuinely adequate — timely, geographically accessible, and offering the specific care this patient needs — in the patient's community, and help restore Belaray Dermatology to the network so the patient's established care can continue.
2. "regulator_letter" — a formal but personal complaint addressed per the recipient specified in the input (e.g. "Dear New York State Department of Health Managed Care Complaint Unit," / "Dear New York State Department of Financial Services," / "To Whom It May Concern at Medicare,"). State the member's plan type, describe the severed established physician relationship, present the patient's concrete access evidence (offices called, directory inaccuracies, quoted waits, travel distance), and request that the plan's dermatology network adequacy be reviewed and that Belaray Dermatology be restored to the network.
3. "healthfirst_letter" — a formal member grievance addressed "Dear Healthfirst Member Services,". Written as a paying/enrolled member of the plan named in the input, directly to their own insurer. It should: state plainly that the member is filing a formal grievance about network access to dermatology; condense the member's stake (relationship, ongoing care, access evidence) into its sharpest form rather than repeating the other letters at full length; state that the member did not choose this disruption and that the practice is willing to participate; ask Healthfirst to restore Belaray Dermatology to the network; and explicitly request that this be logged as a formal grievance with a written response and a grievance reference number. Firm, civil, unambiguous — the tone of a member the company should worry about losing. Roughly 250-400 words.`;

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

  const a = (req.body && req.body.answers) || {};
  const prompt = buildPrompt(a);

  try {
    const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        // "anthropic-beta": "fast-mode-2026-02-01",         // FAST MODE (beta) — uncomment with speed:"fast" below
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 5000,
        // effort "low" cuts generation time roughly in half with minimal quality
        // impact on letter-writing. Raise to "medium"/"high" if letters feel thin.
        // For ~2.5x faster output at 2x price, uncomment the two FAST MODE lines below.
        // speed: "fast",                                    // FAST MODE (beta)
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                assembly_letter: { type: "string" },
                regulator_letter: { type: "string" },
                healthfirst_letter: { type: "string" },
              },
              required: ["assembly_letter", "regulator_letter", "healthfirst_letter"],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      console.error("Anthropic API error", apiResp.status, errText);
      return res.status(502).json({ error: "letter_generation_failed" });
    }

    const data = await apiResp.json();
    if (data.stop_reason === "refusal" || !data.content || !data.content.length) {
      return res.status(502).json({ error: "letter_generation_failed" });
    }
    const textBlock = data.content.find((b) => b.type === "text");
    const letters = JSON.parse(textBlock.text);

    // Cost accounting: Claude Opus 5 is $5/M input, $25/M output tokens.
    // Visible per-request in Vercel → project → Logs; aggregate at console.anthropic.com.
    const u = data.usage || {};
    const cost = ((u.input_tokens || 0) * 5 + (u.output_tokens || 0) * 25) / 1e6;
    letters.usage = {
      input_tokens: u.input_tokens || 0,
      output_tokens: u.output_tokens || 0,
      estimated_cost_usd: Math.round(cost * 10000) / 10000,
    };
    console.log("letter_generated", JSON.stringify(letters.usage));

    return res.status(200).json(letters);
  } catch (e) {
    console.error("Function error", e && e.message);
    return res.status(502).json({ error: "letter_generation_failed" });
  }
}

function clip(v) {
  return String(v == null ? "" : v).slice(0, MAX_FREETEXT).trim();
}

function clipList(v) {
  return Array.isArray(v) ? v.slice(0, 20).map((x) => clip(x)).filter(Boolean) : [];
}

function buildPrompt(a) {
  // Assembled server-side from structured fields so the page can't be
  // abused as a general-purpose AI endpoint.
  const lines = [];
  const add = (label, val) => {
    if (val && String(val).trim()) lines.push(`${label}: ${val}`);
  };

  add("Patient name (for signature)", clip(a.name));
  add("Town / area", clip(a.town));
  add("NY State Assembly member to address in the assembly letter", clip(a.assemblyRep));
  add("Insurance plan type", clip(a.planType));
  add("Regulator letter recipient", clip(a.regulatorRecipient));
  add("How long they have been a Belaray patient", clip(a.yearsPatient));
  add("How they found Belaray", clip(a.howFound));

  const family = clipList(a.familyMembers);
  if (family.length) add("Who receives care at Belaray", family.join(", "));

  const meanings = clipList(a.whatLosingMeans);
  if (meanings.length) add("What losing Belaray would mean for them and their family", meanings.join("; "));

  const access = clipList(a.accessProblems);
  if (access.length) add("Real access problems they have already run into finding another in-network dermatologist", access.join("; "));
  add("Details about wait times or distance in their own words", clip(a.accessDetails));
  if (a.waitExceedsStandard) add("Reported wait exceeds New York's 4-6 week specialist availability standard", "YES — make this argument explicitly");

  const care = clipList(a.careAtBelaray);
  if (care.length) add("Care they receive at Belaray", care.join("; "));

  add("Language they receive care in at Belaray", clip(a.language));

  const extras = clipList(a.extras);
  if (extras.length) add("Other true statements they checked", extras.join("; "));

  add("Anything else, in the patient's own words", clip(a.ownWords));

  return (
    "Here are one patient's questionnaire answers. Draft the two letters described in your instructions.\n\n" +
    lines.join("\n")
  );
}
