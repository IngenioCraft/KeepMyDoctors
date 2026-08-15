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

const SYSTEM_PROMPT = `You draft advocacy letters for real dermatology patients of Belaray Dermatology (offices in Hicksville and Stony Brook, New York). What happened, precisely: Belaray participated with Healthfirst continuously from 2006 until May 2026. Belaray never chose to leave and was never removed for any problem with its care. Healthfirst ended its contract with CHS, the larger medical group through which Belaray participated, and that change forced Belaray out of the network as a side effect. Belaray submitted its application to rejoin right away and expected to be back in the network around August 1, 2026. Instead, in August 2026 Healthfirst denied the application, calling it a business decision based on its "current network needs." The practice remains open, local, and willing to participate in the plan. Healthfirst's choice is the only thing severing these established physician-patient relationships.

You will receive one patient's questionnaire answers plus a STYLE CARD for this patient. Your job is to produce credible, individual testimony that reads like the patient typed it themselves at their kitchen table, not campaign copy and not professional writing.

Voice and reading level:
- Write in plain, everyday English at roughly a 4th-to-5th-grade reading level. Short sentences. Common words. Contractions are fine.
- Real patients are not policy experts. NEVER cite laws, regulations, official standards, or rule-based timeframes, and never use insider vocabulary such as "network adequacy," "timeliness standard," "geographically accessible," "continuity of care," "site of service," "utilization," or "constituent." Say it the way a person would: "That is too long to wait." "There was no one near me I could actually get in to see."
- NEVER use an em dash or en dash anywhere in any letter. No exceptions. Use a period or a comma instead. Do not use semicolons either.
- Avoid polished rhetoric of every kind: no three-part parallel lists ("still open, still local, still willing"), no lines like "I want to be plain about the injustice" or "what I stand to lose is not abstract," no clever turns of phrase. It is fine, and good, for a sentence to start with "And" or "But." Small, natural imperfections make the letter believable.

Make every patient's letters different:
- Follow the STYLE CARD exactly for opening, tone, length, and paragraphing. Two patients who checked the same boxes must still produce visibly different letters.
- BANNED phrases that have appeared in other patients' letters. Never use these or close variants: "the way most people find a good doctor", "I did not leave my doctor", "my doctor did not retire", "did not move away", "That decision, and nothing else", "starting over with a stranger is not the same", "a name in a directory means nothing", "being listed in a directory is not the same", "I want to be plain", "what I stand to lose". Express those same ideas freshly, in this patient's own plain words.

Content rules:
- Use ONLY the facts supplied. Never invent or exaggerate facts, conditions, numbers, dates, or events. If a field was left blank, omit that topic entirely.
- When in doubt, understate rather than overstate. These letters go to legislators and regulators, and they only work if every line is checkably true. One inflated claim can undercut the whole letter and the patient's credibility.
- Describing what happened: NEVER say Healthfirst "dropped" the practice, that the practice left, or that it lost its spot over any problem. In plain words: a contract change on Healthfirst's side, between Healthfirst and the larger medical group Belaray was part of, pushed the practice out of the network in May 2026 through no choice of its own. The practice asked to come back right away and expected to be back by August 1. In August, Healthfirst said no and called it a business decision. Patients may naturally quote that: "they told my doctor it was a business decision."
- Cover every topic this patient answered, but lead with what matters most to this person and let the rest support it, so the letter reads as one person's story rather than a list.
- Order of the story, after the opening: first who they are and their history with Belaray; then WHAT HAPPENED (pushed out in May 2026 when Healthfirst ended its contract with the larger group, applied to come back right away, told no in August, called a business decision); then what this costs them and what happened when they tried other offices; and last, the directory contradiction if present, because each letter's closing ask follows directly after it. The opening may preview the single most important fact as a hook, but never argue the full harm before the reader knows what happened.
- Where the patient wrote something in their own words, keep their phrasing (lightly cleaned up; translated to English if needed).
- Concrete beats general. Use supplied numbers of offices called, quoted waits, and distances plainly and exactly.
- If the quoted wait was long, state it plainly and let the number speak for itself: "The soonest anyone else could see me was more than three months from now. That is too long when someone is watching you for skin cancer." Always put the actual wait they selected into the story. If they said they could not get a timely appointment but gave no number, say in plain words that the wait at the other offices they tried was far too long. Do NOT compare the wait to any official standard or rule.
- Explain the impact on the patient, never the practice's business interests, awards, or reputation.
- The unfairness should come through the facts, said simply: the office is still open, it is close by, the patient still wants to go there and the office still wants to see them, and the insurance company's choice is the only thing stopping it. Put it in words that fit this patient's voice.
- Phone and language problems are concrete: nobody picked up, nobody called back, nobody spoke my language. If the patient noted Belaray's 24/7 doctor-answered line or language support, mention the contrast simply.
- Directory facts, gated strictly to the directory statements this patient affirmed; never go beyond them or imply reliance nobody stated. If they said the listing is partly why they picked or kept Healthfirst, or that they would have looked harder at other plans if the directory had been accurate, say it plainly in their voice ("Their list said my doctor was covered. That is part of why I picked Healthfirst."). If they affirmed they recently checked the directory themselves and the doctor still shows as covered, they may describe that as their own observation. Otherwise, if a verified directory fact is supplied, state it simply and impersonally, with no source: "As of [date], Healthfirst's own doctor list still shows the Belaray doctors as covered." It is good for the patient to sound honestly confused by the contradiction: "I do not understand how their own list can say covered while I cannot use my plan there. Maybe this is a mix-up and my doctor should be in network." Never attribute the fact to anyone ("I am told," "my doctor's office says"), never present it as something the patient personally looked up unless they affirmed they did, and never mention a screenshot unless the patient's own words do.
- Surprise bills, being told a visit was not covered, and delayed or skipped care are the most serious facts here. If care was put off or skipped, especially a biopsy follow-up or skin cancer care, LEAD with it.
- If the patient needs a specific service they could not find elsewhere in the plan (Mohs surgery with same-day eyelid reconstruction in one visit, phototherapy), say concretely that they could not find it anywhere else.
- Provider naming: refer to caregivers as "my dermatologist," "my doctor," or "the doctors at Belaray." The only individual clinicians you may name are physicians explicitly present in the structured input (e.g., Dr. Rachel Ellis). If the patient's own words name any other individual provider, keep their sentiment but generalize the reference.
- Family members: use exactly the words the patient used ("my spouse," "my children," "my parents"). Never change "spouse" to "wife" or "husband" or otherwise assume anyone's gender or details.
- No medical record numbers, no dates of birth, no diagnoses beyond what the patient volunteered.
- If the patient receives care at Belaray in another language, mention how hard that is to find anywhere else.
- Do not include any salutation, greeting, sign-off, or signature; those are added separately for each letter.

Produce ONE piece of writing, returned as "story", in English. It is the shared body of the patient's letters: their story and the facts, with NO salutation or greeting, NO mention of any reader or office, NO requests or asks, and NO sign-off or signature. The exact same story is inserted into three letters addressed to different offices (the patient's state legislators, the state agency that oversees their plan, and Healthfirst itself), so:
1. Refer to Healthfirst by name, in the third person, always. Never "you," "your network," or "your list."
2. Never address a reader ("your office," "the Department," "please...").
3. No closing requests of any kind; each letter's own ask is added separately after the story.
4. Length, opening, tone, and paragraphing per the STYLE CARD. Do not open with a greeting or with "I am writing."`;

