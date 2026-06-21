"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Gauge,
  GitBranch,
  ListChecks,
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
  ManualContingencyBranch,
  ManualDecisionGate,
  ManualSetupItem,
  ManualTrajectoryPoint,
  ContingencyPriority,
  DecisionGateStatus,
  SetupStatus,
  TrajectoryAction,
  TrajectorySensorMode
} from "@/app/types/pipeline";

type ManualPlanInputProps = {
  onPlanAnalyzed: (analysis: AgentAnalyzedPlan) => void;
};

type PlanningTimelineItem = {
  id: string;
  type: "checkpoint" | "gate" | "collection";
  etaOffsetMin: number;
  label: string;
  detail: string;
  tone: "success" | "warning" | "info";
};

type ReadinessTone = "ready" | "review" | "blocked";

type ReadinessFinding = {
  label: string;
  value: string;
  detail: string;
};

type ManualReadinessSummary = {
  score: number;
  tone: ReadinessTone;
  label: string;
  summary: string;
  findings: ReadinessFinding[];
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
    objective: "Capture thermal/RGB event frames and visible scene change"
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

const initialDecisionGates: ManualDecisionGate[] = [
  {
    id: "gate-1",
    label: "Source match gate",
    etaOffsetMin: 12,
    owner: "Intake lead",
    condition: "Continue only if current-state claim still matches the reviewed source packet",
    status: "go",
    action: "Proceed to transit checkpoint and preserve source snapshot"
  },
  {
    id: "gate-2",
    label: "Sensor quality gate",
    etaOffsetMin: 27,
    owner: "BDA review cell",
    condition: "Hold if thermal/RGB capture is degraded or public camera sector is occluded",
    status: "review",
    action: "Re-check camera/audio windows and extend observation hold"
  },
  {
    id: "gate-3",
    label: "Evidence fusion gate",
    etaOffsetMin: 45,
    owner: "Fusion desk",
    condition: "Do not finalize status until at least two source channels are retained with timestamps",
    status: "hold",
    action: "Queue satellite retask and keep status provisional"
  }
];

const initialContingencyBranches: ManualContingencyBranch[] = [
  {
    id: "branch-1",
    trigger: "Primary video feed drops before event marker",
    action: "Switch to public camera and audio-first evidence workflow",
    owner: "Sensor desk",
    priority: "primary",
    notes: "Keep the last valid frame and packet-loss marker in the evidence log"
  },
  {
    id: "branch-2",
    trigger: "Weather or smoke blocks visual confirmation",
    action: "Defer final assessment until satellite retask and delayed camera sweep",
    owner: "BDA review cell",
    priority: "secondary",
    notes: "Use confidence penalty and keep conclusion status unresolved"
  },
  {
    id: "branch-3",
    trigger: "Source contradiction appears during collection",
    action: "Freeze automated conclusion and route all sources to human review",
    owner: "Fusion desk",
    priority: "emergency",
    notes: "Flag conflicting source metadata in Stage 3 handoff report"
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
const decisionGateStatuses: DecisionGateStatus[] = ["go", "hold", "review", "abort"];
const contingencyPriorities: ContingencyPriority[] = ["primary", "secondary", "emergency"];

export function ManualPlanInput({ onPlanAnalyzed }: ManualPlanInputProps) {
  const [form, setForm] = useState(initialForm);
  const [trajectory, setTrajectory] = useState<ManualTrajectoryPoint[]>(initialTrajectory);
  const [setupItems, setSetupItems] = useState<ManualSetupItem[]>(initialSetupItems);
  const [collectionWindows, setCollectionWindows] = useState<ManualCollectionWindow[]>(initialCollectionWindows);
  const [decisionGates, setDecisionGates] = useState<ManualDecisionGate[]>(initialDecisionGates);
  const [contingencyBranches, setContingencyBranches] =
    useState<ManualContingencyBranch[]>(initialContingencyBranches);
  const [analysis, setAnalysis] = useState<AgentAnalyzedPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const routeStats = useMemo(() => summarizeRoute(trajectory), [trajectory]);
  const routeSegments = useMemo(() => buildRouteSegments(trajectory), [trajectory]);
  const setupStats = useMemo(() => summarizeSetup(setupItems), [setupItems]);
  const decisionStats = useMemo(() => summarizeDecisionGates(decisionGates), [decisionGates]);
  const contingencyStats = useMemo(() => summarizeContingencies(contingencyBranches), [contingencyBranches]);
  const planningTimeline = useMemo(
    () => buildPlanningTimeline(trajectory, decisionGates, collectionWindows),
    [collectionWindows, decisionGates, trajectory]
  );
  const readiness = useMemo(
    () => summarizeManualReadiness({
      trajectory,
      setupItems,
      collectionWindows,
      decisionGates,
      contingencyBranches
    }),
    [collectionWindows, contingencyBranches, decisionGates, setupItems, trajectory]
  );
  const manualPayload = useMemo<ManualPlanPayload>(
    () => ({
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
      decisionGates,
      contingencyBranches,
      assetPackage: form.assetPackage,
      sensorTasking: form.sensorTasking,
      commsPlan: form.commsPlan,
      abortCriteria: form.abortCriteria,
      fallbackPlan: form.fallbackPlan,
      bdaCollectionPlan: form.bdaCollectionPlan
    }),
    [collectionWindows, contingencyBranches, decisionGates, form, setupItems, trajectory]
  );

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

  function updateDecisionGate(id: string, updates: Partial<ManualDecisionGate>) {
    setDecisionGates((gates) => gates.map((gate) => (gate.id === id ? { ...gate, ...updates } : gate)));
  }

  function addDecisionGate() {
    setDecisionGates((gates) => {
      const last = gates[gates.length - 1] ?? initialDecisionGates[0];
      return [
        ...gates,
        {
          id: `gate-${Date.now()}`,
          label: `Decision gate ${gates.length + 1}`,
          etaOffsetMin: last.etaOffsetMin + 10,
          owner: "Review lead",
          condition: "Define the condition that must be true before the route package continues",
          status: "review",
          action: "Define continuation, hold, or escalation action"
        }
      ];
    });
  }

  function removeDecisionGate(id: string) {
    setDecisionGates((gates) => (gates.length <= 1 ? gates : gates.filter((gate) => gate.id !== id)));
  }

  function updateContingencyBranch(id: string, updates: Partial<ManualContingencyBranch>) {
    setContingencyBranches((branches) =>
      branches.map((branch) => (branch.id === id ? { ...branch, ...updates } : branch))
    );
  }

  function addContingencyBranch() {
    setContingencyBranches((branches) => [
      ...branches,
      {
        id: `branch-${Date.now()}`,
        trigger: `Contingency trigger ${branches.length + 1}`,
        action: "Define alternate evidence, timing, or review path",
        owner: "Review lead",
        priority: "secondary",
        notes: "Describe how this branch changes collection, confidence, or handoff"
      }
    ]);
  }

  function removeContingencyBranch(id: string) {
    setContingencyBranches((branches) =>
      branches.length <= 1 ? branches : branches.filter((branch) => branch.id !== id)
    );
  }

  function handleDownloadManualPackage() {
    const exportedAt = new Date().toISOString();
    downloadJson(
      {
        exportedAt,
        package: manualPayload,
        derived: {
          routeStats,
          routeSegments,
          setupStats,
          decisionStats,
          contingencyStats,
          readiness,
          planningTimeline
        }
      },
      `manual-plan-${slugify(form.planTitle)}-${exportedAt.replace(/[:.]/g, "-")}.json`
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/manual-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualPayload)
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
        <div className="manual-header-actions">
          <button type="button" onClick={handleDownloadManualPackage}>
            <Download size={15} />
            Export package
          </button>
          <Brain size={20} />
        </div>
      </div>

      <div className="manual-overview-grid">
        <article className={`readiness-card readiness-${readiness.tone}`}>
          <Gauge size={16} />
          <span>Readiness</span>
          <strong>{readiness.score}%</strong>
          <p>{readiness.label}</p>
        </article>
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
        <article>
          <ListChecks size={16} />
          <span>Decision Gates</span>
          <strong>{decisionGates.length} gates</strong>
          <p>{decisionStats.go} go / {decisionStats.review + decisionStats.hold} review-or-hold checkpoints</p>
        </article>
        <article>
          <GitBranch size={16} />
          <span>Branches</span>
          <strong>{contingencyBranches.length} branches</strong>
          <p>{contingencyStats.emergency} emergency path in the contingency package</p>
        </article>
      </div>

      <div className="readiness-board">
        <section className="readiness-score-panel">
          <div className={`readiness-score-ring readiness-${readiness.tone}`}>
            <strong>{readiness.score}</strong>
            <span>READINESS</span>
          </div>
          <div className="readiness-bar" aria-label={`Manual package readiness ${readiness.score}%`}>
            <span style={{ width: `${readiness.score}%` }} />
          </div>
          <p>{readiness.summary}</p>
        </section>

        <section className="readiness-findings">
          {readiness.findings.map((finding) => (
            <article key={finding.label}>
              <span>{finding.label}</span>
              <strong>{finding.value}</strong>
              <p>{finding.detail}</p>
            </article>
          ))}
        </section>

        <section className="planning-timeline">
          <div>
            <Route size={16} />
            <span>Planning Timeline</span>
          </div>
          <div className="planning-timeline-list">
            {planningTimeline.map((item) => (
              <article className={`timeline-chip timeline-${item.tone}`} key={item.id}>
                <span>T+{item.etaOffsetMin}m</span>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
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
          <Route size={16} />
          <span>Route Geometry</span>
        </div>
        <div className="route-segment-grid">
          {routeSegments.map((segment) => (
            <article className="route-segment-card" key={segment.id}>
              <div>
                <strong>{segment.label}</strong>
                <span>{segment.distanceKm} km / {segment.durationMin} min</span>
              </div>
              <p>{segment.from} to {segment.to}</p>
              <dl>
                <div>
                  <dt>Heading</dt>
                  <dd>{segment.headingChangeDeg}</dd>
                </div>
                <div>
                  <dt>Altitude</dt>
                  <dd>{segment.altitudeDeltaM}</dd>
                </div>
                <div>
                  <dt>Sensor</dt>
                  <dd>{segment.sensorChain}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="manual-section-title">
          <ListChecks size={16} />
          <span>Decision Gates</span>
          <div className="section-actions">
            <button type="button" onClick={addDecisionGate}>
              <Plus size={14} />
              Add gate
            </button>
          </div>
        </div>
        <div className="manual-array-list">
          {decisionGates.map((gate, index) => (
            <article className="manual-array-card" key={gate.id}>
              <div className="manual-array-head">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input
                  aria-label={`Decision gate ${index + 1} label`}
                  value={gate.label}
                  onChange={(event) => updateDecisionGate(gate.id, { label: event.target.value })}
                />
                <button
                  aria-label={`Remove decision gate ${index + 1}`}
                  disabled={decisionGates.length <= 1}
                  onClick={() => removeDecisionGate(gate.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="manual-array-grid">
                <label>
                  ETA +min
                  <input
                    type="number"
                    value={gate.etaOffsetMin}
                    onChange={(event) => updateDecisionGate(gate.id, { etaOffsetMin: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Owner
                  <input value={gate.owner} onChange={(event) => updateDecisionGate(gate.id, { owner: event.target.value })} />
                </label>
                <label>
                  Status
                  <select
                    value={gate.status}
                    onChange={(event) => updateDecisionGate(gate.id, { status: event.target.value as DecisionGateStatus })}
                  >
                    {decisionGateStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Condition
                <textarea
                  value={gate.condition}
                  onChange={(event) => updateDecisionGate(gate.id, { condition: event.target.value })}
                />
              </label>
              <label>
                Required action
                <textarea
                  value={gate.action}
                  onChange={(event) => updateDecisionGate(gate.id, { action: event.target.value })}
                />
              </label>
            </article>
          ))}
        </div>

        <div className="manual-section-title">
          <GitBranch size={16} />
          <span>Contingency Branches</span>
          <div className="section-actions">
            <button type="button" onClick={addContingencyBranch}>
              <Plus size={14} />
              Add branch
            </button>
          </div>
        </div>
        <div className="manual-array-list">
          {contingencyBranches.map((branch, index) => (
            <article className="manual-array-card" key={branch.id}>
              <div className="manual-array-head">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input
                  aria-label={`Contingency branch ${index + 1} trigger`}
                  value={branch.trigger}
                  onChange={(event) => updateContingencyBranch(branch.id, { trigger: event.target.value })}
                />
                <button
                  aria-label={`Remove contingency branch ${index + 1}`}
                  disabled={contingencyBranches.length <= 1}
                  onClick={() => removeContingencyBranch(branch.id)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="manual-array-grid">
                <label>
                  Owner
                  <input
                    value={branch.owner}
                    onChange={(event) => updateContingencyBranch(branch.id, { owner: event.target.value })}
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={branch.priority}
                    onChange={(event) =>
                      updateContingencyBranch(branch.id, { priority: event.target.value as ContingencyPriority })
                    }
                  >
                    {contingencyPriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Branch action
                <textarea
                  value={branch.action}
                  onChange={(event) => updateContingencyBranch(branch.id, { action: event.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea
                  value={branch.notes}
                  onChange={(event) => updateContingencyBranch(branch.id, { notes: event.target.value })}
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
            <article>
              <ListChecks size={16} />
              <span>Decision gates</span>
              <strong>{analysis.originalPlan.decisionGates.length}</strong>
            </article>
            <article>
              <GitBranch size={16} />
              <span>Contingencies</span>
              <strong>{analysis.originalPlan.contingencyBranches.length}</strong>
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

function buildRouteSegments(points: ManualTrajectoryPoint[]) {
  const sorted = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .slice()
    .sort((a, b) => a.etaOffsetMin - b.etaOffsetMin);

  return sorted.slice(1).map((point, index) => {
    const previous = sorted[index];
    const distanceKm = distanceKmBetween(previous.lat, previous.lng, point.lat, point.lng);
    const durationMin = Math.max(0, point.etaOffsetMin - previous.etaOffsetMin);
    const headingChange = normalizeHeadingDelta(point.headingDeg - previous.headingDeg);
    const altitudeDelta = Math.round(point.altitudeM - previous.altitudeM);
    const sensorChain = previous.sensorMode === point.sensorMode
      ? point.sensorMode
      : `${previous.sensorMode} -> ${point.sensorMode}`;

    return {
      id: `${previous.id}-${point.id}`,
      label: `Leg ${String(index + 1).padStart(2, "0")}`,
      from: previous.label,
      to: point.label,
      distanceKm: distanceKm.toFixed(1),
      durationMin,
      headingChangeDeg: `${headingChange > 0 ? "+" : ""}${headingChange} deg`,
      altitudeDeltaM: `${altitudeDelta > 0 ? "+" : ""}${altitudeDelta} m`,
      sensorChain
    };
  });
}

function buildPlanningTimeline(
  trajectory: ManualTrajectoryPoint[],
  decisionGates: ManualDecisionGate[],
  collectionWindows: ManualCollectionWindow[]
): PlanningTimelineItem[] {
  const checkpointItems: PlanningTimelineItem[] = trajectory.map((point) => ({
    id: `checkpoint-${point.id}`,
    type: "checkpoint",
    etaOffsetMin: point.etaOffsetMin,
    label: point.label,
    detail: `${point.action} / ${point.sensorMode} / ${point.handoff || "handoff pending"}`,
    tone: point.sensorMode === "none" ? "info" : "success"
  }));

  const gateItems: PlanningTimelineItem[] = decisionGates.map((gate) => ({
    id: `gate-${gate.id}`,
    type: "gate",
    etaOffsetMin: gate.etaOffsetMin,
    label: gate.label,
    detail: `${gate.status.toUpperCase()} / ${gate.owner}`,
    tone: gate.status === "go" ? "success" : gate.status === "abort" || gate.status === "hold" ? "warning" : "info"
  }));

  const collectionItems: PlanningTimelineItem[] = collectionWindows.map((window) => ({
    id: `collection-${window.id}`,
    type: "collection",
    etaOffsetMin: window.offsetMin,
    label: window.label,
    detail: `${window.source} / ${window.durationMin} min`,
    tone: window.source === "satellite" || window.source === "operator" ? "info" : "success"
  }));

  const typeOrder: Record<PlanningTimelineItem["type"], number> = {
    checkpoint: 1,
    gate: 2,
    collection: 3
  };

  return [...checkpointItems, ...gateItems, ...collectionItems].sort(
    (a, b) => a.etaOffsetMin - b.etaOffsetMin || typeOrder[a.type] - typeOrder[b.type]
  );
}

function summarizeManualReadiness({
  trajectory,
  setupItems,
  collectionWindows,
  decisionGates,
  contingencyBranches
}: Pick<
  ManualPlanPayload,
  "trajectory" | "setupItems" | "collectionWindows" | "decisionGates" | "contingencyBranches"
>): ManualReadinessSummary {
  const setupStats = summarizeSetup(setupItems);
  const decisionStats = summarizeDecisionGates(decisionGates);
  const sourceTypes = new Set(collectionWindows.map((window) => window.source));
  const routeHasTimedSensors = trajectory.some((point) => point.sensorMode !== "none" && point.etaOffsetMin >= 0);
  const hasFallbackBranch = contingencyBranches.some(
    (branch) => branch.priority === "primary" || branch.priority === "emergency"
  );
  const penalties = [
    setupStats.pending * 5,
    setupStats.blocked * 18,
    decisionStats.review * 4,
    decisionStats.hold * 7,
    decisionStats.abort * 25,
    routeHasTimedSensors ? 0 : 12,
    sourceTypes.size >= 3 ? 0 : 8,
    hasFallbackBranch ? 0 : 10,
    trajectory.length >= 4 ? 0 : 8
  ];
  const score = clampScore(100 - penalties.reduce((total, penalty) => total + penalty, 0));
  const tone: ReadinessTone = decisionStats.abort || setupStats.blocked ? "blocked" : score >= 82 ? "ready" : "review";
  const label =
    tone === "blocked" ? "Blocked item present" : tone === "ready" ? "Ready for review handoff" : "Review before handoff";
  const summary =
    tone === "ready"
      ? "Package has route timing, sensor windows, decision gates, and fallback branches ready for handoff."
      : "Package is usable, but unresolved gates, setup posture, or source coverage should be reviewed before handoff.";

  return {
    score,
    tone,
    label,
    summary,
    findings: [
      {
        label: "Setup posture",
        value: `${setupStats.ready}/${setupItems.length}`,
        detail: `${setupStats.pending} pending, ${setupStats.blocked} blocked`
      },
      {
        label: "Gate posture",
        value: `${decisionStats.go}/${decisionGates.length}`,
        detail: `${decisionStats.review} review, ${decisionStats.hold} hold, ${decisionStats.abort} abort`
      },
      {
        label: "Source coverage",
        value: `${sourceTypes.size} types`,
        detail: collectionWindows.map((window) => `${window.source} T+${window.offsetMin}m`).join(", ")
      },
      {
        label: "Fallback posture",
        value: `${contingencyBranches.length} branches`,
        detail: `${contingencyBranches.filter((branch) => branch.priority === "emergency").length} emergency branch`
      }
    ]
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

function summarizeDecisionGates(gates: ManualDecisionGate[]) {
  return gates.reduce(
    (stats, gate) => {
      stats[gate.status] += 1;
      return stats;
    },
    { go: 0, hold: 0, review: 0, abort: 0 } as Record<DecisionGateStatus, number>
  );
}

function summarizeContingencies(branches: ManualContingencyBranch[]) {
  return branches.reduce(
    (stats, branch) => {
      stats[branch.priority] += 1;
      return stats;
    },
    { primary: 0, secondary: 0, emergency: 0 } as Record<ContingencyPriority, number>
  );
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "package";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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

function normalizeHeadingDelta(value: number) {
  const normalized = ((value + 540) % 360) - 180;
  return Math.round(normalized);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
