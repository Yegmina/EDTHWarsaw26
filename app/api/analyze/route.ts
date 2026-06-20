import { NextResponse } from "next/server";

type AnalyzeRequest = {
  rawText?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  imageUrl?: string;
};

type EvidenceCard = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  source: string;
};

const FALLBACK_ANALYSIS = {
  brief:
    "The input was received, but the analysis response could not be parsed into the expected structure. Review the raw source manually and retry with a shorter, more clearly sourced text block.",
  observations: [],
  confidence: "low",
  sourceGaps: ["The model response did not match the expected JSON format."],
  verificationQuestions: ["Can the source, timestamp, and location claims be independently verified?"],
  safetyFlags: ["manual-review-required"],
  mapLayers: [],
  evidenceCards: []
};

const gazetteer = [
  {
    patterns: ["красной площ", "красная площ", "red square", "moscow", "москва"],
    label: "Moscow central review area",
    coords: [55.7558, 37.6173] as [number, number],
    radiusMeters: 14000
  },
  {
    patterns: ["санкт-петербург", "saint petersburg", "st petersburg", "петербург"],
    label: "Saint Petersburg review area",
    coords: [59.9343, 30.3351] as [number, number],
    radiusMeters: 16000
  },
  {
    patterns: ["екатеринбург", "yekaterinburg", "ekaterinburg"],
    label: "Yekaterinburg review area",
    coords: [56.8389, 60.6057] as [number, number],
    radiusMeters: 18000
  }
];

function sourceConfidence(payload: AnalyzeRequest) {
  const title = payload.sourceTitle?.toLowerCase() ?? "";
  const hasPrivateDocument = title.includes("private") || title.includes("document");
  const hasSourceUrl = Boolean(payload.sourceUrl?.trim());
  const hasImageUrl = Boolean(payload.imageUrl?.trim());

  if (hasSourceUrl && hasImageUrl) {
    return "high";
  }

  if (hasPrivateDocument || hasSourceUrl || hasImageUrl) {
    return "medium";
  }

  return "low";
}

function higherConfidence(a: unknown, b: "low" | "medium" | "high") {
  const rank = { low: 0, medium: 1, high: 2 };
  const current = typeof a === "string" && a in rank ? (a as keyof typeof rank) : "low";
  return rank[b] > rank[current] ? b : current;
}

function normalizeBriefConfidence(brief: unknown, confidence: "low" | "medium" | "high") {
  if (typeof brief !== "string" || confidence === "low") {
    return brief;
  }

  return brief
    .replace(/\blow-confidence\b/gi, `${confidence}-confidence`)
    .replace(/\blow confidence\b/gi, `${confidence} confidence`);
}

function inferMapLayers(rawText: string, confidence: "low" | "medium" | "high") {
  const normalized = rawText.toLowerCase();
  const layers = gazetteer
    .filter((entry) => entry.patterns.some((pattern) => normalized.includes(pattern)))
    .map((entry) => ({
      id: entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label: entry.label,
      lat: entry.coords[0],
      lng: entry.coords[1],
      radiusMeters: entry.radiusMeters,
      confidence,
      category: "review-area",
      detail: "Review area derived from submitted source text."
    }));

  if (layers.length) {
    return layers;
  }

  return [
    {
      id: "russia-context",
      label: "Russia context",
      lat: 55.5,
      lng: 61,
      radiusMeters: 350000,
      confidence,
      category: "context",
      detail: "Default context layer used when the text has no supported place reference."
    }
  ];
}

async function wikiCard(title: string): Promise<EvidenceCard> {
  const fallbackUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
      { headers: { "User-Agent": "AeroRozum-Warsaw26/0.1" } }
    );

    if (!response.ok) {
      throw new Error("Wikipedia summary unavailable");
    }

    const body = (await response.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
      thumbnail?: { source?: string };
    };

    return {
      title: body.title ?? title,
      description: body.extract ?? "Background reference from Wikipedia.",
      url: body.content_urls?.desktop?.page ?? fallbackUrl,
      imageUrl: body.thumbnail?.source,
      source: "Wikipedia"
    };
  } catch {
    return {
      title,
      description: "Background reference link.",
      url: fallbackUrl,
      source: "Wikipedia"
    };
  }
}

