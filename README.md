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

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Leaflet / React Leaflet
- Lucide React icons
- OpenAI Responses API for server-side analysis

## Requirements

- Node.js 20 or newer recommended
- npm
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

## Project Structure

```text
app/
  api/
    analyze/route.ts    LLM-backed current-state analysis
    cameras/route.ts    Public camera normalization and sectors
  components/
    MapPanel.tsx        Satellite map, tools, layers, ranges
  globals.css           Application styling
  layout.tsx            Next metadata and root layout
  page.tsx              Stage 0 intake and dashboard
```

## Notes

- The map uses satellite tiles and browser-rendered Leaflet overlays.
- The LLM route requires `OPENAI_API_KEY` at runtime.
- Source confidence reflects the submitted source/provenance structure; it is separate from whether a claim has been independently verified.
