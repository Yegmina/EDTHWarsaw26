import { readAssessmentSourceVideo } from "../../../../lib/videoAssessment";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const bytes = await readAssessmentSourceVideo(id);

  return new Response(bytes, {
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": "video/mp4"
    }
  });
}