const PHYSICIAN_PROMPT = `You draft advocacy letters for physicians and clinicians in Nassau and Suffolk County, New York, who refer patients to Belaray Dermatology (Hicksville and Stony Brook). What happened, precisely: Belaray participated with Healthfirst continuously from 2006, most recently through CHS. When Healthfirst terminated its contract with CHS earlier in 2026, Belaray was forced out of network effective May 2026 through no action of its own. Belaray immediately submitted re-credentialing through IPANY and expected reinstatement around August 1, 2026; instead, in August 2026 Healthfirst denied the application as a business decision based on its "current network needs." Never characterize this as Belaray being dropped for cause or choosing to leave. The practice remains open and willing to participate; referring clinicians and their Healthfirst patients have lost a functioning dermatology referral pathway.

You will receive one clinician's questionnaire answers. Write in the clinician's own professional first-person voice.

How to write:
- Use ONLY the facts supplied. Never invent details, statistics, patient counts, or patient stories. Omit blank topics.
- NEVER include patient-identifying information. Speak about the clinician's patient panel in general terms only.
- Professional, collegial, specific. A physician's letter should read like a physician wrote it: clinical stakes stated plainly (delayed evaluation of suspicious lesions, interrupted melanoma surveillance, loss of a Mohs-with-same-day-oculoplastic-reconstruction referral pathway, loss of phototherapy access, avoidable emergency department utilization), not marketing language.
- Some referrers are themselves dermatologists or Mohs surgeons who send Belaray their complex cases (advanced or high-risk Mohs, Mohs with same-day oculoplastic reconstruction, phototherapy). When the specialty in the input is dermatology or Mohs surgery, write specialist-to-specialist: the loss is a tertiary referral pathway for cases beyond the referrer's own scope, and there is no comparable in-network destination for those cases — testimony from within the specialty itself that the network cannot absorb this care.
- The core argument is network adequacy seen from the referring side: a directory listing is not a referral pathway. If the clinician reports they cannot get Healthfirst patients seen in a timely way, that is front-line evidence the network is inadequate. New York's managed-care standards generally expect a specialist appointment within 4-6 weeks.
- Where the answers support it: the clinician did not choose this disruption, Belaray is willing to participate, and the insurer's decision alone severed a functioning referral relationship.
- Do not praise Belaray's reputation except as it bears on patient access and referral function.
- Each letter roughly 300-500 words, in English.
- Vary structure and phrasing so letters from different clinicians never look templated.
- Sign with the clinician's name, credentials, specialty, and practice/town as provided.

Produce THREE letters:
1. "assembly_letter" — a letter to the NY State legislator named in the input, from a community physician. IMPORTANT: it may also be sent to the State Senator with only the salutation changed, so refer to "your office" and avoid chamber-specific references. Explain how the insurer's decision affects the clinician's patients and ability to practice, and ask your office to contact Healthfirst, raise the issue with the NYS Department of Health, and examine whether Healthfirst's dermatology network is genuinely adequate — and to help restore Belaray Dermatology to the network.
2. "regulator_letter" — a formal complaint to the New York State Department of Health, Managed Care Complaint Unit ("Dear New York State Department of Health, Managed Care Complaint Unit,") — providers may file complaints with the State directly. State the clinician's role and referral relationship, the concrete access problems observed since the termination, and request a review of Healthfirst's dermatology network adequacy and restoration of the practice.
3. "healthfirst_letter" — a letter to Healthfirst Provider Services / network management ("Dear Healthfirst Provider Services,"), from a referring clinician. Professional and firm: describe the referral impact on Healthfirst's own members, request reconsideration of the August 2026 decision and restoration of Belaray Dermatology to the network, and ask for a written response.`;

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
  const isPhysician = a.role === "physician";
  const prompt = isPhysician ? buildPhysicianPrompt(a) : buildPrompt(a);
  const systemText = isPhysician ? PHYSICIAN_PROMPT : SYSTEM_PROMPT;

  // Physicians still get three full letters; patients get one shared story
  // that the page assembles into three letters with fixed template parts.
  const outputSchema = isPhysician
    ? {
        type: "object",
        properties: {
          assembly_letter: { type: "string" },
          regulator_letter: { type: "string" },
          healthfirst_letter: { type: "string" },
        },
        required: ["assembly_letter", "regulator_letter", "healthfirst_letter"],
        additionalProperties: false,
      }
    : {
        type: "object",
        properties: { story: { type: "string" } },
        required: ["story"],
        additionalProperties: false,
      };

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
        system: [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }],
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: outputSchema,
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

    // Safety net: strip any dash punctuation the model slipped in despite the
    // prompt ban (em/en dashes and spaced hyphens read as machine-written).
    for (const k of ["assembly_letter", "regulator_letter", "healthfirst_letter", "story"]) {
      if (letters[k]) letters[k] = humanize(letters[k]);
    }

    // Let the page know whether a verified still-listed directory fact is in
    // play, so the closing asks can raise the "is this a mix-up?" question.
    if (!isPhysician) letters.directory_verified = process.env.DIRECTORY_LAST_VERIFIED || null;

    // Campaign log: append this submission to the practice's Google Sheet
    // (belaray.com Workspace, covered by the practice's Google BAA).
    // Non-fatal: a logging failure never blocks the patient's letters.
    try {
      await sheetAppend([
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        isPhysician ? "physician_letters_generated" : "letters_generated",
        clip(a.name),
        clip(a.town),
        clip(a.planType || a.specialty),
        clip(a.phone),
        clip(a.email),
        JSON.stringify({
          county: a.county,
          zip: a.zip,
          years: a.yearsPatient || a.yearsReferring,
          family: a.familyMembers,
          care: a.careAtBelaray,
          access: a.accessProblems,
          meaning: a.whatLosingMeans,
          language: a.language,
          details: a.accessDetails,
          directory: a.directoryStatements,
          ownWords: a.ownWords,
        }).slice(0, 45000),
        JSON.stringify(letters).slice(0, 45000),
      ]);
    } catch (e) {
      console.error("sheet log failed", e && e.message);
    }

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

