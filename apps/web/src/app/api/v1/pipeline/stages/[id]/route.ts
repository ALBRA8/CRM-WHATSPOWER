import { withApiKey } from "@/server/api-v1/handler";
import * as h from "@/server/crm/http/pipeline-stage";

export const dynamic = "force-dynamic";

export const PATCH = withApiKey("configure", h.PATCH);
export const DELETE = withApiKey("configure", h.DELETE);
