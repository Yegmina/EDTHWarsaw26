# AeroRozum / Warsaw26

Current-state intake and geospatial review interface for battle-damage assessment workflows.

The application turns unstructured source notes into a structured analyst brief, keeps concrete source-stated details visible, separates source confidence from verification gaps, and projects review context onto a satellite map.

## Capabilities

- Stage 0 current-state intake with source title, source URL, evidence image URL, and raw text fields.
- Server-side LLM analysis through the `/api/analyze` route.
- Concrete extraction of source-stated claims, observations, evidence gaps, verification questions, and reference links.
- Satellite map centered on Russia with review overlays.
- Preloaded tactical reference locations and air-defense range templates.
- Weapon/projectile range placement on map click.
- Public camera layer loaded through `/api/cameras`, including estimated camera sectors and stream preview links.
- Distributed audio sensor layer with coverage visualization.
- Fullscreen map mode and layer/tool controls.
- Stage 2 video damage assessment with whole-video frame extraction at the selected FPS, frame-to-frame delta proposals, visual change boxes, smoke/fire/dust indicators, annotated MP4 output, frame timeline, and GPT-5.5 vision review.
- Supplied MP4 workflow plus uploaded video processing through server-side API routes.
- Stage 2 controls for frame-processing concurrency and video mode: auto, visual/RGB, thermal/IR, or mixed RGB + thermal.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Leaflet / React Leaflet
- Lucide React icons
- FFmpeg / ffprobe for video frame extraction and metadata
- Sharp for frame pixel analysis
- OpenAI Responses API for server-side analysis

## Requirements

- Node.js 20 or newer recommended
- npm
- FFmpeg available on `PATH`
- `OPENAI_API_KEY` available in the server environment

Create a local environment file when running outside a preconfigured shell:

```powershell
Set-Content -Path .env.local -Value "OPENAI_API_KEY=your_key_here"
```

Do not commit `.env.local` or any real credentials.

## Run Locally

Install dependencies:

```powershell
npm install
```

Start frontend and backend routes together:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000
```

## Validation

Type-check the project:

```powershell
npx.cmd tsc --noEmit
```

Production build:

```powershell
npm run build
```

Basic local health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000 -TimeoutSec 10
```

## API Routes

`POST /api/analyze`

Accepts current-state text and optional source metadata. Returns an analyst brief, observations, confidence, source gaps, verification questions, map layers, and evidence cards.

`GET /api/cameras?cameraId=7`

Loads public camera markers from the configured provider and returns normalized camera metadata with estimated sector polygons.

`POST /api/video-assessments`

Accepts multipart video uploads or `supplied=true`. Extracts frames across the full video at the selected FPS, runs local frame-delta analysis first, classifies rapid-change regions as flash/heat, smoke, dust, or motion-delta proposals, optionally runs GPT-5.5 frame review on the highest-delta evidence, generates an annotated MP4, and returns severity, smoke/fire/dust evidence, boxes, events, frame URLs, and video output URLs.

Settings include `fps`, `eventSensitivity`, `openAiFrameLimit`, `processingConcurrency`, and `videoMode`. `processingConcurrency` controls parallel server-side frame decoding and has no fixed upper cap in the API; `videoMode` is passed into the vision-review prompt so thermal, visual, and mixed footage are interpreted differently.

`GET /api/video-assessments/:id`

Returns a stored assessment result.

`GET /api/video-assessments/:id/frames/:frameId`

Returns an extracted evidence frame JPEG.

`GET /api/video-assessments/:id/source`

Streams an uploaded source video back to the browser for review.

`GET /api/video-assessments/:id/annotated`

Streams the generated annotated MP4 with assessment boxes burned into the video.

## Project Structure

```text
app/
  api/
    analyze/route.ts    LLM-backed current-state analysis
    cameras/route.ts    Public camera normalization and sectors
    video-assessments/  Video assessment API routes
  components/
    MapPanel.tsx        Satellite map, tools, layers, ranges
    VideoAssessmentPanel.tsx
  globals.css           Application styling
  layout.tsx            Next metadata and root layout
  page.tsx              Stage 0 intake and dashboard
public/
  demo/
    video_2026-06-20_20-14-28.mp4  Supplied video for assessment testing
```

## Notes

- The map uses satellite tiles and browser-rendered Leaflet overlays.
- The LLM route requires `OPENAI_API_KEY` at runtime.
- Source confidence reflects the submitted source/provenance structure; it is separate from whether a claim has been independently verified.
- Video assessment outputs are generated under `data/video-assessments/` and ignored by git.