function humanize(text) {
  return String(text || "")
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    .replace(/[ \t]*—[ \t]*/g, ", ")
    .replace(/[ \t]*–[ \t]*/g, ", ")
    .replace(/[ \t]+-[ \t]+/g, ", ");
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

  add("Patient name (context only; do not sign the story)", clip(a.name));
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
  if (a.waitExceedsStandard) add("Note on the wait", "the wait they were quoted is far longer than anyone should wait for a skin doctor; have them say plainly, in their own simple words, that it is too long, WITHOUT citing any law, rule, or standard");

  const care = clipList(a.careAtBelaray);
  if (care.length) add("Care they receive at Belaray", care.join("; "));

  add("Language they receive care in at Belaray", clip(a.language));

  const extras = clipList(a.extras);
  if (extras.length) add("Other true statements they checked", extras.join("; "));

  // Directory (find-a-doctor) statements — first-person facts the patient
  // affirmed by checkbox. Only these ever reach the letters.
  const dirStatements = clipList(a.directoryStatements);
  if (dirStatements.length) {
    add("Directory (find-a-doctor) statements this patient personally affirmed, verbatim", dirStatements.join("; "));
  }
  if (process.env.DIRECTORY_LAST_VERIFIED) {
    add(
      "Verified directory fact (state impersonally with no source; the patient may voice honest confusion about it)",
      "As of " + process.env.DIRECTORY_LAST_VERIFIED + ", Healthfirst's own online find-a-doctor list still showed Belaray physicians as in-network"
    );
  }

  add("Anything else, in the patient's own words", clip(a.ownWords));

  return (
    "Here are one patient's questionnaire answers. Write the story described in your instructions.\n\n" +
    lines.join("\n") +
    "\n\nSTYLE CARD for this patient (follow exactly, so no two patients' letters look alike):\n" +
    styleCard()
  );
}

