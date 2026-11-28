import { apiError } from "@/lib/api";
import { AUTH_RATE_LIMIT, checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  ErrorInstanciaSinInicializar,
  demoDisabledResponse,
  demoModeEnabled,
  ensureDemoOrg,
} from "@/server/identity/auth/demo";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/sesion — acceso sin registro (DEMO_MODE=on).
 *
 * Garantiza cuenta + organización demo aislada y deja la sesión puesta con
 * las cookies de better-auth. Con la bandera apagada responde 404 mudo: para
 * el que prueba, esta ruta no existe en esa instancia.
 */
export async function POST(req: Request): Promise<Response> {
  if (!demoModeEnabled()) return demoDisabledResponse();

  // Mismo límite que login/registro (FR-062), con su propia llave: el demo no
  // debe poder quemar el cupo del login de un mismo IP, ni viceversa.
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(`/demo/sesion:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) {
    return apiError(
      429,
      "rate_limited",
      "Demasiados intentos; espera unos minutos"
    );
  }

  try {
    await ensureDemoOrg();
  } catch (err) {
    if (err instanceof ErrorInstanciaSinInicializar) {
      return apiError(
        409,
        "sin_organizacion",
        "Esta instancia todavía no tiene su organización: primero crea la cuenta del propietario."
      );
    }
    return apiError(500, "demo_fallo", "No se pudo preparar el demo.");
  }

  const auth = getAuth();
  // asResponse: better-auth devuelve la Response con las cookies de sesión
  // puestas; se reenvía tal cual al navegador.
  return auth.api.signInEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    headers: req.headers,
    asResponse: true,
  });
}
