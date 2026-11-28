import { apiError } from "@/lib/api";
import { AUTH_RATE_LIMIT, checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  PRUEBA_EMAIL,
  PRUEBA_PASSWORD,
  ErrorInstanciaYaInicializada,
  pruebaDisabledResponse,
  pruebaModeEnabled,
  ensureSesionDePrueba,
} from "@/server/identity/auth/prueba";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/prueba/sesion — acceso de prueba sin registro (bandera encendida).
 *
 * En una instancia virgen crea la cuenta propietaria POR EL MISMO CAMINO que
 * un registro real (organización de la instancia, semillas y guía de inicio)
 * y deja la sesión puesta con las cookies de better-auth: el proceso que
 * sigue después es el normal de principio a fin. En una instancia ya
 * inicializada sin cuenta de prueba responde 409. Con la bandera apagada
 * responde 404 mudo: para el que prueba, esta ruta no existe en esa instancia.
 */
export async function POST(req: Request): Promise<Response> {
  if (!pruebaModeEnabled()) return pruebaDisabledResponse();

  // Mismo límite que login/registro (FR-062), con su propia llave: esta ruta
  // no debe poder quemar el cupo del login de un mismo IP, ni viceversa.
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(`/prueba/sesion:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) {
    return apiError(
      429,
      "rate_limited",
      "Demasiados intentos; espera unos minutos"
    );
  }

  try {
    await ensureSesionDePrueba();
  } catch (err) {
    if (err instanceof ErrorInstanciaYaInicializada) {
      return apiError(
        409,
        "ya_inicializada",
        "Esta instancia ya tiene su organización: entra con tu cuenta."
      );
    }
    return apiError(
      500,
      "prueba_fallo",
      "No se pudo preparar el acceso de prueba."
    );
  }

  const auth = getAuth();
  // asResponse: better-auth devuelve la Response con las cookies de sesión
  // puestas; se reenvía tal cual al navegador.
  return auth.api.signInEmail({
    body: { email: PRUEBA_EMAIL, password: PRUEBA_PASSWORD },
    headers: req.headers,
    asResponse: true,
  });
}
