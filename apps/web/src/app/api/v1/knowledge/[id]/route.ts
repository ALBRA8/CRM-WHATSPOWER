import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/knowledge/http/kb-entry";

export const dynamic = "force-dynamic";

export const PATCH = withApiKey("configure", h.PATCH);
export const DELETE = withApiKey("configure", h.DELETE);
