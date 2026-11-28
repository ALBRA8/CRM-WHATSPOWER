import { eq } from "drizzle-orm";
import { getAuth, runInternalSignup } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { contarOrganizacionesReales } from "@/lib/db/instancia";

/**
 * Acceso de PRUEBA sin registro (D-033, sustituye el acceso a organización
 * demo de D-031/D-032).
 *
 * Mismo patrón que los módulos opcionales (ADR-001, `AGENDA`, `API_V1`): el
 * código viaja siempre en main y lo que decide si EXISTE es una variable de
 * despliegue. Encendida, el login muestra «Entrar sin registro»: un clic
 * crea la cuenta propietaria de la instancia POR EL MISMO CAMINO que un
 * registro real (`signUpEmail` + hook `onUserCreated`), de modo que el
 * proceso es el normal de principio a fin — la organización de la instancia
 * (`slug: principal`), las semillas del negocio nuevo y la guía de inicio.
 * No hay organización demo ni datos de ejemplo: lo que se configure durante
 * la prueba queda en la organización real de la instancia.
 *
 * NO es un acceso anónimo permanente ni una segunda organización: es la
 * puerta de pruebas de una instalación nueva. Reglas:
 *
 * - Solo inicializa una instancia VIRGEN (`contarOrganizacionesReales === 0`).
 *   Si la instancia ya tiene su organización real y no existe la cuenta de
 *   prueba, la ruta responde 409 (`ErrorInstanciaYaInicializada`): nadie
 *   entra a la organización de otro con este botón.
 * - Si la cuenta de prueba ya existe, el botón es REENTRADA: inicia sesión
 *   con ella y no crea nada (idempotente, seguro en instancia inicializada).
 * - La contraseña es fija y SOLO server-side (nunca viaja al bundle). La
 *   puerta real es la bandera + el rate limit de la ruta.
 *
 * La cuenta de prueba no tiene correo real ni verificación: cuando se quite
 * la bandera, la instancia queda inicializada tal cual; para dejarla con una
 * cuenta propia se reinicia la BD y se registra el propietario, o se actualiza
 * el correo/contraseña de la cuenta de prueba directamente en la BD.
 */

/** Encendido por `PRUEBA_MODE`; `DEMO_MODE` sigue aceptándose (D-031/D-032). */
export function parsePruebaFlag(raw: string | undefined): boolean {
  const ON_VALUES = new Set(["on", "1", "true", "si", "sí", "yes"]);
  return ON_VALUES.has((raw ?? "").trim().toLowerCase());
}

export function pruebaModeEnabled(): boolean {
  return (
    parsePruebaFlag(process.env.PRUEBA_MODE) ||
    parsePruebaFlag(process.env.DEMO_MODE)
  );
}

/** 404 sin cuerpo: con la bandera apagada esa ruta no existe en esta instancia. */
export function pruebaDisabledResponse(): Response {
  return new Response(null, { status: 404 });
}

export const PRUEBA_EMAIL = "prueba@whatspower.test";
/** Nombre del usuario de prueba: la organización queda «Negocio de Prueba». */
export const PRUEBA_NAME = "Prueba";

/** Solo server-side: la usa `ensureSesionDePrueba` al crear la cuenta. */
export const PRUEBA_PASSWORD = "prueba-whatspower-sin-registro";

/** La instancia ya tiene organización real: este botón ya no aplica. */
export class ErrorInstanciaYaInicializada extends Error {
  constructor() {
    super("instancia-ya-inicializada");
    this.name = "ErrorInstanciaYaInicializada";
  }
}

/**
 * Garantiza que exista la cuenta de prueba y, en una instancia virgen, que
 * el registro la convierta en propietaria por el camino normal. Idempotente:
 * con la cuenta ya creada no vuelve a registrarla.
 */
export async function ensureSesionDePrueba(): Promise<void> {
  const db = getDb();

  const existente = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, PRUEBA_EMAIL))
    .limit(1);
  if (existente[0]) return;

  // Gate de la instancia ya inicializada: re-verificado justo antes del alta.
  // La ventana de carrera con el primer registro real es de milisegundos; el
  // advisory lock 874201 de `onUserCreated` decide quién se queda la primera
  // organización y el perdedor queda sin membresía (mismo resultado que dos
  // registros reales simultáneos, caso ya documentado).
  if ((await contarOrganizacionesReales(db)) > 0) {
    throw new ErrorInstanciaYaInicializada();
  }

  try {
    // Alta POR EL CAMINO NORMAL: el hook `onUserCreated` crea la organización
    // de la instancia (slug: principal) con sus semillas y deja a esta cuenta
    // como propietaria. El bypass interno solo salta el gate de registro
    // cerrado (FR-060), que aquí ni aplica (instancia virgen).
    await runInternalSignup(() =>
      getAuth().api.signUpEmail({
        body: {
          name: PRUEBA_NAME,
          email: PRUEBA_EMAIL,
          password: PRUEBA_PASSWORD,
        },
      })
    );
  } catch (err) {
    // Carrera benigna: otro clic creó la cuenta entre la lectura y el alta.
    if (!(err instanceof Error && /exist/i.test(err.message))) throw err;
  }
}
