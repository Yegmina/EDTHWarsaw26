import { readAssessmentFrame } from "../../../../../lib/videoAssessment";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; frameId: string }> }) {
  const { id, frameId } = await context.params;
  const bytes = await readAssessmentFrame(id, frameId);

  return new Response(bytes, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/jpeg"
    }
  });
}
