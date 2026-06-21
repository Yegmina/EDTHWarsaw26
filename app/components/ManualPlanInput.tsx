"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Loader2, MapPin } from "lucide-react";
import type { AgentAnalyzedPlan, ManualPlanInput as ManualPlanPayload } from "@/app/types/pipeline";

type ManualPlanInputProps = {
  onPlanAnalyzed: (analysis: AgentAnalyzedPlan) => void;
};

const initialForm = {
  planTitle: "Operator submitted plan",
  targetDescription: "Priority infrastructure node requiring post-action assessment planning",
  lat: "55.7558",
  lng: "37.6173",
  approachStrategy: "Low-exposure approach corridor with sensor review checkpoints",
  timingConsiderations: "Night window with follow-up imagery collection scheduled",
  adAvoidanceStrategy: "Avoid known defended sectors and preserve standoff margin",
  environmentalNotes: "Mixed cloud cover, variable wind, limited ground confirmation",
  additionalContext: "Plan requires verification chain and post-event collection readiness",
  operatorName: "Warsaw26 analyst"
};

export function ManualPlanInput({ onPlanAnalyzed }: ManualPlanInputProps) {
  const [form, setForm] = useState(initialForm);
  const [analysis, setAnalysis] = useState<AgentAnalyzedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const payload: ManualPlanPayload = {
      planTitle: form.planTitle,
      targetDescription: form.targetDescription,
      coordinates: {
        lat: Number(form.lat),
        lng: Number(form.lng)
      },
      approachStrategy: form.approachStrategy,
      timingConsiderations: form.timingConsiderations,
      adAvoidanceStrategy: form.adAvoidanceStrategy,
      environmentalNotes: form.environmentalNotes,
      additionalContext: form.additionalContext,
      operatorName: form.operatorName
    };

    try {
      const response = await fetch("/api/manual-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Plan analysis failed.");
      }
      setAnalysis(body);
      onPlanAnalyzed(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel pipeline-card">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 1</span>
          <h2>Manual Plan Input</h2>
        </div>
        <Brain size={20} />
      </div>

      <form className="planner-form" onSubmit={handleSubmit}>
        <label>
          Plan title
          <input value={form.planTitle} onChange={(event) => updateField("planTitle", event.target.value)} />
        </label>
        <label>
          Target description
          <textarea
            value={form.targetDescription}
            onChange={(event) => updateField("targetDescription", event.target.value)}
          />
        </label>
        <div className="planner-grid">
          <label>
            Latitude
            <input value={form.lat} onChange={(event) => updateField("lat", event.target.value)} />
          </label>
          <label>
            Longitude
            <input value={form.lng} onChange={(event) => updateField("lng", event.target.value)} />
          </label>
          <label>
            Operator
            <input value={form.operatorName} onChange={(event) => updateField("operatorName", event.target.value)} />
          </label>
        </div>
        <label>
          Approach strategy
          <textarea value={form.approachStrategy} onChange={(event) => updateField("approachStrategy", event.target.value)} />
        </label>
        <label>
          Timing considerations
          <textarea
            value={form.timingConsiderations}
            onChange={(event) => updateField("timingConsiderations", event.target.value)}
          />
        </label>
        <label>
          Air-defense avoidance notes
          <textarea
            value={form.adAvoidanceStrategy}
            onChange={(event) => updateField("adAvoidanceStrategy", event.target.value)}
          />
        </label>
        <label>
          Environmental notes
          <textarea
            value={form.environmentalNotes}
            onChange={(event) => updateField("environmentalNotes", event.target.value)}
          />
        </label>
        <label>
          Additional context
          <textarea
            value={form.additionalContext}
            onChange={(event) => updateField("additionalContext", event.target.value)}
          />
        </label>

        {error ? (
          <div className="error-line">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <button className="action-button" disabled={isLoading} type="submit">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Brain size={18} />}
          Analyze Manual Plan
        </button>
      </form>

      {analysis ? (
        <div className="recommendation-output">
          <div className="output-header">
            <CheckCircle2 size={18} />
            <strong>{analysis.agentAnalysis.confidenceLevel}% confidence</strong>
            <span>{analysis.agentAnalysis.riskAssessment} risk</span>
          </div>
          <div className="planner-grid">
            <article>
              <MapPin size={16} />
              <span>Feasibility</span>
              <strong>{analysis.agentAnalysis.feasibilityScore}%</strong>
            </article>
            <article>
              <Brain size={16} />
              <span>Modifications</span>
              <strong>{analysis.agentAnalysis.recommendedModifications.length}</strong>
            </article>
          </div>
          <ul>
            {analysis.agentAnalysis.strengths.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
