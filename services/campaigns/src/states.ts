/**
 * Máquina de estados de campaña con transiciones atómicas (contrato §9).
 * El motor completo (locks JIT, supresión, pacing, anti-replay durable,
 * reconstrucción clean-room de ULTRA) se implementa en la Fase 9.
 */

import {
  CAMPAIGN_STATES,
  canTransitionCampaign,
  type CampaignState,
} from "@whatspower/contracts";

export class IllegalCampaignTransitionError extends Error {
  readonly from: CampaignState;
  readonly to: CampaignState;
  readonly code = "validation_failed" as const;

  constructor(from: CampaignState, to: CampaignState) {
    super(`Transición de campaña ilegal: ${from} → ${to}`);
    this.name = "IllegalCampaignTransitionError";
    this.from = from;
    this.to = to;
  }
}

/** Verifica y devuelve el destino si la transición es legal; lanza si no. */
export function assertCampaignTransition(
  from: CampaignState,
  to: CampaignState,
): CampaignState {
  if (!canTransitionCampaign(from, to)) {
    throw new IllegalCampaignTransitionError(from, to);
  }
  return to;
}

/** Estados terminales: sin transiciones de salida. */
export function isTerminalState(state: CampaignState): boolean {
  return state === "cancelled" || state === "completed" || state === "failed";
}

export const ALL_CAMPAIGN_STATES = CAMPAIGN_STATES;
