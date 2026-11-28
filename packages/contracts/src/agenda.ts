/**
 * Contrato de conectores de agenda (conservado de WHATSPOWER) + eventos de dominio.
 *
 * Fuente canónica: `CONTEXTO CRM/06_INTEGRATIONS/CONTRATOS_INTEGRACION.md` §10
 * y `docs/agenda-conectores.md` de WHATSPOWER.
 */

import { z } from "zod";

/** Las 4 operaciones públicas para añadir proveedores de agenda. */
export const AGENDA_CONNECTOR_OPS = [
  "createMeeting",
  "rescheduleMeeting",
  "cancelMeeting",
  "health",
] as const;
export type AgendaConnectorOp = (typeof AGENDA_CONNECTOR_OPS)[number];

export const MEETING_LINK = z.string().url();
export const SLOT = z.string().datetime({ offset: true });

export const BOOKING_REF = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  contactId: z.string().min(1),
  slot: SLOT,
  connector: z.string().min(1),
  status: z.enum(["confirmed", "linkPending", "cancelled"]),
});

export type BookingRef = z.infer<typeof BOOKING_REF>;

/**
 * Invariantes no negociables del contrato de agenda:
 * - solo se reserva un horario que se ofreció (`not_offered` 409),
 * - nunca se confirma una cita que el sistema no creó,
 * - si el conector falla, la cita se agenda igual con enlace pendiente de
 *   reintento (`linkPending`),
 * - anti doble-booking por índice parcial único en BD.
 */
export const AGENDA_INVARIANTS = {
  onlyOfferedSlots: true,
  neverConfirmExternalBookings: true,
  linkPendingOnConnectorFailure: true,
  uniqueSlotPerOrg: true,
} as const;

/* ---------- Eventos de dominio (envelopes para outbox / audit) ---------- */

export const DOMAIN_EVENTS = [
  "conversation.turn.received",
  "conversation.handoff.requested",
  "conversation.booking.created",
  "crm.stage.changed",
  "crm.contact.created",
  "crm.task.created",
  "flow.action.executed",
  "campaign.item.skipped",
  "campaign.finished",
  "agent.execution.finished",
  "agent.approval.requested",
  "agent.approval.decided",
] as const;
export type DomainEventName = (typeof DOMAIN_EVENTS)[number];

export const EVENT_ENVELOPE = z.object({
  eventId: z.string().min(1),
  organizationId: z.string().min(1),
  type: z.enum(DOMAIN_EVENTS),
  occurredAt: z.string().datetime({ offset: true }),
  actor: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope = z.infer<typeof EVENT_ENVELOPE>;
