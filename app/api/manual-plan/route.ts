// app/api/manual-plan/route.ts

import { NextResponse } from "next/server";
import type { ManualPlanInput, AgentAnalyzedPlan, RiskLevel, StrikeRecommendation } from "@/app/types/pipeline";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const payload = (await request.json()) as ManualPlanInput;

    if (!payload.planTitle || !payload.targetDescription) {
      return NextResponse.json(
        { error: "Plan title and target description are required." },
        { status: 400 }
      );
    }

    // If OpenAI key is available, use LLM analysis
    if (apiKey) {
      const prompt = [
        "You are a military planning analyst reviewing a manually submitted strike plan.",
        "Analyze the plan for feasibility, risks, and potential improvements.",
        "DO NOT recommend actual strikes or provide real military tactics.",
        "Focus on analytical assessment: strengths, weaknesses, and alternative approaches.",
        "",
        "Return only valid JSON with this shape:",
        "{",
        '  "feasibilityScore": number between 0-100,',
        '  "riskAssessment": "low" | "medium" | "high" | "critical",',
        '  "strengths": ["array of plan strengths"],',
        '  "weaknesses": ["array of plan weaknesses"],',
        '  "recommendedModifications": ["array of suggested improvements"],',
        '  "alternativeApproaches": ["array of alternative strategies"],',
        '  "confidenceLevel": number between 0-100',
        "}",
        "",
        `Plan Title: ${payload.planTitle}`,
        `Target: ${payload.targetDescription}`,
        `Coordinates: ${payload.coordinates.lat}, ${payload.coordinates.lng}`,
        `Approach Strategy: ${payload.approachStrategy}`,
        `Timing: ${payload.timingConsiderations}`,
        `AD Avoidance: ${payload.adAvoidanceStrategy}`,
        `Environment: ${payload.environmentalNotes}`,
        `Additional Context: ${payload.additionalContext}`,
        `Operator: ${payload.operatorName}`
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
          max_output_tokens: 1200
        })
      });

      const openAiBody = await openAiResponse.json();
      const outputText = extractOutputText(openAiBody);
      const llmAnalysis = parseJsonObject(outputText);

      const analyzedPlan: AgentAnalyzedPlan = {
        originalPlan: payload,
        agentAnalysis: {
          feasibilityScore: llmAnalysis.feasibilityScore || 70,
          riskAssessment: normalizeRisk(llmAnalysis.riskAssessment),
          strengths: llmAnalysis.strengths || ["Manual plan submitted for review"],
          weaknesses: llmAnalysis.weaknesses || ["Requires further analysis"],
          recommendedModifications: llmAnalysis.recommendedModifications || [],
          alternativeApproaches: llmAnalysis.alternativeApproaches || [],
          confidenceLevel: llmAnalysis.confidenceLevel || 75,
          analysisTimestamp: new Date().toISOString()
        },
        integratedRecommendation: recommendationFromManualPlan(payload, llmAnalysis.confidenceLevel || 75, normalizeRisk(llmAnalysis.riskAssessment))
      };

      return NextResponse.json(analyzedPlan);
    }

    // Fallback analysis without LLM
    const analyzedPlan: AgentAnalyzedPlan = {
      originalPlan: payload,
      agentAnalysis: {
        feasibilityScore: 72,
        riskAssessment: "medium",
        strengths: [
          "Manual plan provides operational context",
          "Operator expertise reflected in approach strategy",
          "Clear target description and coordinates provided"
        ],
        weaknesses: [
          "Limited real-time intelligence integration",
          "Environmental factors may change during execution",
          "AD avoidance strategy requires satellite confirmation"
        ],
        recommendedModifications: [
          "Integrate real-time weather data before execution",
          "Confirm AD positions via satellite imagery",
          "Add contingency routing for dynamic threats"
        ],
        alternativeApproaches: [
          "Consider multi-axis approach for redundancy",
          "Evaluate standoff engagement options",
          "Assess feasibility of coordinated timing windows"
        ],
        confidenceLevel: 68,
        analysisTimestamp: new Date().toISOString()
      },
      integratedRecommendation: recommendationFromManualPlan(payload, 68, "medium")
    };

    return NextResponse.json(analyzedPlan);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to analyze manual plan." },
      { status: 500 }
    );
  }
}

function normalizeRisk(value: unknown): RiskLevel {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function recommendationFromManualPlan(
  payload: ManualPlanInput,
  confidenceScore: number,
  riskLevel: RiskLevel
): StrikeRecommendation {
  return {
    id: `manual-rec-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: "manual-agent",
    targetSummary: payload.targetDescription,
    coordinates: payload.coordinates,
    recommendedWindow: payload.timingConsiderations || "Operator-defined review window",
    approachCorridor: payload.approachStrategy || "Operator-defined approach corridor",
    standoffDistanceKm: riskLevel === "critical" ? 120 : riskLevel === "high" ? 90 : 65,
    riskLevel,
    confidenceScore: Math.max(0, Math.min(100, Math.round(Number(confidenceScore) || 68))),
    rationale: [
      "Manual plan accepted and converted into pipeline parameters.",
      "Agent review produced a bounded confidence score and risk category.",
      "Stage 2 should collect independent post-event evidence before conclusions."
    ],
    constraints: [
      payload.adAvoidanceStrategy || "Defensive coverage notes require review.",
      payload.environmentalNotes || "Environmental assumptions require update before assessment.",
      payload.additionalContext || "Additional source context not provided."
    ],
    intelligenceGaps: [
      "Manual plan source metadata requires review.",
      "Independent imagery and sensor confirmation are required.",
      "Any conflicting reports should be retained for Stage 3 analysis."
    ],
    selectedParameters: {
      routeProfile: payload.approachStrategy || "Manual route profile",
      timing: payload.timingConsiderations || "Manual timing window",
      sensorPlan: "Video, public camera, audio, and satellite corroboration",
      deconfliction: "Analyst review required before operational use",
      weatherAssumption: payload.environmentalNotes || "Weather assumptions not specified"
    }
  };
}

// Helper functions
function extractOutputText(response: any): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const chunks =
    response.output
      ?.flatMap((item: any) => item.content ?? [])
      .map((content: any) => content.text)
      .filter((text: any): text is string => typeof text === "string") ?? [];

  return chunks.join("\n");
}

function parseJsonObject(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return {};
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}
