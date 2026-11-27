import { conSesion } from "@/server/http/compartido";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { urlSaludCerebro } from "@/server/agents/brains/config";
import { isAiConfiguredFor } from "@/lib/ai/provider";
import { isBotKeyConfigured } from "@/server/agents/bot/auth";
import {
  botLastSeenAt,
  computeBrainStatus,
  getBrainHealth,
} from "@/server/agents/bot/status";
import { estadoDelDespacho } from "@/server/agents/dispatch/estado";


/**
 * «Quién responde a tus clientes»: el cerebro conectado, el despacho (021), el
 * interruptor y los avisos `sin_cerebro` y `apagado` (036). Ver
 * `server/bot/status.ts`.
 */
export const GET = conSesion(async (session) => {
  const db = getDb();
  const [rows, health, aiConfigured, dispatch] = await Promise.all([
    db
      .select({ enabled: schema.agentProfile.enabled })
      .from(schema.agentProfile)
      .where(scoped(schema.agentProfile.organizationId, session.organizationId))
      .limit(1),
    getBrainHealth(urlSaludCerebro() ?? undefined),
    isAiConfiguredFor(session.organizationId),
    estadoDelDespacho(session.organizationId),
  ]);
  const status = computeBrainStatus({
    aiConfigured,
    agentEnabled: rows[0]?.enabled ?? false,
    botKeyConfigured: isBotKeyConfigured(),
    lastSeenAt: botLastSeenAt(),
    health,
    dispatch,
    now: new Date(),
  });
  return Response.json(status, { headers: { "cache-control": "no-store" } });
});
