import { withApiKey } from "@/server/integrations/api-v1/handler";
import * as h from "@/server/crm/http/pipeline-stages";

export const dynamic = "force-dynamic";
// Crear, renombrar, ordenar y borrar etapas es configurar el embudo, no operarlo.

export const GET = withApiKey("read", h.GET);
export const POST = withApiKey("configure", h.POST);
