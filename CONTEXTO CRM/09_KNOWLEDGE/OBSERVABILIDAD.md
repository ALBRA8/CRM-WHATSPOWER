# OBSERVABILIDAD — superficie de salud y señales (F5)

## Endpoints de salud (los dos que un probe externo debe vigilar)

| Endpoint | Qué dice | Cuándo alarma |
|---|---|---|
| `GET /api/health` (CRM) | `ok:true` SOLO si la BD responde (el healthcheck que reinicia contenedores mira ESTO); además `version`, `commit`+`commitVerified`, `features` (banderas de despliegue), `mediaWritable`, `webhooks.{pendientes,agotados}`, **F5:** `dbRole` (`runtime`\|`owner`) y `sse` (`mode`, `connected`, `notified`, `received`, `droppedOversize`, `lastError`) | 503 `db_unavailable` → accionar de inmediato; `commitVerified:false` → el build no congeló el commit; `mediaWritable:false` → volumen mal montado; `webhooks.agotados>0` → revisar reintento de webhook (no reinicia el contenedor a propósito) |
| `GET /api/v1/health` (AGENTE-GENERAL) | componentes del runtime: `memory_store`, `memory_manager` — F5/T9 exige `configured` en producción | componente no `configured` → el puente CRM no despacha (fail-closed 503) o memoria no persistente |

## Señales recomendadas por plataforma

1. **Probe liveness**: `/api/health` cada 30 s; alertar `ok:false` sostenido
   > 2 min (evitar páginas por reinicios breves).
2. **Probe de puente** (una vez/min): `GET` al `/api/v1/health` del cerebro
   desde el host del CRM — si falla, el despacho al cerebro está caído aunque
   el CRM siga atendiendo WhatsApp.
3. **SSE con backplane**: con `SSE_BACKPLANE=postgres`, vigilar
   `sse.connected=false` o `sse.lastError` no nulo en `/api/health` — indica
   que la instancia perdió el LISTEN (los clientes hacen catch-up, pero conviene
   reconnectar/reiniciar).
4. **Webhooks**: `webhooks.agotados` creciente = eventos de canal que nunca
   entraron; revisar credenciales del canal.
5. **Bitácora del cerebro**: structlog en JSON; alertar `ERROR` repetido en
   `/crm/dispatch` (403/429 sostenidos = reglas de firewall o rate limit mal
   dimensionadas).
6. **BD**: conexiones de `vestro_runtime` (si se activa) por `pg_stat_activity`
   — crecimiento sin techo = fuga de pool; y `% USAGE` del disco de
   `pg_wal` tras un crash (la recuperación lo recorta sola).

## Convención de logs

- CRM: sin cuerpos ni firmas en logs (infra/SECRETOS.md §2); los IDs
  (`requestId`, `organizationId`, `conversationId`) viajan en cada línea para
  trazar un turno end-to-end: webhook → outbox → `/crm/dispatch` → ACK → bot API.
- Cerebro: structlog con `org_id` en el contexto de cada despacho — un turno
  se sigue cruzando la misma `event_id` en ambas bitácoras.
- Nada de PII de clientes en las bitácoras: texto de mensajes solo con
  máscara o en entornos de prueba.

## Qué NO expone la salud

`/api/health` no requiere sesión y no devuelve datos de clientes: contadores
agregados y estado. Los endpoints de diagnóstico dev (`/api/dev/*`) siguen
protegidos por sesión y solo activos fuera de producción (E2E).