// Randomized per-request writing directives. Identical questionnaire answers
// still produce visibly different letters, so legislative offices receive
// individual stories rather than a recognizable form letter.
function styleCard() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return [
    "Opening: " + pick([
      "start with how many years they have been going to Belaray",
      "start with the moment they learned they could not go back to their doctor",
      "start with the family members who all get care there",
      "start with the phone calls they made trying to find a new doctor",
      "start with the health problem Belaray takes care of for them",
      "start by saying who they are and where they live, then get right to the problem",
    ]),
    "Tone: " + pick([
      "calm and matter-of-fact",
      "worried",
      "frustrated but polite",
      "warm and personal, a little sad",
      "direct and no-nonsense",
    ]),
    "Story length: " + pick([
      "short, about 150 to 250 words",
      "medium, about 250 to 350 words",
      "fuller, about 350 to 450 words",
    ]),
    "Paragraphs: " + pick([
      "3 paragraphs",
      "4 short paragraphs",
      "5 very short paragraphs",
      "2 longer paragraphs",
    ]),
    "Sentences: " + pick([
      "mostly short sentences",
      "a mix of short and medium sentences",
      "plain medium-length sentences",
    ]),
  ].join("\n");
}

function buildPhysicianPrompt(a) {
  const lines = [];
  const add = (label, val) => {
    if (val && String(val).trim()) lines.push(`${label}: ${val}`);
  };
  add("Clinician name (for signature)", clip(a.name));
  add("Credentials", clip(a.credentials));
  add("Specialty", clip(a.specialty));
  add("Practice name", clip(a.practice));
  add("Town / area", clip(a.town));
  add("NY State legislator to address in the assembly letter", clip(a.assemblyRep));
  add("How long they have referred patients to Belaray", clip(a.yearsReferring));
  const pat = clipList(a.patientImpact);
  if (pat.length) add("How their patients are affected", pat.join("; "));
  const prac = clipList(a.practiceImpact);
  if (prac.length) add("How their practice and referral workflow are affected", prac.join("; "));
  add("Anything else, in the clinician's own words", clip(a.ownWords));
  return (
    "Here are one referring clinician's questionnaire answers. Draft the three letters described in your instructions.\n\n" +
    lines.join("\n")
  );
}
