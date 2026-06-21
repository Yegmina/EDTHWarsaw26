"use client";

import { FormEvent, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  Plus,
  Radio,
  Route,
  ShieldAlert,
  Satellite,
  Trash2
} from "lucide-react";
import type {
  AgentAnalyzedPlan,
  ManualPlanInput as ManualPlanPayload,
  ManualTrajectoryPoint,
  TrajectoryAction
} from "@/app/types/pipeline";

type ManualPlanInputProps = {
  onPlanAnalyzed: (analysis: AgentAnalyzedPlan) => void;
};

const initialTrajectory: ManualTrajectoryPoint[] = [
  {
    id: "wp-1",
    label: "Launch corridor",
    lat: 55.62,
    lng: 36.92,
    altitudeM: 120,
    speedKmh: 110,
    etaOffsetMin: 0,
    action: "launch",
    notes: "Initial movement checkpoint and system readiness confirmation"
  },
  {
    id: "wp-2",
    label: "Transit checkpoint",
    lat: 55.71,
    lng: 37.18,
    altitudeM: 180,
    speedKmh: 135,
    etaOffsetMin: 18,
    action: "transit",
    notes: "Mid-route deconfliction and comms quality gate"
  },
  {
    id: "wp-3",
    label: "Observation hold",
    lat: 55.77,
    lng: 37.44,
    altitudeM: 210,
    speedKmh: 70,
    etaOffsetMin: 31,
    action: "observe",
    notes: "Sensor confirmation and final evidence capture window"
  },
  {
    id: "wp-4",
    label: "Egress lane",
    lat: 55.83,
    lng: 37.09,
    altitudeM: 160,
    speedKmh: 145,
    etaOffsetMin: 44,
    action: "egress",
    notes: "Exit path and post-event telemetry preservation"
  }
];

const initialForm = {
  planTitle: "Operator submitted plan",
  targetDescription: "Priority infrastructure node requiring post-action assessment planning",
  lat: "55.7558",
  lng: "37.6173",
  approachStrategy: "Low-exposure approach corridor with sensor review checkpoints and staged confirmation gates",
  timingConsiderations: "Night window with follow-up imagery collection scheduled at T+15m and T+60m",
  adAvoidanceStrategy: "Avoid known defended sectors, preserve standoff margin, and mark uncertain areas for analyst review",
  environmentalNotes: "Mixed cloud cover, variable wind, limited ground confirmation, and possible camera occlusion",
  additionalContext: "Plan requires verification chain, post-event collection readiness, and source metadata preservation",
  operatorName: "Warsaw26 analyst",
  assetPackage: "Primary platform, relay node, camera review cell, audio sensor monitor",
  sensorTasking: "Thermal/RGB video capture, public camera sweep, audio impulse check, satellite retask request",
  commsPlan: "Primary data link with backup relay; log handoff time and packet loss at each checkpoint",
  abortCriteria: "Abort on source mismatch, degraded comms, weather below threshold, or unresolved deconfliction flag",
  fallbackPlan: "Hold at observation checkpoint, preserve telemetry, switch to alternate collection window",
  bdaCollectionPlan: "Capture video frames, camera snapshots, audio event timestamps, and satellite request metadata"
};

const trajectoryActions: TrajectoryAction[] = ["launch", "transit", "hold", "observe", "effect", "egress", "recovery"];

