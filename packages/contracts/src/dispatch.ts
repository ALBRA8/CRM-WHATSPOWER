/**
 * Contrato de despacho estándar (evento de conversación, CRM → Agente).
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §4.
 * Conserva el despacho estándar de WHATSPOWER: outbox con coalescing por ráfaga,
 * firma, 3 reintentos y red de seguridad hacia humanos. Añade el contexto del
 * tenant (organización + agente lógico).
 */

import { z } from "zod";
import { AGENT_ID, ORGANIZATION_ID } from "./context.js";

export const DISPATCH_EVENTS = ["conversation.turn.received"] as const;
export type DispatchEventName = (typeof DISPATCH_EVENTS)[number];

export const CHANNELS = [
  "whatsapp",
  "instagram",
  "messenger",
  "telegram",
  "tiktok",
] as const;
export type Channel = (typeof CHANNELS)[number];

/** Evento enviado por el CRM al cerebro tras el coalescing de la ráfaga. */
export const CONVERSATION_TURN_RECEIVED = z.object({
  event: z.literal("conversation.turn.received"),
  /** Único por conversación (idempotencia de despacho). */
  event_id: z.string().min(1),
  conversation: z.object({
    id: z.string().min(1),
    channel: z.enum(CHANNELS),
    /** true = turno del Laboratorio: el agente responde, el CRM jamás envía al canal. */
    test: z.boolean(),
  }),
  contact: z.object({
    id: z.string().min(1),
    identity: z.string().min(1),
    name: z.string().optional(),
    stage: z.string().optional(),
    aiPaused: z.boolean().optional(),
  }),
  organization: z.object({
    id: ORGANIZATION_ID,
    agentId: AGENT_ID,
    timezone: z.string().min(1),
    locale: z.string().min(1),
  }),
  messageIds: z.array(z.string().min(1)).min(1),
  turn: z.object({
    text: z.string().default(""),
    media: z.array(z.string()).default([]),
    sinceLastReplyMs: z.number().int().nonnegative(),
  }),
  capabilities: z.object({
    booking: z.boolean(),
    /** Etapas a las que el agente puede avanzar el lead (solo adelante y abiertas). */
    stageMoves: z.array(z.string()),
    /** Fin de la ventana de 24 h del canal. */
    windowOpenUntil: z.string().datetime({ offset: true }),
  }),
  /** Firma HMAC a nivel de transporte (cabecera X-Signature). */
  signature: z.string().optional(),
});

export type ConversationTurnReceived = z.infer<typeof CONVERSATION_TURN_RECEIVED>;

/** Respuesta HTTP del despacho: solo acusa recepción (el agente responde por la bot API). */
export const DISPATCH_ACK = z.object({
  accepted: z.literal(true),
  event_id: z.string().min(1),
  /** El agente puede indicar una retención HITL; el envío de respuesta sigue siendo por /api/bot/messages. */
  approvalRequired: z.boolean().default(false),
});

export type DispatchAck = z.infer<typeof DISPATCH_ACK>;

/** Reglas no negociables del contrato (documentación ejecutable). */
export const DISPATCH_RULES = {
  /** Espera del fin de ráfaga antes de despachar. */
  coalesceBeforeDispatch: true,
  /** El agente responde por POST /api/bot/messages, no por la respuesta HTTP. */
  respondViaBotApi: true,
  /** Reintentos del despacho antes de la red de seguridad humana. */
  maxRetries: 3,
  /** Tras agotar reintentos, la conversación queda para una persona. */
  humanFallbackAfterRetries: true,
  /** El turno de Laboratorio nunca se envía al canal real. */
  sandboxNeverDelivered: true,
} as const;
