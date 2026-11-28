import { getDb } from "@/lib/db";
import { contarOrganizacionesReales } from "@/lib/db/instancia";

/**
 * Registro público cerrado tras la primera organización (FR-060), salvo la
 * variable de escape ALLOW_SIGNUP=true. Las cuentas de equipo las crea el
 * propietario (bypass interno del gate).
 *
 * La organización demo (D-032) NO cierra el registro: es un accesorio de
 * prueba aislado, no la primera organización del negocio. Un visitante que
 * entra al demo en una instalación nueva deja el registro del propietario
 * intacto.
 */
export async function isPublicSignupAllowed(): Promise<boolean> {
  if (process.env.ALLOW_SIGNUP === "true") return true;
  return (await contarOrganizacionesReales(getDb())) === 0;
}
