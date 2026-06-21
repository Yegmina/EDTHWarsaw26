// app/components/AnalysisDashboard.tsx

"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileText,
  Gauge,
  Lightbulb,
  Shield,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import type { AnalysisConclusion, PostStrikeData, StrikeRecommendation } from "@/app/types/pipeline";

type AnalysisDashboardProps = {
  recommendation: StrikeRecommendation;
  postStrikeData: PostStrikeData;
};

type DashboardView = "summary" | "effectiveness" | "lessons" | "parameters" | "audit";

type KeyMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "info";
  icon: "check" | "shield" | "chart" | "trend";
};

type Objective = {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning";
};

type TimelineItem = {
  time: string;
  label: string;
  detail: string;
};

type SourceStatus = PostStrikeData["sourceReports"][number]["status"];

const statusLabels: Record<PostStrikeData["status"], string> = {
  destroyed: "destroyed",
  "partially-damaged": "partially damaged",
  active: "active",
  unknown: "unknown"
};

const statusOutcome: Record<PostStrikeData["status"], string> = {
  destroyed: "Target effects confirmed",
  "partially-damaged": "Partial effects confirmed",
  active: "Target still active",
  unknown: "Outcome unresolved"
};

const statusDetail: Record<PostStrikeData["status"], string> = {
  destroyed: "Primary effects are supported by available post-event sources.",
  "partially-damaged": "Post-event sources indicate degradation, but not full confirmation.",
  active: "Submitted sources do not support a completed effect.",
  unknown: "Submitted sources are not strong enough to support a firm conclusion."
};

const reportStatusRank: Record<SourceStatus, number> = {
  confirmed: 4,
  supporting: 3,
  pending: 2,
  conflicting: 1
};

