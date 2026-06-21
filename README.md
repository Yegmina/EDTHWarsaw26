# AeroRozum Warsaw26 Intelligence Analysis Pipeline

AeroRozum Warsaw26 is a Next.js platform for a staged intelligence-analysis and battle-damage-assessment workflow. It combines current-state text intake, satellite map context, manual or automated planning, multi-source evidence fusion, video delta assessment, and final audit reporting in one browser interface. The interface also autosaves the working session locally and supports JSON export/import for handoff and recovery.

## Pipeline

- **Stage 0: Current-State Intake**  
  Submit a source title, URL, optional image URL, and raw current-state text. The server-side LLM endpoint extracts a concrete analyst brief, observations, source gaps, verification questions, confidence, and map review layers.

- **Stage 1: Planning**  
  Generate an automated planning recommendation from Stage 0 or enter a detailed manual package. Manual mode supports checkpoint trajectory arrays, route geometry, readiness scoring, timeline review, JSON package export, timing, heading, sensor mode, handoffs, decision gates, contingency branches, setup checklist items, and post-event collection windows.

- **Stage 2: Evidence Fusion**  
  Review and edit a structured evidence matrix across video, public camera, audio, satellite, operator, and other sources. A playable video assessment panel can upload local RGB, thermal, or mixed footage, run frame-delta detection across the clip, draw live boxes over detected event windows, and push the result into the video evidence source.

- **Stage 3: Analysis Dashboard**  
  Fuse planning and evidence data into an executive summary, effectiveness view, lessons learned, recommended parameter adjustments, evidence audit, source status counts, open gaps, exportable JSON, and a copy/download Markdown handoff report.

## Map Surface

The Stage 0 map uses a satellite basemap with DeepState-style controls:

- preloaded reference layers and tactical location templates
- Russian air-defense weapon templates and range rings
- map-click range placement
- fullscreen map mode
- public camera markers with sector visualization and stream links
- distributed audio sensor markers and coverage rings
- custom range overlays from the current analysis anchor

## Video Assessment

The Stage 2 video panel runs in the browser:

- local file upload only; the video is not uploaded to the server
- RGB, thermal, and mixed source modes
- configurable frame sampling rate, sensitivity, and concurrency pacing
- full-clip frame-delta analysis
- live canvas boxes over the video during playback
- event jump list with timestamps, class labels, and scores
- optional server-side Vision LLM interpretation of detector metadata and keyframe thumbnails
- automatic evidence-matrix update with confidence and summary

## Session Handling

The command bar includes session controls:

- autosave to browser local storage
- manual save
- JSON export for pipeline handoff
- JSON import for restoring a previous run
- reset to clear local working state

The exported session captures Stage 0 intake, map range overlays, active stage, planning recommendation, manual-plan analysis, post-strike evidence, and final analysis inputs.

The pipeline overview strip summarizes current readiness across intake, planning, evidence fusion, and final assessment, and each tile can be clicked to jump to that stage.

Use the Capture button in the top bar to hide session controls and switch the interface into a clean presentation layout for screenshots.

## Requirements

- Node.js 20+
- npm
- Optional: `OPENAI_API_KEY` for LLM-backed Stage 0 intake and enhanced manual-plan analysis

## Setup

```powershell
npm install
Copy-Item .env.example .env.local
# Edit .env.local and set OPENAI_API_KEY if LLM endpoints should run.
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

## Validation

```powershell
npx.cmd tsc --noEmit
npm run build
```

The current implementation has been browser-validated through:

1. Stage 1 automated recommendation.
2. Stage 2 video upload and frame-delta analysis.
3. Evidence fusion with the video-derived source update.
4. Stage 3 conclusion dashboard and evidence audit.

## Environment

Create `.env.local` from `.env.example`.

```text
OPENAI_API_KEY=your_key_here
```

Stage 0 requires the key because it calls the server-side analysis endpoint. Manual planning will use the key when present and falls back to a local deterministic analysis when it is absent.

## Repository Notes

- `.next/`, logs, Playwright artifacts, and generated validation output are ignored.
- `data/` is intentionally left untracked in this workspace.
- Main app entry: `app/page.tsx`
- Shared pipeline types: `app/types/pipeline.ts`
- Map surface: `app/components/MapPanel.tsx`
- Manual planning: `app/components/ManualPlanInput.tsx`
- Evidence fusion: `app/components/PostStrikeAnalysis.tsx`
- Video assessment: `app/components/VideoDamageAssessment.tsx`
- Video interpretation API: `app/api/video-assessment/route.ts`
- Final dashboard: `app/components/AnalysisDashboard.tsx`
