import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/crm/http/contacts";

export const dynamic = "force-dynamic";

export const GET = withApiKey("read", h.GET);
export const POST = withApiKey("operate", h.POST);
