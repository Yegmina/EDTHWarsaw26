import { NextResponse } from "next/server";

type VideoEventInput = {
  time?: number;
  score?: number;
  kind?: string;
  bbox?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
};

type VideoAssessmentRequest = {
  sourceMode?: "rgb" | "thermal" | "mixed";
  duration?: number;
  events?: VideoEventInput[];
  thumbnails?: string[];
};

type VideoAssessmentResult = {
  provider: "vision-llm" | "local";
  confidence: number;
  damageLevel: "none-observed" | "possible" | "probable" | "severe" | "unknown";
  summary: string;
  observations: string[];
  visualIndicators: string[];
  uncertainties: string[];
  recommendedReviewActions: string[];
};

export async function POST(request: Request) {
  try {
    const payload = normalizePayload((await request.json()) as VideoAssessmentRequest);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!payload.events.length) {
      return NextResponse.json(localVideoAssessment(payload));
    }

    if (!apiKey) {
      return NextResponse.json(localVideoAssessment(payload));
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildPrompt(payload)
              },
              ...payload.thumbnails.slice(0, 4).map((imageUrl) => ({
                type: "input_image",
                image_url: imageUrl,
                detail: "low"
              }))
            ]
          }
        ],
        max_output_tokens: 1200
      })
    });

    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          ...localVideoAssessment(payload),
          provider: "local",
          uncertainties: [
            "Vision LLM interpretation was unavailable; local detector summary was used.",
            extractApiError(body)
          ].filter(Boolean)
        },
        { status: 200 }
      );
    }

    const outputText = extractOutputText(body);
    const parsed = parseJsonObject(outputText);
    return NextResponse.json(normalizeResult(parsed, payload));
  } catch {
    return NextResponse.json({ error: "Failed to assess video evidence." }, { status: 500 });
  }
}

function buildPrompt(payload: Required<VideoAssessmentRequest>) {
  const events = payload.events
    .slice(0, 12)
    .map(
      (event, index) =>
        `${index + 1}. T+${numberValue(event.time, 0).toFixed(2)}s ${stringValue(event.kind, "event")} score=${numberValue(event.score, 0)} bbox=${JSON.stringify(event.bbox ?? {})}`
    )
    .join("\n");

  return [
    "You are an evidence analyst reviewing post-event video frames and local frame-delta detections.",
    "Assess visible effects only. Do not recommend targeting, strike execution, evasion, weapon selection, or operational corrections.",
    "Consider RGB and thermal footage. In thermal footage, bright transient regions may indicate heat, flash, fire, or sensor bloom; call out uncertainty.",
    "Return only valid JSON with this shape:",
    "{",
    '  "confidence": number between 0 and 100,',
    '  "damageLevel": "none-observed" | "possible" | "probable" | "severe" | "unknown",',
    '  "summary": "2-4 sentence assessment",',
    '  "observations": ["specific visible observations"],',
    '  "visualIndicators": ["flash, smoke, thermal bloom, scene change, etc"],',
    '  "uncertainties": ["limitations and gaps"],',
    '  "recommendedReviewActions": ["non-operational review actions only"]',
    "}",
    "",
    `Source mode: ${payload.sourceMode}`,
    `Duration seconds: ${payload.duration.toFixed(2)}`,
    "Local detector events:",
    events || "No events"
  ].join("\n");
}

