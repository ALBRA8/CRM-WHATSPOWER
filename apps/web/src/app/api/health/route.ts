import { checkHealth } from "@/server/platform/health";

export const dynamic = "force-dynamic";

// Solo el handler: qué se responde y por qué vive en `src/server/health.ts`.
export async function GET() {
  const { status, body } = await checkHealth();
  return Response.json(body, { status });
}
