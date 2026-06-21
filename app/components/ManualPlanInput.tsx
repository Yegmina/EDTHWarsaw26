"use client";

import { FormEvent, useMemo, useState } from "react";
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
  ManualCollectionWindow,
  ManualSetupItem,
  ManualTrajectoryPoint,
  SetupStatus,
  TrajectoryAction,
  TrajectorySensorMode
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
    headingDeg: 82,
    holdSeconds: 0,
    sensorMode: "none",
    handoff: "Readiness cell",
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
    headingDeg: 96,
    holdSeconds: 0,
    sensorMode: "rgb-video",
    handoff: "Comms relay",
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
    headingDeg: 118,
    holdSeconds: 90,
    sensorMode: "thermal-video",
    handoff: "BDA review cell",
    notes: "Sensor confirmation and final evidence capture window"
  },
  {
    id: "wp-4",
    label: "Effect review gate",
    lat: 55.8,
    lng: 37.58,
    altitudeM: 190,
    speedKmh: 90,
    etaOffsetMin: 38,
    action: "effect",
    headingDeg: 140,
    holdSeconds: 45,
    sensorMode: "audio",
    handoff: "Event marker",
    notes: "Time-aligned source cue and initial damage-assessment marker"
  },
  {
    id: "wp-5",
    label: "Egress lane",
    lat: 55.83,
    lng: 37.09,
    altitudeM: 160,
    speedKmh: 145,
    etaOffsetMin: 44,
    action: "egress",
    headingDeg: 278,
    holdSeconds: 0,
    sensorMode: "none",
    handoff: "Recovery desk",
    notes: "Exit path and post-event telemetry preservation"
  }
];

const initialSetupItems: ManualSetupItem[] = [
  {
    id: "setup-1",
    label: "Source packet lock",
    owner: "Intake lead",
    status: "ready",
    notes: "Freeze source text, image links, timestamps, and analyst assumptions before execution review"
  },
  {
    id: "setup-2",
    label: "Telemetry retention",
    owner: "Platform desk",
    status: "ready",
    notes: "Preserve movement logs, sensor mode changes, dropped packets, and checkpoint handoffs"
  },
  {
    id: "setup-3",
    label: "Independent review queue",
    owner: "BDA cell",
    status: "pending",
    notes: "Queue satellite retask, camera sweep, and audio impulse review for post-event fusion"
  }
];