export function ManualPlanInput({ onPlanAnalyzed }: ManualPlanInputProps) {
  const [form, setForm] = useState(initialForm);
  const [trajectory, setTrajectory] = useState<ManualTrajectoryPoint[]>(initialTrajectory);
  const [analysis, setAnalysis] = useState<AgentAnalyzedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTrajectoryPoint(id: string, updates: Partial<ManualTrajectoryPoint>) {
    setTrajectory((points) => points.map((point) => (point.id === id ? { ...point, ...updates } : point)));
  }

  function addTrajectoryPoint() {
    const last = trajectory[trajectory.length - 1] ?? initialTrajectory[0];
    setTrajectory((points) => [
      ...points,
      {
        id: `wp-${Date.now()}`,
        label: `Checkpoint ${points.length + 1}`,
        lat: Number((last.lat + 0.05).toFixed(4)),
        lng: Number((last.lng + 0.05).toFixed(4)),
        altitudeM: last.altitudeM,
        speedKmh: last.speedKmh,
        etaOffsetMin: last.etaOffsetMin + 10,
        action: "transit",
        notes: "Additional movement checkpoint"
      }
    ]);
  }

  function removeTrajectoryPoint(id: string) {
    setTrajectory((points) => (points.length <= 2 ? points : points.filter((point) => point.id !== id)));
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
      operatorName: form.operatorName,
      trajectory,
      assetPackage: form.assetPackage,
      sensorTasking: form.sensorTasking,
      commsPlan: form.commsPlan,
      abortCriteria: form.abortCriteria,
      fallbackPlan: form.fallbackPlan,
      bdaCollectionPlan: form.bdaCollectionPlan
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
    <section className="panel pipeline-card manual-plan-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 1</span>
          <h2>Manual Plan Input</h2>
        </div>
        <Brain size={20} />
      </div>

      <form className="planner-form" onSubmit={handleSubmit}>
        <div className="manual-section-title">
          <ClipboardCheck size={16} />
          <span>Package</span>
        </div>
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
            Reference latitude
            <input value={form.lat} onChange={(event) => updateField("lat", event.target.value)} />
          </label>
          <label>
            Reference longitude
            <input value={form.lng} onChange={(event) => updateField("lng", event.target.value)} />
          </label>
          <label>
            Operator
            <input value={form.operatorName} onChange={(event) => updateField("operatorName", event.target.value)} />
          </label>
        </div>

        <div className="manual-section-title">
          <Route size={16} />
          <span>Trajectory Movement</span>
          <button type="button" onClick={addTrajectoryPoint}>
            <Plus size={14} />
            Add checkpoint
          </button>
        </div>
        <div className="trajectory-list">
          {trajectory.map((point, index) => (
            <article className="trajectory-card" key={point.id}>
              <div className="trajectory-card-head">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input
                  value={point.label}
                  onChange={(event) => updateTrajectoryPoint(point.id, { label: event.target.value })}
                  aria-label={`Checkpoint ${index + 1} label`}
                />
                <button
                  aria-label={`Remove checkpoint ${index + 1}`}
                  disabled={trajectory.length <= 2}
                  onClick={() => removeTrajectoryPoint(point.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="trajectory-grid">
                <label>
                  Action
                  <select
                    value={point.action}
                    onChange={(event) =>
                      updateTrajectoryPoint(point.id, { action: event.target.value as TrajectoryAction })
                    }
                  >
                    {trajectoryActions.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ETA +min
                  <input
                    type="number"
                    value={point.etaOffsetMin}
                    onChange={(event) => updateTrajectoryPoint(point.id, { etaOffsetMin: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Lat
                  <input
                    value={point.lat}
                    onChange={(event) => updateTrajectoryPoint(point.id, { lat: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Lng
                  <input
                    value={point.lng}
                    onChange={(event) => updateTrajectoryPoint(point.id, { lng: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Alt m
                  <input
                    type="number"
                    value={point.altitudeM}
                    onChange={(event) => updateTrajectoryPoint(point.id, { altitudeM: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Speed km/h
                  <input
                    type="number"
                    value={point.speedKmh}
                    onChange={(event) => updateTrajectoryPoint(point.id, { speedKmh: Number(event.target.value) })}
                  />
                </label>
              </div>
              <label>
                Checkpoint notes
                <textarea
                  value={point.notes}
                  onChange={(event) => updateTrajectoryPoint(point.id, { notes: event.target.value })}
                />
              </label>
            </article>
          ))}
        </div>

        <div className="manual-section-title">
          <ShieldAlert size={16} />
          <span>Execution Setup</span>
        </div>
        <div className="planner-grid">
          <label>
            Asset package
            <textarea value={form.assetPackage} onChange={(event) => updateField("assetPackage", event.target.value)} />
          </label>
          <label>
            Sensor tasking
            <textarea value={form.sensorTasking} onChange={(event) => updateField("sensorTasking", event.target.value)} />
          </label>
          <label>
            Comms plan
            <textarea value={form.commsPlan} onChange={(event) => updateField("commsPlan", event.target.value)} />
          </label>
          <label>
            Abort criteria
            <textarea value={form.abortCriteria} onChange={(event) => updateField("abortCriteria", event.target.value)} />
          </label>
          <label>
            Fallback plan
            <textarea value={form.fallbackPlan} onChange={(event) => updateField("fallbackPlan", event.target.value)} />
          </label>
          <label>
            BDA collection plan
            <textarea
              value={form.bdaCollectionPlan}
              onChange={(event) => updateField("bdaCollectionPlan", event.target.value)}
            />
          </label>
        </div>

        <div className="manual-section-title">
          <Radio size={16} />
          <span>Analyst Notes</span>
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
              <Route size={16} />
              <span>Trajectory</span>
              <strong>{analysis.originalPlan.trajectory.length} checkpoints</strong>
            </article>
            <article>
              <Satellite size={16} />
              <span>BDA setup</span>
              <strong>{analysis.integratedRecommendation?.setupChecklist?.length ?? 0} items</strong>
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
