"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, Crosshair, Database, Loader2, Radar, Route, Shield } from "lucide-react";
import type { IntakePlanningSeed, StrikeRecommendation } from "@/app/types/pipeline";

type StrikePlannerProps = {
  intakeSeed?: IntakePlanningSeed;
  onRecommendationComplete: (recommendation: StrikeRecommendation) => void;
};

type PlannerForm = {
  targetSummary: string;
  areaName: string;
  lat: string;
  lng: string;
  priority: "critical" | "high" | "medium" | "low";
  constraints: string;
};

const defaultForm: PlannerForm = {
  targetSummary: "Priority logistics and communications node",
  areaName: "Northern sector reference area",
  lat: "55.7558",
  lng: "37.6173",
  priority: "high",
  constraints: "Dense air-defense coverage, uncertain weather ceiling, limited post-event imagery window"
};

export function StrikePlanner({ intakeSeed, onRecommendationComplete }: StrikePlannerProps) {
  const [form, setForm] = useState(defaultForm);
  const [recommendation, setRecommendation] = useState<StrikeRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetSummary: form.targetSummary,
          areaName: form.areaName,
          coordinates: {
            lat: Number(form.lat),
            lng: Number(form.lng)
          },
          priority: form.priority,
          constraints: form.constraints
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Recommendation failed.");
      }

      setRecommendation(body);
      onRecommendationComplete(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recommendation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyIntakeSeed() {
    if (!intakeSeed?.available) {
      return;
    }

    setForm({
      targetSummary: intakeSeed.targetSummary,
      areaName: intakeSeed.areaName,
      lat: formatCoordinate(intakeSeed.coordinates.lat),
      lng: formatCoordinate(intakeSeed.coordinates.lng),
      priority: intakeSeed.priority,
      constraints: intakeSeed.constraints
    });
    setRecommendation(null);
    setError("");
  }

  return (
    <section className="panel pipeline-card">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 1</span>
          <h2>Automated Recommendation</h2>
        </div>
        <Crosshair size={20} />
      </div>

      {intakeSeed?.available ? (
        <div className="intake-seed-card">
          <div>
            <Database size={16} />
            <strong>Stage 0 intake packet</strong>
            <span>{intakeSeed.confidence} confidence</span>
          </div>
          <p>{intakeSeed.brief}</p>
          <div className="intake-seed-meta">
            <span>{intakeSeed.sourceTitle}</span>
            <span>{intakeSeed.observationCount} observations</span>
            <span>{intakeSeed.gapCount} gaps</span>
          </div>
          <button type="button" onClick={applyIntakeSeed}>
            Apply intake packet
          </button>
        </div>
      ) : null}

      <form className="planner-form" onSubmit={handleSubmit}>
        <label>
          Target package
          <input
            value={form.targetSummary}
            onChange={(event) => updateField("targetSummary", event.target.value)}
            placeholder="Priority node, logistics site, relay point..."
          />
        </label>
        <label>
          Area label
          <input
            value={form.areaName}
            onChange={(event) => updateField("areaName", event.target.value)}
            placeholder="Operational area reference"
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
            Priority
            <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        <label>
          Constraints
          <textarea
            value={form.constraints}
            onChange={(event) => updateField("constraints", event.target.value)}
            placeholder="Known uncertainty, source gaps, weather, airspace, sensor limits..."
          />
        </label>

        {error ? (
          <div className="error-line">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        <button className="action-button" disabled={isLoading} type="submit">
          {isLoading ? <Loader2 className="spin" size={18} /> : <Radar size={18} />}
          Generate Recommendation
        </button>
      </form>

      {recommendation ? (
        <div className="recommendation-output">
          <div className="output-header">
            <CheckCircle2 size={18} />
            <strong>{recommendation.confidenceScore}% confidence</strong>
            <span>{recommendation.riskLevel} risk</span>
          </div>
          <div className="planner-grid">
            <article>
              <Route size={16} />
              <span>Corridor</span>
              <strong>{recommendation.approachCorridor}</strong>
            </article>
            <article>
              <Shield size={16} />
              <span>Standoff</span>
              <strong>{recommendation.standoffDistanceKm} km</strong>
            </article>
            <article>
              <Radar size={16} />
              <span>Window</span>
              <strong>{recommendation.recommendedWindow}</strong>
            </article>
          </div>
          <ul>
            {recommendation.rationale.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(4) : "0.0000";
}