const initialCollectionWindows: ManualCollectionWindow[] = [
  {
    id: "window-1",
    label: "Immediate video pass",
    source: "video",
    offsetMin: 0,
    durationMin: 4,
    objective: "Capture thermal/RGB event frames, plume onset, and visible scene change"
  },
  {
    id: "window-2",
    label: "Public camera sweep",
    source: "camera",
    offsetMin: 15,
    durationMin: 10,
    objective: "Review nearby open camera sectors for flash, smoke, traffic halt, or scene brightness change"
  },
  {
    id: "window-3",
    label: "Satellite retask slot",
    source: "satellite",
    offsetMin: 60,
    durationMin: 20,
    objective: "Request independent image comparison for heat scarring, roof damage, and activity recovery"
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
const trajectorySensorModes: TrajectorySensorMode[] = [
  "none",
  "rgb-video",
  "thermal-video",
  "audio",
  "satellite-cue",
  "public-camera"
];
const setupStatuses: SetupStatus[] = ["ready", "pending", "blocked"];
const collectionSources: ManualCollectionWindow["source"][] = ["video", "camera", "audio", "satellite", "operator", "other"];

export function ManualPlanInput({ onPlanAnalyzed }: ManualPlanInputProps) {
  const [form, setForm] = useState(initialForm);
  const [trajectory, setTrajectory] = useState<ManualTrajectoryPoint[]>(initialTrajectory);
  const [setupItems, setSetupItems] = useState<ManualSetupItem[]>(initialSetupItems);
  const [collectionWindows, setCollectionWindows] = useState<ManualCollectionWindow[]>(initialCollectionWindows);
  const [analysis, setAnalysis] = useState<AgentAnalyzedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const routeStats = useMemo(() => summarizeRoute(trajectory), [trajectory]);
  const setupStats = useMemo(() => summarizeSetup(setupItems), [setupItems]);

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
        headingDeg: last.headingDeg,
        holdSeconds: 0,
        sensorMode: "rgb-video",
        handoff: "Operator review",
        notes: "Additional movement checkpoint"
      }
    ]);
  }

  function removeTrajectoryPoint(id: string) {
    setTrajectory((points) => (points.length <= 2 ? points : points.filter((point) => point.id !== id)));
  }

  function rebuildTrajectoryFromAnchor() {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const baseLat = Number.isFinite(lat) ? lat : 55.7558;
    const baseLng = Number.isFinite(lng) ? lng : 37.6173;
    setTrajectory([
      {
        id: `wp-${Date.now()}-1`,
        label: "Anchor departure",
        lat: Number((baseLat - 0.14).toFixed(4)),
        lng: Number((baseLng - 0.22).toFixed(4)),
        altitudeM: 130,
        speedKmh: 110,
        etaOffsetMin: 0,
        action: "launch",
        headingDeg: 64,
        holdSeconds: 0,
        sensorMode: "none",
        handoff: "Readiness cell",
        notes: "Synthetic departure checkpoint for route review"
      },
      {
        id: `wp-${Date.now()}-2`,
        label: "Transit gate A",
        lat: Number((baseLat - 0.08).toFixed(4)),
        lng: Number((baseLng - 0.1).toFixed(4)),
        altitudeM: 180,
        speedKmh: 135,
        etaOffsetMin: 14,
        action: "transit",
        headingDeg: 76,
        holdSeconds: 0,
        sensorMode: "rgb-video",
        handoff: "Comms relay",
        notes: "Route continuity and packet-loss check"
      },
      {
        id: `wp-${Date.now()}-3`,
        label: "Observation orbit",
        lat: Number((baseLat - 0.02).toFixed(4)),
        lng: Number((baseLng + 0.03).toFixed(4)),
        altitudeM: 210,
        speedKmh: 75,
        etaOffsetMin: 27,
        action: "observe",
        headingDeg: 112,
        holdSeconds: 120,
        sensorMode: "thermal-video",
        handoff: "BDA review cell",
        notes: "Thermal/RGB capture window and analyst confirmation gate"
      },
      {
        id: `wp-${Date.now()}-4`,
        label: "Event marker",
        lat: Number((baseLat + 0.02).toFixed(4)),
        lng: Number((baseLng + 0.07).toFixed(4)),
        altitudeM: 190,
        speedKmh: 90,
        etaOffsetMin: 34,
        action: "effect",
        headingDeg: 146,
        holdSeconds: 45,
        sensorMode: "audio",
        handoff: "Evidence fusion",
        notes: "Timed marker for source synchronization and post-event review"
      },
      {
        id: `wp-${Date.now()}-5`,
        label: "Recovery lane",
        lat: Number((baseLat + 0.12).toFixed(4)),
        lng: Number((baseLng - 0.12).toFixed(4)),
        altitudeM: 160,
        speedKmh: 145,
        etaOffsetMin: 48,
        action: "egress",
        headingDeg: 282,
        holdSeconds: 0,
        sensorMode: "none",
        handoff: "Recovery desk",
        notes: "Telemetry preservation and recovery handoff"
      }
    ]);
  }

  function updateSetupItem(id: string, updates: Partial<ManualSetupItem>) {
    setSetupItems((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function addSetupItem() {
    setSetupItems((items) => [
      ...items,
      {
        id: `setup-${Date.now()}`,
        label: `Setup item ${items.length + 1}`,
        owner: "Analyst desk",
        status: "pending",
        notes: "Describe readiness requirement, evidence dependency, or handoff condition"
      }
    ]);
  }

  function removeSetupItem(id: string) {
    setSetupItems((items) => (items.length <= 1 ? items : items.filter((item) => item.id !== id)));
  }

  function updateCollectionWindow(id: string, updates: Partial<ManualCollectionWindow>) {
    setCollectionWindows((windows) => windows.map((window) => (window.id === id ? { ...window, ...updates } : window)));
  }

  function addCollectionWindow() {
    setCollectionWindows((windows) => {
      const last = windows[windows.length - 1] ?? initialCollectionWindows[0];
      return [
        ...windows,
        {
          id: `window-${Date.now()}`,
          label: `Collection window ${windows.length + 1}`,
          source: "other",
          offsetMin: last.offsetMin + 20,
          durationMin: 10,
          objective: "Define source, timing, and expected observable"
        }
      ];
    });
  }

  function removeCollectionWindow(id: string) {
    setCollectionWindows((windows) => (windows.length <= 1 ? windows : windows.filter((window) => window.id !== id)));
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
      setupItems,
      collectionWindows,
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

      <div className="manual-overview-grid">
        <article>
          <Route size={16} />
          <span>Trajectory</span>
          <strong>{trajectory.length} checkpoints</strong>
          <p>{routeStats.distanceKm} km / {routeStats.durationMin} min review route</p>
        </article>
        <article>
          <Radio size={16} />
          <span>Sensor Gates</span>
          <strong>{routeStats.sensorGates}</strong>
          <p>{routeStats.handoffs} handoffs captured in the route package</p>
        </article>
        <article>
          <ClipboardCheck size={16} />
          <span>Setup</span>
          <strong>{setupStats.ready}/{setupItems.length} ready</strong>
          <p>{setupStats.blocked ? `${setupStats.blocked} blocked item requires review` : "No blocked setup item"}</p>
        </article>
        <article>
          <Satellite size={16} />
          <span>Collection</span>
          <strong>{collectionWindows.length} windows</strong>
          <p>Video, camera, audio, satellite, and operator review slots</p>
        </article>
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
          <div className="section-actions">
            <button type="button" onClick={rebuildTrajectoryFromAnchor}>
              Rebuild from anchor
            </button>
            <button type="button" onClick={addTrajectoryPoint}>
              <Plus size={14} />
              Add checkpoint
            </button>
          </div>
        </div>
        <div className="trajectory-preview" aria-label="Trajectory timeline preview">
          {trajectory.map((point, index) => (
            <div className="trajectory-preview-node" key={`${point.id}-preview`}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <span>{point.action}</span>
              <em>T+{point.etaOffsetMin}m</em>
            </div>
          ))}
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
                <label>
                  Heading deg
                  <input
                    type="number"
                    value={point.headingDeg}
                    onChange={(event) => updateTrajectoryPoint(point.id, { headingDeg: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Hold sec
                  <input
                    type="number"
                    value={point.holdSeconds}
                    onChange={(event) => updateTrajectoryPoint(point.id, { holdSeconds: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Sensor mode
                  <select
                    value={point.sensorMode}
                    onChange={(event) =>
                      updateTrajectoryPoint(point.id, { sensorMode: event.target.value as TrajectorySensorMode })
                    }
                  >
                    {trajectorySensorModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Handoff
                  <input
                    value={point.handoff}
                    onChange={(event) => updateTrajectoryPoint(point.id, { handoff: event.target.value })}
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
          <ClipboardCheck size={16} />
          <span>Setup Checklist</span>
          <div className="section-actions">
            <button type="button" onClick={addSetupItem}>
              <Plus size={14} />
              Add item
            </button>
          </div>
        </div>
        <div className="manual-array-list">
          {setupItems.map((item, index) => (
            <article className="manual-array-card" key={item.id}>
              <div className="manual-array-head">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input
                  aria-label={`Setup item ${index + 1} label`}
                  value={item.label}
                  onChange={(event) => updateSetupItem(item.id, { label: event.target.value })}
                />
                <button
                  aria-label={`Remove setup item ${index + 1}`}
                  disabled={setupItems.length <= 1}
                  onClick={() => removeSetupItem(item.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="manual-array-grid">
                <label>
                  Owner
                  <input value={item.owner} onChange={(event) => updateSetupItem(item.id, { owner: event.target.value })} />
                </label>
                <label>
                  Status
                  <select
                    value={item.status}
                    onChange={(event) => updateSetupItem(item.id, { status: event.target.value as SetupStatus })}
                  >
                    {setupStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea value={item.notes} onChange={(event) => updateSetupItem(item.id, { notes: event.target.value })} />
              </label>
            </article>
          ))}
        </div>

        <div className="manual-section-title">
          <Satellite size={16} />
          <span>Collection Windows</span>
          <div className="section-actions">
            <button type="button" onClick={addCollectionWindow}>
              <Plus size={14} />
              Add window
            </button>
          </div>
        </div>
        <div className="manual-array-list">
          {collectionWindows.map((window, index) => (
            <article className="manual-array-card" key={window.id}>
              <div className="manual-array-head">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input
                  aria-label={`Collection window ${index + 1} label`}
                  value={window.label}
                  onChange={(event) => updateCollectionWindow(window.id, { label: event.target.value })}
                />
                <button
                  aria-label={`Remove collection window ${index + 1}`}
                  disabled={collectionWindows.length <= 1}
                  onClick={() => removeCollectionWindow(window.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="manual-array-grid">
                <label>
                  Source
                  <select
                    value={window.source}
                    onChange={(event) =>
                      updateCollectionWindow(window.id, {
                        source: event.target.value as ManualCollectionWindow["source"]
                      })
                    }
                  >
                    {collectionSources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Offset +min
                  <input
                    type="number"
                    value={window.offsetMin}
                    onChange={(event) => updateCollectionWindow(window.id, { offsetMin: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Duration min
                  <input
                    type="number"
                    value={window.durationMin}
                    onChange={(event) => updateCollectionWindow(window.id, { durationMin: Number(event.target.value) })}
                  />
                </label>
              </div>
              <label>
                Objective
                <textarea
                  value={window.objective}
                  onChange={(event) => updateCollectionWindow(window.id, { objective: event.target.value })}
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
              <strong>{analysis.originalPlan.trajectory.length} checkpoints / {routeStats.distanceKm} km</strong>
            </article>
            <article>
              <Satellite size={16} />
              <span>Collection</span>
              <strong>{analysis.originalPlan.collectionWindows.length} windows</strong>
            </article>
            <article>
              <ClipboardCheck size={16} />
              <span>Setup ready</span>
              <strong>{setupStats.ready}/{analysis.originalPlan.setupItems.length}</strong>
            </article>
          </div>
          <ul>
            {[...analysis.agentAnalysis.strengths, ...analysis.agentAnalysis.recommendedModifications].slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function summarizeRoute(points: ManualTrajectoryPoint[]) {
  const sorted = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .slice()
    .sort((a, b) => a.etaOffsetMin - b.etaOffsetMin);
  const distanceKm = sorted.reduce((total, point, index) => {
    const previous = sorted[index - 1];
    return previous ? total + distanceKmBetween(previous.lat, previous.lng, point.lat, point.lng) : total;
  }, 0);
  const firstEta = sorted[0]?.etaOffsetMin ?? 0;
  const lastEta = sorted[sorted.length - 1]?.etaOffsetMin ?? firstEta;
  const sensorGates = points.filter((point) => point.sensorMode !== "none").length;
  const handoffs = points.filter((point) => point.handoff.trim()).length;

  return {
    distanceKm: distanceKm.toFixed(1),
    durationMin: Math.max(0, lastEta - firstEta),
    sensorGates,
    handoffs
  };
}

function summarizeSetup(items: ManualSetupItem[]) {
  return items.reduce(
    (stats, item) => {
      stats[item.status] += 1;
      return stats;
    },
    { ready: 0, pending: 0, blocked: 0 } as Record<SetupStatus, number>
  );
}

function distanceKmBetween(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