export function AnalysisDashboard({ recommendation, postStrikeData }: AnalysisDashboardProps) {
  const [activeView, setActiveView] = useState<DashboardView>("summary");

  const report = useMemo(() => buildDashboardReport(recommendation, postStrikeData), [recommendation, postStrikeData]);
  const { conclusions, keyMetrics, objectives, timeline, statusCounts, evidenceScore, exportPayload } = report;

  function handleDownloadReport() {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analysis-report-${postStrikeData.id}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pipeline-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">Stage 3</span>
          <h2>Analysis Conclusions & Strategic Insights</h2>
        </div>
        <div className="header-metrics">
          <div className="metric-badge">
            <Gauge size={14} />
            <span>Confidence</span>
            <strong>{conclusions.confidenceScore}%</strong>
          </div>
          <div className="metric-badge">
            <Activity size={14} />
            <span>Effectiveness</span>
            <strong className="text-emerald">
              {conclusions.effectiveness.rating.replace("-", " ").toUpperCase()}
            </strong>
          </div>
          <button className="download-report" onClick={handleDownloadReport} type="button">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-nav">
          <button
            className={`nav-item ${activeView === "summary" ? "nav-active" : ""}`}
            onClick={() => setActiveView("summary")}
          >
            <FileText size={16} />
            Executive Summary
          </button>
          <button
            className={`nav-item ${activeView === "effectiveness" ? "nav-active" : ""}`}
            onClick={() => setActiveView("effectiveness")}
          >
            <Target size={16} />
            Effectiveness Analysis
          </button>
          <button
            className={`nav-item ${activeView === "lessons" ? "nav-active" : ""}`}
            onClick={() => setActiveView("lessons")}
          >
            <Lightbulb size={16} />
            Lessons Learned
          </button>
          <button
            className={`nav-item ${activeView === "parameters" ? "nav-active" : ""}`}
            onClick={() => setActiveView("parameters")}
          >
            <Zap size={16} />
            Parameter Adjustments
          </button>
          <button
            className={`nav-item ${activeView === "audit" ? "nav-active" : ""}`}
            onClick={() => setActiveView("audit")}
          >
            <ClipboardList size={16} />
            Evidence Audit
          </button>
        </div>

        <div className="dashboard-content">
          {activeView === "summary" && (
            <div className="summary-view">
              <div className="executive-summary">
                <h3>
                  <FileText size={20} />
                  Executive Summary
                </h3>
                <p className="summary-text">{conclusions.summary}</p>
              </div>

              <div className="key-metrics-grid">
                {keyMetrics.map((metric) => (
                  <div className="key-metric" key={metric.label}>
                    <div className={`metric-icon ${metric.tone}`}>
                      {metric.icon === "check" && <CheckCircle2 size={24} />}
                      {metric.icon === "shield" && <Shield size={24} />}
                      {metric.icon === "chart" && <BarChart3 size={24} />}
                      {metric.icon === "trend" && <TrendingUp size={24} />}
                    </div>
                    <div className="metric-content">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <p>{metric.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="timeline-summary">
                <h4>Assessment Timeline</h4>
                <div className="timeline">
                  {timeline.map((item, index) => (
                    <div className="timeline-item" key={`${item.time}-${item.label}-${index}`}>
                      <div className="timeline-marker complete" />
                      <div>
                        <strong>{item.time}</strong>
                        <p>{item.label} - {item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === "effectiveness" && (
            <div className="effectiveness-view">
              <h3>
                <Target size={20} />
                Effectiveness Assessment
              </h3>

              <div className="effectiveness-grid">
                <div className="effectiveness-card">
                  <h4>Primary Objectives</h4>
                  <div className="objective-list">
                    {objectives.map((objective) => (
                      <div className={`objective-item ${objective.tone}`} key={objective.label}>
                        {objective.tone === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        <div>
                          <strong>{objective.label}</strong>
                          <span>{objective.value} - {objective.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="effectiveness-card">
                  <h4>Effectiveness Factors</h4>
                  <ul className="factors-list">
                    {conclusions.effectiveness.factors.map((factor) => (
                      <li key={factor}>
                        <ArrowUpRight size={14} />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="effectiveness-card">
                  <h4>Recommendation vs Evidence</h4>
                  <div className="comparison-grid">
                    <div className="comparison-item">
                      <span>Plan</span>
                      <strong>{recommendation.confidenceScore}% confidence</strong>
                    </div>
                    <div className="comparison-item">
                      <span>Evidence</span>
                      <strong>{postStrikeData.confidenceScore}% confidence</strong>
                    </div>
                    <div className="comparison-item">
                      <span>Delta</span>
                      <strong className={evidenceScore.delta >= 0 ? "text-emerald" : "text-amber"}>
                        {evidenceScore.delta >= 0 ? "+" : ""}{evidenceScore.delta}%
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "lessons" && (
            <div className="lessons-view">
              <h3>
                <Lightbulb size={20} />
                Lessons Learned
              </h3>

              <div className="lessons-grid">
                {conclusions.lessonsLearned.map((lesson, index) => (
                  <div className="lesson-card" key={lesson}>
                    <div className="lesson-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className="lesson-content">
                      <p>{lesson}</p>
                      <div className="lesson-tags">
                        <span className={`tag ${lessonTagClass(index)}`}>{lessonTagLabel(index)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "parameters" && (
            <div className="parameters-view">
              <h3>
                <Zap size={20} />
                Recommended Parameter Adjustments
              </h3>

              <div className="parameters-list">
                {conclusions.parameterAdjustments.map((adjustment, index) => (
                  <div className="parameter-card" key={adjustment}>
                    <div className="parameter-header">
                      <div className="parameter-icon">
                        <ArrowUpRight size={20} />
                      </div>
                      <div className="parameter-priority">{priorityLabel(index)}</div>
                    </div>
                    <p className="parameter-text">{adjustment}</p>
                    <div className="parameter-impact">
                      <span>Expected Impact:</span>
                      <div className="impact-bar">
                        <div className="impact-fill" style={{ width: `${impactValue(index)}%` }} />
                      </div>
                      <strong>{impactValue(index)}%</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === "audit" && (
            <div className="audit-view">
              <h3>
                <ClipboardList size={20} />
                Evidence Audit
              </h3>

              <div className="audit-grid">
                <div className="audit-card">
                  <h4>Source Status</h4>
                  <div className="status-counts">
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <div className="status-count" key={status}>
                        <span>{status}</span>
                        <strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="audit-card">
                  <h4>Decision Basis</h4>
                  <p>{statusOutcome[postStrikeData.status]}</p>
                  <p>{statusDetail[postStrikeData.status]}</p>
                </div>
              </div>

              <div className="source-report-list">
                {postStrikeData.sourceReports
                  .slice()
                  .sort((a, b) => reportStatusRank[b.status] - reportStatusRank[a.status])
                  .map((reportItem) => (
                    <article className="source-report-card" key={reportItem.id}>
                      <div>
                        <Database size={16} />
                        <strong>{reportItem.label}</strong>
                        <span>{reportItem.type}</span>
                      </div>
                      <p>{reportItem.summary}</p>
                      <div className="source-report-footer">
                        <span>{reportItem.status}</span>
                        <strong>{reportItem.confidence}%</strong>
                      </div>
                    </article>
                  ))}
              </div>

              <div className="audit-grid">
                <div className="audit-card">
                  <h4>Open Gaps</h4>
                  <ul>
                    {postStrikeData.gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </div>
                <div className="audit-card">
                  <h4>Next Review Actions</h4>
                  <ul>
                    {postStrikeData.nextReviewActions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pipeline-panel {
          background:
            linear-gradient(rgba(117, 240, 200, 0.025) 50%, transparent 50%),
            linear-gradient(180deg, rgba(16, 21, 18, 0.82), rgba(5, 7, 6, 0.72));
          background-size: 100% 4px, auto;
          border: 1px solid rgba(117, 240, 200, 0.16);
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          padding: 1.5rem;
          border-bottom: 1px solid rgba(117, 240, 200, 0.14);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .panel-kicker {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #75f0c8;
          font-weight: 600;
        }

        .panel-header h2 {
          margin: 0.25rem 0 0 0;
          font-size: 1.25rem;
          color: #f4f6ef;
        }

        .header-metrics {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.75rem;
        }

        .metric-badge,
        .download-report {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: rgba(5, 7, 6, 0.5);
          border: 1px solid rgba(117, 240, 200, 0.16);
          border-radius: 8px;
          color: #9bad9f;
          font-size: 0.8rem;
        }

        .download-report {
          color: #75f0c8;
          cursor: pointer;
          font-weight: 800;
        }

        .download-report:hover {
          background: rgba(117, 240, 200, 0.1);
        }

        .metric-badge strong {
          color: #75f0c8;
          font-size: 1.1rem;
        }

        .text-emerald {
          color: #75f0c8 !important;
        }

        .text-amber {
          color: #f6ad55 !important;
        }

        .dashboard-layout {
          display: grid;
          grid-template-columns: 250px 1fr;
          min-height: 500px;
        }

        .dashboard-nav {
          padding: 1.5rem 1rem;
          border-right: 1px solid rgba(117, 240, 200, 0.14);
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          background: rgba(5, 7, 6, 0.36);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: transparent;
          border: none;
          color: #9bad9f;
          font-size: 0.85rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .nav-item:hover {
          background: rgba(117, 240, 200, 0.08);
          color: #f4f6ef;
        }

        .nav-item.nav-active {
          background: rgba(117, 240, 200, 0.1);
          border: 1px solid rgba(117, 240, 200, 0.24);
          color: #75f0c8;
          font-weight: 600;
        }

        .dashboard-content {
          padding: 1.5rem;
        }

        .executive-summary {
          margin-bottom: 2rem;
        }

        .executive-summary h3,
        .effectiveness-view h3,
        .lessons-view h3,
        .parameters-view h3,
        .audit-view h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #f4f6ef;
          margin-bottom: 1rem;
        }

        .summary-text {
          color: #9bad9f;
          line-height: 1.6;
          font-size: 0.9rem;
        }

        .key-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .key-metric,
        .effectiveness-card,
        .lesson-card,
        .parameter-card,
        .audit-card,
        .source-report-card {
          background: rgba(5, 7, 6, 0.42);
          border: 1px solid rgba(117, 240, 200, 0.12);
          border-radius: 8px;
        }

        .key-metric {
          display: flex;
          gap: 1rem;
          padding: 1rem;
        }

        .metric-icon {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .metric-icon.success {
          background: rgba(117, 240, 200, 0.12);
          color: #75f0c8;
        }

        .metric-icon.warning {
          background: rgba(246, 173, 85, 0.15);
          color: #f6ad55;
        }

        .metric-icon.info {
          background: rgba(117, 240, 200, 0.1);
          color: #75f0c8;
        }

        .metric-content span,
        .comparison-item span,
        .parameter-impact span,
        .status-count span,
        .source-report-card span {
          font-size: 0.7rem;
          color: #6f8378;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-content strong,
        .comparison-item strong,
        .parameter-impact strong,
        .status-count strong {
          display: block;
          color: #f4f6ef;
          font-size: 1.1rem;
          margin: 0.2rem 0;
        }

        .metric-content p {
          color: #6f8378;
          font-size: 0.8rem;
          margin: 0;
        }

        .timeline-summary h4,
        .effectiveness-card h4,
        .audit-card h4 {
          color: #f4f6ef;
          margin-bottom: 1rem;
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 0.5rem;
        }

        .timeline-marker {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-top: 0.25rem;
          flex-shrink: 0;
        }

        .timeline-marker.complete {
          background: #75f0c8;
          box-shadow: 0 0 8px rgba(117, 240, 200, 0.38);
        }

        .timeline-item strong {
          color: #f4f6ef;
          font-size: 0.85rem;
        }

        .timeline-item p,
        .objective-item span,
        .factors-list li,
        .lesson-content p,
        .parameter-text,
        .audit-card p,
        .audit-card li,
        .source-report-card p {
          color: #9bad9f;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .effectiveness-grid,
        .parameters-list,
        .lessons-grid,
        .source-report-list {
          display: grid;
          gap: 1rem;
        }

        .effectiveness-card,
        .parameter-card,
        .source-report-card {
          padding: 1.25rem;
        }

        .objective-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .objective-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .objective-item.success svg {
          color: #75f0c8;
        }

        .objective-item.warning svg {
          color: #f6ad55;
        }

        .objective-item strong {
          display: block;
          color: #f4f6ef;
          font-size: 0.85rem;
        }

        .factors-list,
        .audit-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .factors-list li,
        .audit-card li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.35rem 0;
        }

        .factors-list svg {
          color: #75f0c8;
          flex-shrink: 0;
        }

        .audit-card li::before {
          content: "";
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          margin-top: 0.45rem;
          border-radius: 999px;
          background: #75f0c8;
        }

        .comparison-grid,
        .audit-grid,
        .status-counts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .audit-grid {
          grid-template-columns: repeat(2, 1fr);
          margin-bottom: 1rem;
        }

        .comparison-item,
        .status-count {
          text-align: center;
          padding: 0.75rem;
          background: rgba(5, 7, 6, 0.42);
          border-radius: 8px;
        }

        .lesson-card {
          display: flex;
          gap: 1rem;
          padding: 1rem;
        }

        .lesson-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #75f0c8;
          font-family: monospace;
          flex-shrink: 0;
        }

        .lesson-content p {
          margin: 0 0 0.5rem 0;
        }

        .lesson-tags {
          display: flex;
          gap: 0.35rem;
        }

        .tag {
          padding: 0.15rem 0.5rem;
          border-radius: 12px;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .tag.tactical {
          background: rgba(245, 101, 101, 0.15);
          color: #f56565;
          border: 1px solid rgba(245, 101, 101, 0.3);
        }

        .tag.environmental {
          background: rgba(117, 240, 200, 0.1);
          color: #75f0c8;
          border: 1px solid rgba(117, 240, 200, 0.24);
        }

        .tag.intelligence {
          background: rgba(246, 173, 85, 0.15);
          color: #f6ad55;
          border: 1px solid rgba(246, 173, 85, 0.3);
        }

        .tag.technical {
          background: rgba(117, 240, 200, 0.1);
          color: #75f0c8;
          border: 1px solid rgba(117, 240, 200, 0.24);
        }

        .parameter-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .parameter-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(117, 240, 200, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #75f0c8;
        }

        .parameter-priority {
          font-size: 0.7rem;
          color: #f6ad55;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .parameter-text {
          margin: 0 0 1rem 0;
        }

        .parameter-impact {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .impact-bar {
          flex: 1;
          height: 6px;
          background: rgba(117, 240, 200, 0.12);
          border-radius: 3px;
          overflow: hidden;
        }

        .impact-fill {
          height: 100%;
          background: linear-gradient(90deg, #75f0c8, #f2b84b);
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .audit-card {
          padding: 1rem;
        }

        .source-report-card > div:first-child,
        .source-report-footer {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .source-report-card > div:first-child {
          margin-bottom: 0.75rem;
        }

        .source-report-card > div:first-child svg {
          color: #75f0c8;
        }

        .source-report-card strong {
          color: #f4f6ef;
        }

        .source-report-card p {
          margin: 0 0 0.9rem;
        }

        .source-report-footer {
          justify-content: space-between;
          border-top: 1px solid rgba(117, 240, 200, 0.1);
          padding-top: 0.75rem;
        }

        .source-report-footer span {
          color: #75f0c8;
        }

        @media (max-width: 900px) {
          .panel-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-metrics {
            justify-content: flex-start;
          }

          .dashboard-layout,
          .key-metrics-grid,
          .comparison-grid,
          .audit-grid,
          .status-counts {
            grid-template-columns: 1fr;
          }

          .dashboard-nav {
            border-right: 0;
            border-bottom: 1px solid rgba(117, 240, 200, 0.14);
          }
        }
      `}</style>
    </div>
  );
}

function buildDashboardReport(recommendation: StrikeRecommendation, postStrikeData: PostStrikeData) {
  const statusCounts = countSourceStatuses(postStrikeData);
  const evidenceScore = {
    delta: postStrikeData.confidenceScore - recommendation.confidenceScore,
    blended: Math.round(recommendation.confidenceScore * 0.35 + postStrikeData.confidenceScore * 0.65)
  };

  const rating = effectivenessRating(postStrikeData.status, postStrikeData.confidenceScore);
  const statusLabel = statusLabels[postStrikeData.status];
  const sourceSummary = `${statusCounts.confirmed} confirmed, ${statusCounts.supporting} supporting, ${statusCounts.pending} pending`;
  const trajectoryCount = recommendation.trajectory?.length ?? 0;

  const conclusions: AnalysisConclusion = {
    id: `conclusion-${recommendation.id}-${postStrikeData.id}`,
    recommendationId: recommendation.id,
    postStrikeId: postStrikeData.id,
    summary: [
      `${recommendation.targetSummary} is currently assessed as ${statusLabel} with ${postStrikeData.confidenceScore}% evidence confidence.`,
      `The final confidence is ${evidenceScore.blended}% after weighting the ${recommendation.confidenceScore}% planning confidence against the post-event source package.`,
      `Source posture: ${sourceSummary}.`,
      postStrikeData.gaps.length ? `Main unresolved gap: ${postStrikeData.gaps[0]}` : "No unresolved evidence gaps were submitted."
    ].join(" "),
    effectiveness: {
      rating,
      factors: buildEffectivenessFactors(recommendation, postStrikeData, statusCounts)
    },
    lessonsLearned: buildLessons(recommendation, postStrikeData, trajectoryCount),
    parameterAdjustments: buildParameterAdjustments(recommendation, postStrikeData),
    confidenceScore: evidenceScore.blended,
    timestamp: new Date().toISOString()
  };

  const keyMetrics: KeyMetric[] = [
    {
      label: "Assessed Status",
      value: titleCase(statusLabel),
      detail: statusOutcome[postStrikeData.status],
      tone: postStrikeData.status === "destroyed" ? "success" : "warning",
      icon: "check"
    },
    {
      label: "Evidence Fusion",
      value: `${postStrikeData.confidenceScore}%`,
      detail: sourceSummary,
      tone: postStrikeData.confidenceScore >= 75 ? "success" : "warning",
      icon: "chart"
    },
    {
      label: "Planning Risk",
      value: titleCase(recommendation.riskLevel),
      detail: `${recommendation.standoffDistanceKm} km review buffer in the selected package`,
      tone: recommendation.riskLevel === "critical" || recommendation.riskLevel === "high" ? "warning" : "info",
      icon: "shield"
    },
    {
      label: "Collection Readiness",
      value: `${postStrikeData.nextReviewActions.length} actions`,
      detail: trajectoryCount ? `${trajectoryCount} trajectory checkpoints available for audit` : "Automated route package available",
      tone: "info",
      icon: "trend"
    }
  ];

  const objectives: Objective[] = [
    {
      label: "Effect Confirmation",
      value: titleCase(statusLabel),
      detail: statusDetail[postStrikeData.status],
      tone: postStrikeData.status === "active" || postStrikeData.status === "unknown" ? "warning" : "success"
    },
    {
      label: "Evidence Coverage",
      value: `${postStrikeData.sourceReports.length} sources reviewed`,
      detail: sourceSummary,
      tone: statusCounts.confirmed + statusCounts.supporting >= 2 ? "success" : "warning"
    },
    {
      label: "Gap Management",
      value: `${postStrikeData.gaps.length} open gaps`,
      detail: postStrikeData.gaps[0] ?? "No submitted gaps remain open.",
      tone: postStrikeData.gaps.length ? "warning" : "success"
    }
  ];

  const timeline = buildTimeline(recommendation, postStrikeData);
  const exportPayload = {
    generatedAt: conclusions.timestamp,
    recommendation,
    postStrikeData,
    conclusions,
    statusCounts,
    evidenceScore
  };

  return { conclusions, keyMetrics, objectives, timeline, statusCounts, evidenceScore, exportPayload };
}

function buildEffectivenessFactors(
  recommendation: StrikeRecommendation,
  postStrikeData: PostStrikeData,
  statusCounts: Record<SourceStatus, number>
) {
  const factors = [
    `${titleCase(statusLabels[postStrikeData.status])} status derived from ${postStrikeData.sourceReports.length} submitted source reports.`,
    `${postStrikeData.confidenceScore}% evidence confidence compared with ${recommendation.confidenceScore}% planning confidence.`,
    `${statusCounts.confirmed + statusCounts.supporting} sources currently support the assessment.`
  ];

  if (recommendation.trajectory?.length) {
    factors.push(`${recommendation.trajectory.length} checkpoint trajectory retained for timing and source-window audit.`);
  }

  if (postStrikeData.gaps.length) {
    factors.push(`Open evidence gap retained: ${postStrikeData.gaps[0]}`);
  }

  return factors;
}

function buildLessons(recommendation: StrikeRecommendation, postStrikeData: PostStrikeData, trajectoryCount: number) {
  const lessons = [
    `Evidence confidence moved ${postStrikeData.confidenceScore - recommendation.confidenceScore >= 0 ? "above" : "below"} the planning baseline, so future reports should compare plan assumptions with post-event source quality.`,
    `${postStrikeData.sourceReports.length} source channels were available; retain raw references and timestamps before drawing final conclusions.`,
    postStrikeData.gaps[0] ?? "No major evidence gaps were submitted, but source metadata should still be preserved for audit."
  ];

  if (trajectoryCount) {
    lessons.push(`Trajectory checkpoint data improved auditability by tying collection windows to ${trajectoryCount} planned movement points.`);
  } else {
    lessons.push(`Automated recommendations should add route checkpoints when later timing reconstruction is important.`);
  }

  return lessons;
}

function buildParameterAdjustments(recommendation: StrikeRecommendation, postStrikeData: PostStrikeData) {
  const actions = postStrikeData.nextReviewActions.length
    ? postStrikeData.nextReviewActions
    : ["Queue follow-up evidence review.", "Preserve raw source references.", "Re-score confidence after metadata review."];

  return [
    ...actions,
    `Revisit sensor plan: ${recommendation.selectedParameters.sensorPlan}.`,
    `Track deconfliction assumption: ${recommendation.selectedParameters.deconfliction}.`
  ].slice(0, 5);
}

function buildTimeline(recommendation: StrikeRecommendation, postStrikeData: PostStrikeData): TimelineItem[] {
  const trajectoryItems =
    recommendation.trajectory?.map((point) => ({
      time: `T+${point.etaOffsetMin}m`,
      label: point.label,
      detail: `${titleCase(point.action)} checkpoint at ${Math.round(point.altitudeM)} m / ${Math.round(point.speedKmh)} km/h`
    })) ?? [];

  const evidenceItems = postStrikeData.timeline.map((item) => ({
    time: item.time,
    label: item.label,
    detail: item.detail
  }));

  return [
    {
      time: "T-Plan",
      label: "Planning packet",
      detail: `${recommendation.source === "manual-agent" ? "Manual" : "Automated"} recommendation generated at ${recommendation.confidenceScore}% confidence`
    },
    ...trajectoryItems,
    ...evidenceItems
  ].slice(0, 8);
}

function countSourceStatuses(postStrikeData: PostStrikeData): Record<SourceStatus, number> {
  return postStrikeData.sourceReports.reduce<Record<SourceStatus, number>>(
    (counts, report) => {
      counts[report.status] += 1;
      return counts;
    },
    { confirmed: 0, supporting: 0, pending: 0, conflicting: 0 }
  );
}

function effectivenessRating(
  status: PostStrikeData["status"],
  confidence: number
): AnalysisConclusion["effectiveness"]["rating"] {
  if (status === "unknown") {
    return "unknown";
  }
  if (status === "active") {
    return "ineffective";
  }
  if (status === "partially-damaged") {
    return "partial";
  }
  return confidence >= 88 ? "highly-effective" : "effective";
}

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function priorityLabel(index: number) {
  return index === 0 ? "HIGH PRIORITY" : index === 1 ? "MEDIUM PRIORITY" : "LOW PRIORITY";
}

function impactValue(index: number) {
  return [86, 74, 64, 52, 44][index] ?? 40;
}

function lessonTagClass(index: number) {
  return ["intelligence", "technical", "environmental", "tactical"][index % 4];
}

function lessonTagLabel(index: number) {
  return ["INTELLIGENCE", "TECHNICAL", "EVIDENCE", "AUDIT"][index % 4];
}
