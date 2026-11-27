import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/agents/http/agent-preset";

export const dynamic = "force-dynamic";

export const POST = withApiKey("configure", h.POST);
