import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/knowledge/http/kb-size";

export const dynamic = "force-dynamic";

export const GET = withApiKey("configure", h.GET);
