/**
 * API bot v1 (Agente → CRM) — contrato conservado de VESTRO.
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §5.
 * Las 13 rutas de VESTRO se conservan con sus códigos de error. Autenticación:
 * `X-API-Key: BOT_API_KEY` (se acepta `Authorization: Bearer`).
 */

import { z } from "zod";

export type BotRouteMethod = "GET" | "POST" | "PUT" | "PATCH";

export interface BotRoute {
  readonly method: BotRouteMethod;
  readonly path: string;
  readonly purpose: string;
}

/**
 * Las 13 rutas del contrato bot v1 heredado de VESTRO.
 * La prueba de vigía (`tests/bot-api.test.ts`) congela esta tabla: añadir rutas
 * nuevas es compatible; renombrar o retirar una existente rompe el contrato.
 */
export const BOT_API_V1_ROUTES: readonly BotRoute[] = [
  { method: "GET", path: "/api/bot/profile", purpose: "Perfil del agente y KB que editó el negocio" },
  { method: "GET", path: "/api/bot/context", purpose: "Persona, etapa, humano activo, ventana, citas, tareas y seguimientos" },
  { method: "POST", path: "/api/bot/messages", purpose: "Responder (queda marcado como IA)" },
  { method: "POST", path: "/api/bot/llm/{ruta}", purpose: "Compat: proxy LLM conservado" },
  { method: "PUT", path: "/api/bot/ficha", purpose: "Guardar lo que el bot descubre del lead" },
  { method: "POST", path: "/api/bot/stage", purpose: "Avanzar el lead (solo adelante, etapas abiertas)" },
  { method: "POST", path: "/api/bot/handoff", purpose: "Devolver la conversación a un humano" },
  { method: "POST", path: "/api/bot/typing", purpose: "Marcar leído + escribiendo…" },
  { method: "GET", path: "/api/bot/media/{id}", purpose: "Descargar adjunto entrante sin tocar el proveedor" },
  { method: "POST", path: "/api/bot/reset", purpose: "Reiniciar conversación de pruebas" },
  { method: "GET", path: "/api/bot/availability", purpose: "Horarios para ofrecer (quedan registrados como ofrecidos)" },
  { method: "POST", path: "/api/bot/bookings", purpose: "Reservar un horario ofrecido (PATCH mueve)" },
  { method: "GET", path: "/api/bot/openapi.json", purpose: "Contrato OpenAPI 3.1 servido por la instancia" },
] as const;

export const CONVERSATION_ID = z.string().regex(
  /^[A-Za-z0-9_-]+$/,
  "conversationId inválido",
);

/* ---------- Esquemas de entrada/salida por ruta ---------- */

export const BOT_PROFILE_RESPONSE = z.object({
  agent: z.object({
    name: z.string(),
    tone: z.string(),
    instructions: z.string(),
    escalation: z.string(),
  }),
  kb: z.object({
    qa: z.array(z.object({ question: z.string(), answer: z.string() })),
    blocks: z.array(z.string()),
  }),
});

export const BOT_CONTEXT_RESPONSE = z.object({
  contact: z.object({
    id: z.string(),
    identity: z.string(),
    name: z.string().optional(),
    stage: z.string().optional(),
    aiPaused: z.boolean().optional(),
  }),
  humanActive: z.boolean(),
  windowOpen: z.boolean(),
  appointments: z.array(z.object({ id: z.string(), startsAt: z.string().datetime({ offset: true }) })).default([]),
  /** Extensión de la plataforma: tareas y seguimientos visibles para el agente. */
  tasks: z
    .array(z.object({ id: z.string(), title: z.string(), dueAt: z.string().datetime({ offset: true }).nullable() }))
    .default([]),
});

export const BOT_MESSAGE_REQUEST = z.object({
  conversationId: CONVERSATION_ID,
  text: z.string().min(1).max(4096),
});

export const BOT_MESSAGE_RESPONSE = z.object({
  id: z.string().min(1),
  /** Idempotencia por mensaje del proveedor cuando existe. */
  waMessageId: z.string().optional(),
});

export const BOT_FICHA_REQUEST = z.object({
  conversationId: CONVERSATION_ID,
  /** Merge por claves: lo descubierto del lead (ficha comercial). */
  ficha: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const BOT_STAGE_REQUEST = z.object({
  leadId: z.string().min(1),
  stageId: z.string().min(1),
});
/** 409 si el movimiento no está permitido (solo adelante y etapas abiertas). */

export const BOT_HANDOFF_REQUEST = z.object({
  conversationId: CONVERSATION_ID,
  reason: z.string().min(1),
});

export const BOT_TYPING_REQUEST = z.object({
  conversationId: CONVERSATION_ID,
});

export const BOT_RESET_REQUEST = z.object({
  conversationId: CONVERSATION_ID,
});

export const BOT_AVAILABILITY_QUERY = z.object({
  date: z.string().date(),
});

export const BOT_AVAILABILITY_RESPONSE = z.object({
  slots: z.array(z.string()).default([]),
});

const OFFSET_DATETIME = z.string().datetime({ offset: true });

export const BOT_BOOKING_REQUEST = z.object({
  conversationId: CONVERSATION_ID,
  /** Solo un horario que se ofreció (invariante: `not_offered` 409 en caso contrario). */
  slot: OFFSET_DATETIME,
  connector: z.string().optional(),
});

export const BOT_BOOKING_RESPONSE = z.object({
  id: z.string().min(1),
  status: z.enum(["confirmed", "linkPending"]),
  meetingLink: z.string().optional(),
});

/* ---------- Rutas bot nuevas autorizadas en la plataforma ---------- */

export const PLATFORM_BOT_ROUTES: readonly BotRoute[] = [
  { method: "POST", path: "/v1/tasks", purpose: "Crear tarea/seguimiento con Idempotency-Key" },
  { method: "GET", path: "/v1/knowledge", purpose: "KB por organización (desacoplada del agente)" },
  { method: "POST", path: "/v1/automations/run", purpose: "Ejecutar automatización declarada por el tenant" },
  { method: "GET", path: "/v1/execution-results/{id}", purpose: "Resultado de una ejecución con traza (CRM → Agente)" },
] as const;