function localVideoAssessment(payload: Required<VideoAssessmentRequest>): VideoAssessmentResult {
  const events = payload.events;
  const peak = events.slice().sort((a, b) => numberValue(b.score, 0) - numberValue(a.score, 0))[0];
  const peakScore = numberValue(peak?.score, 0);
  const kinds = Array.from(new Set(events.map((event) => stringValue(event.kind, "event").replace("-", " "))));
  const confidence = events.length ? Math.min(92, Math.max(52, Math.round(50 + peakScore * 0.32 + Math.min(events.length, 10) * 2))) : 40;
  const damageLevel: VideoAssessmentResult["damageLevel"] =
    peakScore >= 82 && events.length >= 3
      ? "severe"
      : peakScore >= 62
        ? "probable"
        : events.length
          ? "possible"
          : "unknown";

  return {
    provider: "local",
    confidence,
    damageLevel,
    summary: events.length
      ? `${payload.sourceMode.toUpperCase()} frame-delta review detected ${events.length} visible event windows over ${payload.duration.toFixed(1)}s. Peak event score was ${peakScore}% at T+${numberValue(peak?.time, 0).toFixed(2)}s with indicators: ${kinds.join(", ")}.`
      : `${payload.sourceMode.toUpperCase()} frame-delta review found no dominant fast-change event in ${payload.duration.toFixed(1)}s.`,
    observations: events
      .slice(0, 5)
      .map((event) => `T+${numberValue(event.time, 0).toFixed(2)}s ${stringValue(event.kind, "event").replace("-", " ")} scored ${numberValue(event.score, 0)}%.`),
    visualIndicators: kinds.length ? kinds : ["no dominant visible indicator"],
    uncertainties: [
      "Local analysis is based on visual frame deltas and does not independently confirm physical damage.",
      "Compression artifacts, sensor bloom, exposure change, or camera motion may affect scores."
    ],
    recommendedReviewActions: [
      "Preserve the source video and detector event timestamps.",
      "Compare with independent camera, audio, satellite, or operator reports before final conclusion.",
      "Review keyframes around the highest-scoring event window."
    ]
  };
}

function normalizePayload(payload: VideoAssessmentRequest): Required<VideoAssessmentRequest> {
  const sourceMode = payload.sourceMode === "rgb" || payload.sourceMode === "thermal" || payload.sourceMode === "mixed" ? payload.sourceMode : "mixed";
  const duration = Math.max(0, numberValue(payload.duration, 0));
  const events = Array.isArray(payload.events)
    ? payload.events
        .map((event) => ({
          time: Math.max(0, numberValue(event.time, 0)),
          score: Math.min(100, Math.max(0, Math.round(numberValue(event.score, 0)))),
          kind: stringValue(event.kind, "event"),
          bbox: {
            x: numberValue(event.bbox?.x, 0),
            y: numberValue(event.bbox?.y, 0),
            width: numberValue(event.bbox?.width, 0),
            height: numberValue(event.bbox?.height, 0)
          }
        }))
        .slice(0, 24)
    : [];
  const thumbnails = Array.isArray(payload.thumbnails)
    ? payload.thumbnails.filter((item): item is string => typeof item === "string" && item.startsWith("data:image/")).slice(0, 4)
    : [];

  return { sourceMode, duration, events, thumbnails };
}

function normalizeResult(value: Record<string, unknown>, payload: Required<VideoAssessmentRequest>): VideoAssessmentResult {
  const fallback = localVideoAssessment(payload);
  const damageLevel = value.damageLevel;

  return {
    provider: "vision-llm",
    confidence: Math.min(100, Math.max(0, Math.round(numberValue(value.confidence, fallback.confidence)))),
    damageLevel:
      damageLevel === "none-observed" ||
      damageLevel === "possible" ||
      damageLevel === "probable" ||
      damageLevel === "severe" ||
      damageLevel === "unknown"
        ? damageLevel
        : fallback.damageLevel,
    summary: stringValue(value.summary, fallback.summary),
    observations: stringArray(value.observations, fallback.observations),
    visualIndicators: stringArray(value.visualIndicators, fallback.visualIndicators),
    uncertainties: stringArray(value.uncertainties, fallback.uncertainties),
    recommendedReviewActions: stringArray(value.recommendedReviewActions, fallback.recommendedReviewActions)
  };
}

function extractOutputText(response: unknown): string {
  const body = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n") ?? ""
  );
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }

    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function extractApiError(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "message" in value.error
  ) {
    return String(value.error.message);
  }

  return "";
}

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : fallback;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
