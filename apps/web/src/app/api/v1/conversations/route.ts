import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/conversations/http/conversations";

export const dynamic = "force-dynamic";

export const GET = withApiKey("read", h.GET);
