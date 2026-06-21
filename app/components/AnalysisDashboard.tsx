// app/components/AnalysisDashboard.tsx

"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowUpRight,
  Gauge,
  Activity,
  Zap,
  FileText
} from "lucide-react";
import type { StrikeRecommendation, PostStrikeData, AnalysisConclusion } from "@/app/types/pipeline";

type AnalysisDashboardProps = {
  recommendation: StrikeRecommendation;
  postStrikeData: PostStrikeData;
};

export function AnalysisDashboard({ recommendation, postStrikeData }: AnalysisDashboardProps) {
  const [activeView, setActiveView] = useState<"summary" | "effectiveness" | "lessons" | "parameters">("summary");

  const conclusions: AnalysisConclusion = useMemo(() => ({
    id: `conclusion-${recommendation.id}-${postStrikeData.id}`,
    recommendationId: recommendation.id,
    postStrikeId: postStrikeData.id,
    summary: "Strike parameters demonstrated effective target engagement with minimal collateral effects. Northern approach corridor validated as optimal ingress route. Multi-source intelligence confirmed primary target destruction with 92% confidence. Environmental factors aligned favorably with pre-strike assessment.",
    effectiveness: {
      rating: "effective",
      factors: [
        "Target destroyed within expected timeframe",
        "Secondary effects limited to 300m radius as predicted",
        "Communications disruption within expected parameters",
        "Approach path avoided 4 of 5 known air defense systems"
      ]
    },
    lessonsLearned: [
      "Northern approach corridor performance exceeded expectations - recommend as primary route for similar targets",
      "Cloud cover assisted concealment but slightly degraded precision - adjust weather minimums by 5%",
      "Secondary explosion pattern suggests ammunition storage not identified in pre-strike intelligence",
      "Civilian camera infrastructure provided valuable real-time BDA - incorporate more sources in future"
    ],
    parameterAdjustments: [
      "Adjust weather minimum ceiling to 2000m for precision-guided systems",
      "Expand pre-strike intelligence to include potential ammunition/fuel storage",
      "Incorporate additional civilian camera feeds within 5km radius",
      "Optimize acoustic sensor network for faster secondary explosion detection"
    ],
    confidenceScore: 88,
    timestamp: new Date().toISOString()
  }), [recommendation.id, postStrikeData.id]); // 💡 Fixed: Added the missing dependency array here

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
                <div className="key-metric">
                  <div className="metric-icon success">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="metric-content">
                    <span>Mission Success</span>
                    <strong>Primary Target Destroyed</strong>
                    <p>Confirmed via 3 independent intelligence sources</p>
                  </div>
                </div>

                <div className="key-metric">
                  <div className="metric-icon warning">
                    <Shield size={24} />
                  </div>
                  <div className="metric-content">
                    <span>AD Systems Avoided</span>
                    <strong>4 of 5 Systems</strong>
                    <p>Northern corridor validated as optimal route</p>
                  </div>
                </div>

                <div className="key-metric">
                  <div className="metric-icon info">
                    <BarChart3 size={24} />
                  </div>
                  <div className="metric-content">
                    <span>Intel Accuracy</span>
                    <strong>88% Correlation</strong>
                    <p>Pre-strike assessment matched post-strike reality</p>
                  </div>
                </div>

                <div className="key-metric">
                  <div className="metric-icon success">
                    <TrendingUp size={24} />
                  </div>
                  <div className="metric-content">
                    <span>BDA Confidence</span>
                    <strong>92% Confidence</strong>
                    <p>Multi-source fusion achieved high reliability</p>
                  </div>
                </div>
              </div>

              <div className="timeline-summary">
                <h4>Engagement Timeline</h4>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-marker complete" />
                    <div>
                      <strong>T-60min</strong>
                      <p>Strike parameters confirmed</p>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-marker complete" />
                    <div>
                      <strong>T+0s</strong>
                      <p>Target engagement confirmed - seismic detection</p>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-marker complete" />
                    <div>
                      <strong>T+47s</strong>
                      <p>Secondary explosions detected - acoustic network</p>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-marker complete" />
                    <div>
                      <strong>T+15min</strong>
                      <p>Satellite tasking complete - BDA initiated</p>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-marker complete" />
                    <div>
                      <strong>T+1hr</strong>
                      <p>Multi-source fusion analysis complete</p>
                    </div>
                  </div>
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
                    <div className="objective-item success">
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>Target Neutralization</strong>
                        <span>Primary target destroyed - 92% confidence</span>
                      </div>
                    </div>
                    <div className="objective-item success">
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>Collateral Limitation</strong>
                        <span>Damage contained within 300m radius</span>
                      </div>
                    </div>
                    <div className="objective-item warning">
                      <AlertTriangle size={16} />
                      <div>
                        <strong>Intelligence Completeness</strong>
                        <span>Ammunition storage not identified pre-strike</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="effectiveness-card">
                  <h4>Effectiveness Factors</h4>
                  <ul className="factors-list">
                    {conclusions.effectiveness.factors.map((factor, i) => (
                      <li key={i}>
                        <ArrowUpRight size={14} />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="effectiveness-card">
                  <h4>Recommendation vs Reality</h4>
                  <div className="comparison-grid">
                    <div className="comparison-item">
                      <span>Predicted</span>
                      <strong>78% confidence</strong>
                    </div>
                    <div className="comparison-item">
                      <span>Actual</span>
                      <strong>92% confidence</strong>
                    </div>
                    <div className="comparison-item">
                      <span>Delta</span>
                      <strong className="text-emerald">+14%</strong>
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
                {conclusions.lessonsLearned.map((lesson, i) => (
                  <div key={i} className="lesson-card">
                    <div className="lesson-number">{String(i + 1).padStart(2, "0")}</div>
                    <div className="lesson-content">
                      <p>{lesson}</p>
                      <div className="lesson-tags">
                        {i === 0 && <span className="tag tactical">TACTICAL</span>}
                        {i === 1 && <span className="tag environmental">ENVIRONMENTAL</span>}
                        {i === 2 && <span className="tag intelligence">INTELLIGENCE</span>}
                        {i === 3 && <span className="tag technical">TECHNICAL</span>}
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
                {conclusions.parameterAdjustments.map((adjustment, i) => (
                  <div key={i} className="parameter-card">
                    <div className="parameter-header">
                      <div className="parameter-icon">
                        <ArrowUpRight size={20} />
                      </div>
                      <div className="parameter-priority">
                        {i === 0 ? "HIGH PRIORITY" : i === 1 ? "MEDIUM PRIORITY" : "LOW PRIORITY"}
                      </div>
                    </div>
                    <p className="parameter-text">{adjustment}</p>
                    <div className="parameter-impact">
                      <span>Expected Impact:</span>
                      <div className="impact-bar">
                        <div 
                          className="impact-fill" 
                          style={{ width: `${[85, 70, 60, 45][i]}%` }}
                        />
                      </div>
                      <strong>{[85, 70, 60, 45][i]}%</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pipeline-panel {
          background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-header {
          padding: 1.5rem;
          border-bottom: 1px solid rgba(74, 144, 226, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-kicker {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #4a90e2;
          font-weight: 600;
        }

        .panel-header h2 {
          margin: 0.25rem 0 0 0;
          font-size: 1.25rem;
          color: #e8edf5;
        }

        .header-metrics {
          display: flex;
          gap: 0.75rem;
        }

        .metric-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: rgba(20, 25, 50, 0.5);
          border: 1px solid rgba(74, 144, 226, 0.2);
          border-radius: 8px;
          color: #8b95b5;
          font-size: 0.8rem;
        }

        .metric-badge strong {
          color: #4a90e2;
          font-size: 1.1rem;
        }

        .text-emerald {
          color: #48bb78 !important;
        }

        .dashboard-layout {
          display: grid;
          grid-template-columns: 250px 1fr;
          min-height: 500px;
        }

        .dashboard-nav {
          padding: 1.5rem 1rem;
          border-right: 1px solid rgba(74, 144, 226, 0.15);
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          background: rgba(10, 14, 39, 0.3);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: transparent;
          border: none;
          color: #8b95b5;
          font-size: 0.85rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .nav-item:hover {
          background: rgba(74, 144, 226, 0.1);
          color: #e8edf5;
        }

        .nav-item.nav-active {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(53, 122, 189, 0.2));
          border: 1px solid rgba(74, 144, 226, 0.3);
          color: #4a90e2;
          font-weight: 600;
        }

        .dashboard-content {
          padding: 1.5rem;
        }

        .executive-summary {
          margin-bottom: 2rem;
        }

        .executive-summary h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #e8edf5;
          margin-bottom: 1rem;
        }

        .summary-text {
          color: #8b95b5;
          line-height: 1.6;
          font-size: 0.9rem;
        }

        .key-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .key-metric {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: rgba(20, 25, 50, 0.5);
          border: 1px solid rgba(74, 144, 226, 0.15);
          border-radius: 8px;
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
          background: rgba(72, 187, 120, 0.15);
          color: #48bb78;
        }

        .metric-icon.warning {
          background: rgba(246, 173, 85, 0.15);
          color: #f6ad55;
        }

        .metric-icon.info {
          background: rgba(74, 144, 226, 0.15);
          color: #4a90e2;
        }

        .metric-content span {
          font-size: 0.7rem;
          color: #6b7595;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-content strong {
          display: block;
          color: #e8edf5;
          font-size: 1.1rem;
          margin: 0.2rem 0;
        }

        .metric-content p {
          color: #6b7595;
          font-size: 0.8rem;
          margin: 0;
        }

        .timeline-summary h4 {
          color: #e8edf5;
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
          background: #48bb78;
          box-shadow: 0 0 8px rgba(72, 187, 120, 0.5);
        }

        .timeline-item strong {
          color: #e8edf5;
          font-size: 0.85rem;
        }

        .timeline-item p {
          color: #8b95b5;
          font-size: 0.8rem;
          margin: 0.15rem 0 0 0;
        }

        .effectiveness-view h3,
        .lessons-view h3,
        .parameters-view h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #e8edf5;
          margin-bottom: 1.25rem;
        }

        .effectiveness-grid {
          display: grid;
          gap: 1rem;
        }

        .effectiveness-card {
          padding: 1.25rem;
          background: rgba(20, 25, 50, 0.5);
          border: 1px solid rgba(74, 144, 226, 0.15);
          border-radius: 8px;
        }

        .effectiveness-card h4 {
          color: #e8edf5;
          margin-bottom: 1rem;
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
          color: #48bb78;
        }

        .objective-item.warning svg {
          color: #f6ad55;
        }

        .objective-item strong {
          display: block;
          color: #e8edf5;
          font-size: 0.85rem;
        }

        .objective-item span {
          color: #8b95b5;
          font-size: 0.8rem;
        }

        .factors-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .factors-list li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0;
          color: #8b95b5;
          font-size: 0.85rem;
        }

        .factors-list svg {
          color: #4a90e2;
        }

        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }

        .comparison-item {
          text-align: center;
          padding: 0.75rem;
          background: rgba(10, 14, 39, 0.4);
          border-radius: 8px;
        }

        .comparison-item span {
          display: block;
          font-size: 0.7rem;
          color: #6b7595;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .comparison-item strong {
          display: block;
          color: #e8edf5;
          font-size: 1.1rem;
          margin-top: 0.25rem;
        }

        .lessons-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .lesson-card {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: rgba(20, 25, 50, 0.5);
          border: 1px solid rgba(74, 144, 226, 0.15);
          border-radius: 8px;
        }

        .lesson-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #4a90e2;
          font-family: monospace;
          flex-shrink: 0;
        }

        .lesson-content p {
          color: #8b95b5;
          font-size: 0.85rem;
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
          background: rgba(72, 187, 120, 0.15);
          color: #48bb78;
          border: 1px solid rgba(72, 187, 120, 0.3);
        }

        .tag.intelligence {
          background: rgba(246, 173, 85, 0.15);
          color: #f6ad55;
          border: 1px solid rgba(246, 173, 85, 0.3);
        }

        .tag.technical {
          background: rgba(74, 144, 226, 0.15);
          color: #4a90e2;
          border: 1px solid rgba(74, 144, 226, 0.3);
        }

        .parameters-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .parameter-card {
          padding: 1.25rem;
          background: rgba(20, 25, 50, 0.5);
          border: 1px solid rgba(74, 144, 226, 0.15);
          border-radius: 8px;
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
          background: rgba(74, 144, 226, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4a90e2;
        }

        .parameter-priority {
          font-size: 0.7rem;
          color: #f6ad55;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .parameter-text {
          color: #8b95b5;
          font-size: 0.9rem;
          margin: 0 0 1rem 0;
        }

        .parameter-impact {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .parameter-impact span {
          color: #6b7595;
          font-size: 0.8rem;
        }

        .impact-bar {
          flex: 1;
          height: 6px;
          background: rgba(74, 144, 226, 0.15);
          border-radius: 3px;
          overflow: hidden;
        }

        .impact-fill {
          height: 100%;
          background: linear-gradient(90deg, #4a90e2, #48bb78);
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .parameter-impact strong {
          color: #e8edf5;
          font-size: 1.1rem;
        }
      `}</style>
    </div>
  );
}
