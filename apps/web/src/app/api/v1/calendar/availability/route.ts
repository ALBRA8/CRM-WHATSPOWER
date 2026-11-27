import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/scheduling/http/calendar-availability";

export const dynamic = "force-dynamic";

export const GET = withApiKey("configure", h.GET);