async function inferEvidenceCards(payload: AnalyzeRequest, rawText: string) {
  const cards: EvidenceCard[] = [];
  const normalized = rawText.toLowerCase();

  if (payload.sourceUrl?.trim()) {
    cards.push({
      title: payload.sourceTitle?.trim() || "Provided source",
      description: "Primary source link submitted with the current-state input.",
      url: payload.sourceUrl.trim(),
      imageUrl: payload.imageUrl?.trim() || undefined,
      source: "Provided source"
    });
  }

  if (normalized.includes("красной площ") || normalized.includes("red square")) {
    cards.push(await wikiCard("Red Square"));
  } else if (normalized.includes("moscow") || normalized.includes("москва")) {
    cards.push(await wikiCard("Moscow"));
  }

  return cards;
}

function extractOutputText(response: unknown): string {
  const body = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  const chunks =
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string") ?? [];

  return chunks.join("\n");
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return FALLBACK_ANALYSIS;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return FALLBACK_ANALYSIS;
    }
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as AnalyzeRequest;
  const rawText = payload.rawText?.trim() ?? "";

  if (!rawText) {
    return NextResponse.json({ error: "Current-state input is required." }, { status: 400 });
  }

  if (rawText.length > 18000) {
    return NextResponse.json(
      { error: "Input is too long for this prototype. Keep it under 18,000 characters." },
      { status: 400 }
    );
  }

  const confidenceBaseline = sourceConfidence(payload);
  const prompt = [
    "You are an evidence-intake analyst for a military planning support interface.",
    "Summarize user-provided current-state information into a concise analyst brief.",
    "Do not recommend attacks, target selection, strike corrections, weapon use, evasion tactics, or routes.",
    "Do not enrich the input with real military locations, unit positions, weapon ranges, readiness, vulnerabilities, or inferred coordinates.",
    "If the input includes military placement claims, air-defense assets, base locations, or exploitable details, keep the summary high-level and clearly mark verification requirements.",
    `Use ${confidenceBaseline} as the minimum source/provenance confidence when the source title, URL, or image suggests a submitted document/source exists; keep verification gaps separate from confidence.`,
    "Return only valid JSON with this exact shape:",
    "{",
    '  "brief": "2-4 sentence analyst summary",',
    '  "observations": [{"label":"short label","detail":"non-operational detail","confidence":"low|medium|high","source":"provided text|provided url|unknown"}],',
    `  "confidence": "${confidenceBaseline}|low|medium|high",`,
    '  "sourceGaps": ["missing evidence or uncertainty"],',
    '  "verificationQuestions": ["questions for human review"],',
    '  "safetyFlags": ["review flags, or empty array"]',
    "}",
    "",
    `Source title: ${payload.sourceTitle?.trim() || "Untitled source"}`,
    `Source URL: ${payload.sourceUrl?.trim() || "none provided"}`,
    `Evidence image URL: ${payload.imageUrl?.trim() || "none provided"}`,
    "Current-state input:",
    rawText
  ].join("\n");

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.5",
      input: prompt,
      max_output_tokens: 1800
    })
  });

  const openAiText = await openAiResponse.text();
  let openAiBody: unknown;

  try {
    openAiBody = JSON.parse(openAiText);
  } catch {
    openAiBody = { raw: openAiText };
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error: "OpenAI analysis failed.",
        detail:
          typeof openAiBody === "object" &&
          openAiBody !== null &&
          "error" in openAiBody &&
          typeof openAiBody.error === "object" &&
          openAiBody.error !== null &&
          "message" in openAiBody.error
            ? String(openAiBody.error.message)
            : "Unknown API error."
      },
      { status: openAiResponse.status }
    );
  }

  const outputText = extractOutputText(openAiBody);
  const analysis = parseJsonObject(outputText) as Record<string, unknown>;
  analysis.confidence = higherConfidence(analysis.confidence, confidenceBaseline);
  analysis.brief = normalizeBriefConfidence(analysis.brief, confidenceBaseline);
  analysis.observations = Array.isArray(analysis.observations)
    ? analysis.observations.map((observation) =>
        typeof observation === "object" && observation !== null
          ? {
              ...observation,
              confidence: higherConfidence(
                (observation as Record<string, unknown>).confidence,
                confidenceBaseline
              )
            }
          : observation
      )
    : [];
  analysis.mapLayers = inferMapLayers(rawText, confidenceBaseline);
  analysis.evidenceCards = await inferEvidenceCards(payload, rawText);

  return NextResponse.json(analysis);
}
