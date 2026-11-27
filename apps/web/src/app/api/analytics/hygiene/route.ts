import { withAuth } from "@/lib/api";
import { getBranding } from "@/server/platform/branding";
import { hygieneBlock } from "@/server/platform/analytics/hygiene";

export const dynamic = "force-dynamic";

/** 019 — Higiene. Sin rango: describe el AHORA, no un periodo. */
export const GET = withAuth(async (session) => {
  const branding = await getBranding(session.organizationId);
  return Response.json(await hygieneBlock(session.organizationId, branding.currency));
});
