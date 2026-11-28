import { count, ne } from "drizzle-orm";
import { getDb, schema } from "./index";

/**
 * Qué organizaciones cuentan para el arranque de la instancia (D-032).
 *
 * La organización demo (`slug: demo`, D-031) es un accesorio de prueba, no el
 * negocio real: si contara, un visitante que entra al demo en una instalación
 * nueva cerraría el registro público (FR-060) y la consulta de «la
 * organización de la instancia» (bot, OAuth, marca del login) devolvería la
 * organización demo en vez de la del propietario. Por eso el demo queda
 * excluido de TODAS las decisiones de arranque.
 *
 * Vive en `lib/db` (y no en `server/identity/auth`) porque la consumen tres
 * dominios (identity, agents, platform) y el vigía de fronteras congela el
 * grafo de `src/server`: por lib/ comparten la regla sin abrir aristas nuevas.
 *
 * «demo» es un slug reservado: ningún flujo del producto crea una
 * organización real con ese slug (la primera organización del propietario es
 * `principal`, y las demás vienen de flujos internos).
 */

/** Slug reservado de la organización demo (D-031). */
export const SLUG_ORG_DEMO = "demo";

type DbCompleta = ReturnType<typeof getDb>;

/**
 * Ejecutor de la consulta: la BD completa o una transacción en curso (el
 * arranque de la primera organización cuenta dentro del tx del advisory lock).
 * Estructurado a propósito: lo que la función usa es `select`.
 */
export type EjecutorConsulta = {
  select: DbCompleta["select"];
};

/**
 * Número de organizaciones REALES de la instancia: las que deciden el
 * arranque (primera organización del propietario, cierre de registro FR-060,
 * organización de la instancia). La organización demo no cuenta.
 */
export async function contarOrganizacionesReales(
  db: EjecutorConsulta
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.organization)
    .where(ne(schema.organization.slug, SLUG_ORG_DEMO));
  return row?.n ?? 0;
}
