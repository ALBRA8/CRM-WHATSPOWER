import { eq, sql } from "drizzle-orm";
import { getAuth, runInternalSignup, runWithoutOnboarding } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import {
  HORAS_REACTIVACION_NUEVAS,
  SEED_STAGES,
} from "@/server/identity/auth/on-signup";

/**
 * Acceso al demo sin registro.
 *
 * Mismo patrón que los módulos opcionales (ADR-001, `AGENDA`, `API_V1`): el
 * código viaja siempre en main y lo que decide si EXISTE es una variable de
 * despliegue (`DEMO_MODE`). Apagada, `/api/demo/sesion` responde 404 mudo y
 * el login no muestra el botón: la instancia queda igual que siempre.
 *
 * Encendida, el visitante entra con un clic a una organización demo ARLS-
 * aislada (su propia `organization`, su `member` y sus semillas), sin tocar
 * los datos del negocio real: la sesión del demo lleva
 * `activeOrganizationId` de la organización demo y todas las consultas van
 * acotadas por organización.
 *
 * Reglas de seguridad:
 * - La creación de la cuenta demo atraviesa `runInternalSignup` (bypass del
 *   gate de registro cerrado, FR-060) y `runWithoutOnboarding` (D-032): el
 *   hook de primera organización NO se dispara, así que en una instancia
 *   virgen el demo no le roba al propietario real su primer registro. La
 *   organización demo no cierra nada: `contarOrganizacionesReales` no la ve,
 *   y el propietario puede crear su cuenta cuando quiera.
 * - La contraseña del demo es fija y SOLO server-side (nunca viaja al bundle
 *   del cliente). La puerta real del demo es la bandera + el rate limit de
 *   `POST /api/demo/sesion`; quien conozca esta constante ya tiene acceso al
 *   código del propio servidor.
 */

const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);

export function parseDemoFlag(raw: string | undefined): boolean {
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function demoModeEnabled(): boolean {
  return parseDemoFlag(process.env.DEMO_MODE);
}

/** 404 sin cuerpo: con el demo apagado esa ruta no existe en esta instancia. */
export function demoDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}

export const DEMO_EMAIL = "demo@whatspower.test";
export const DEMO_NAME = "Demo";
export const DEMO_ORG_NAME = "Demo WhatsPower";
export const DEMO_ORG_SLUG = "demo";

/** Solo server-side: la usa `ensureDemoOrg` al crear la cuenta la primera vez. */
export const DEMO_PASSWORD = "demo-whatspower-sin-registro";

/** Error defensivo: la cuenta demo desapareció a media vía (no debería pasar). */
export class ErrorInstanciaSinInicializar extends Error {
  constructor() {
    super("instancia-sin-inicializar");
    this.name = "ErrorInstanciaSinInicializar";
  }
}

/**
 * Garantiza que existan la cuenta demo y su organización aislada. Idempotente:
 * con la cuenta ya creada no vuelve a registrarla, y con la membresía ya
 * puesta no vuelve a sembrar nada. El lock de arranque (874202, distinto del
 * 874201 del primer registro) evita que dos clics simultáneos dupliquen la org.
 */
export async function ensureDemoOrg(): Promise<void> {
  const db = getDb();
  const auth = getAuth();

  const demoUser = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, DEMO_EMAIL))
    .limit(1);

  if (!demoUser[0]) {
    // D-032: el demo entra también en una instancia virgen. El alta pasa con
    // el arranque de primera organización suprimido (el hook no crea la org
    // del propietario con el demo como dueño) y por el bypass interno del
    // gate de registro (mismo camino que las cuentas de equipo). La organización
    // demo la crea la transacción de abajo; contarOrganizacionesReales no la
    // ve, así que el propietario real conserva su primer registro intacto.
    try {
      await runWithoutOnboarding(() =>
        runInternalSignup(() =>
          auth.api.signUpEmail({
            body: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD },
          })
        )
      );
    } catch (err) {
      // Carrera benigna: otro clic creó la cuenta entre la lectura y el alta.
      if (!(err instanceof Error && /exist/i.test(err.message))) throw err;
    }
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(874202)`);
    const usuario = await tx
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, DEMO_EMAIL))
      .limit(1);
    const userId = usuario[0]?.id;
    if (!userId) throw new ErrorInstanciaSinInicializar();

    const member = await tx
      .select({ organizationId: schema.member.organizationId })
      .from(schema.member)
      .where(eq(schema.member.userId, userId))
      .limit(1);
    if (member[0]) return;

    const orgId = newId("organization");
    await tx.insert(schema.organization).values({
      id: orgId,
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
    });
    await tx.insert(schema.member).values({
      id: newId("member"),
      organizationId: orgId,
      userId,
      role: "owner",
    });
    await tx.insert(schema.pipelineStage).values(
      SEED_STAGES.map((s, i) => ({
        id: newId("stage"),
        organizationId: orgId,
        name: s.name,
        position: i,
        kind: s.kind,
      }))
    );
    await tx.insert(schema.agentProfile).values({
      id: newId("agentProfile"),
      organizationId: orgId,
      // Mismo punto de partida que un negocio nuevo (076).
      reactivateAfterHours: HORAS_REACTIVACION_NUEVAS,
    });
  });
}
