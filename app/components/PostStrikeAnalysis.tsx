"use client";

import { FormEvent, useState } from "react";
import { Activity, AlertTriangle, Camera, CheckCircle2, Loader2, Radar, Satellite } from "lucide-react";
import type { PostStrikeData, StrikeRecommendation } from "@/app/types/pipeline";

type PostStrikeAnalysisProps = {
  recommendation: StrikeRecommendation;
  onAnalysisComplete: (data: PostStrikeData) => void;
};

const initialEvidence = {
  visualStatus: "visible blast effects and sustained smoke plume",
  cameraNotes: "Public camera layer indicates change in scene brightness and plume development",
  audioNotes: "Audio sensors report impulse event followed by lower-amplitude secondary activity",
  satelliteNotes: "Satellite tasking requested; imagery confirmation pending",
  confidence: "82"
};

export function PostStrikeAnalysis({ recommendation, onAnalysisComplete }: PostStrikeAnalysisProps) {
  const [evidence, setEvidence] = useState(initialEvidence);
  const [result, setResult] = useState<PostStrikeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof typeof evidence, value: string) {
    setEvidence((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/post-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation,
          evidence: {
            ...evidence,
            confidence: Number(evidence.confidence)
          }
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Post-strike analysis failed.");
      }
      setResult(body);
      onAnalysisComplete(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post-strike analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel pipeline-card">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 2</span>
          <h2>Post-Strike Data Collection</h2>
        </div>
        <Activity size={20} />
      </div>

      <div className="recommendation-output compact">
        <div className="output-header">
          <Radar size={18} />
          <strong>{recommendation.targetSummary}</strong>
          <span>{recommendation.confidenceScore}% plan confidence</span>
        </div>
        <p>{recommendation.approachCorridor} / {recommendation.recommendedWindow}</p>
      </div>

      <form className="planner-form" onSubmit={handleSubmit}>
        <label>
          Visual / video notes
          <textarea value={evidence.visualStatus} onChange={(event) => updateField("visualStatus", event.target.value)} />
        </label>
        <label>
          Public camera notes
          <textarea value={evidence.cameraNotes} onChange={(event) => updateField("cameraNotes", event.target.value)} />
        </label>
        <label>
          Audio sensor notes
          <textarea value={evidence.audioNotes} onChange={(event) => updateField("audioNotes", event.target.value)} />
        </label>
        <label>
          Satellite notes
          <textarea value={evidence.satelliteNotes} onChange={(event) => updateField("satelliteNotes", event.target.value)} />
        </label>
        <label>
          Assessment confidence
          <input
            max={100}
            min={0}
            type="number"
            value={evidence.confidence}
            onChange={(event) => updateField("confidence", event.target.value)}
          />
        </label>

        {error ? (
          <div className="error-line">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <button className="action-button" disabled={isLoading} type="submit">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Satellite size={18} />}
          Fuse Post-Strike Evidence
        </button>
      </form>

      {result ? (
        <div className="recommendation-output">
          <div className="output-header">
            <CheckCircle2 size={18} />
            <strong>{result.status.replace("-", " ")}</strong>
            <span>{result.confidenceScore}% confidence</span>
          </div>
          <div className="planner-grid">
            {result.sourceReports.map((report) => (
              <article key={report.id}>
                {report.type === "camera" ? <Camera size={16} /> : <Radar size={16} />}
                <span>{report.label}</span>
                <strong>{report.status}</strong>
              </article>
            ))}
          </div>
          <ul>
            {result.observedEffects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
