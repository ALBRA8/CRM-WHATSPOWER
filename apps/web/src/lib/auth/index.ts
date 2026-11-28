import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { AUTH_RATE_LIMIT, checkRateLimit, clientIp } from "@/lib/rate-limit";
import {
  onUserCreated,
  resolveActiveOrganizationId,
} from "@/server/identity/auth/on-signup";
import { isPublicSignupAllowed } from "@/server/identity/auth/registration";

/**
 * Contexto interno del proceso: permite que el alta de cuentas de equipo
 * (owner → API) atraviese el gate de registro cerrado. No es alcanzable
 * desde fuera: solo envuelve llamadas server-side.
 */
const globalForSignup = globalThis as unknown as {
  __whatspowerInternalSignup?: AsyncLocalStorage<boolean>;
};

// En globalThis: los módulos pueden evaluarse más de una vez (una por ruta en
// dev) y todas las copias deben compartir el mismo contexto.
function internalSignupContext(): AsyncLocalStorage<boolean> {
  if (!globalForSignup.__whatspowerInternalSignup) {
    globalForSignup.__whatspowerInternalSignup = new AsyncLocalStorage<boolean>();
  }
  return globalForSignup.__whatspowerInternalSignup;
}

export function runInternalSignup<T>(fn: () => Promise<T>): Promise<T> {
  return internalSignupContext().run(true, fn);
}

function isInternalSignup(): boolean {
  return internalSignupContext().getStore() === true;
}

/**
 * Contexto de arranque suprimido (D-032): el alta del demo crea su usuario
 * SIN el hook de primera organización. En una instancia virgen, el demo no
 * debe poder quedarse con la organización del propietario real. Mismo patrón
 * que el contexto de alta interna: AsyncLocalStorage en globalThis.
 */
const globalForOnboarding = globalThis as unknown as {
  __whatspowerSkipOnboarding?: AsyncLocalStorage<boolean>;
};

function skipOnboardingContext(): AsyncLocalStorage<boolean> {
  if (!globalForOnboarding.__whatspowerSkipOnboarding) {
    globalForOnboarding.__whatspowerSkipOnboarding = new AsyncLocalStorage<boolean>();
  }
  return globalForOnboarding.__whatspowerSkipOnboarding;
}

export function runWithoutOnboarding<T>(fn: () => Promise<T>): Promise<T> {
  return skipOnboardingContext().run(true, fn);
}

function isOnboardingSuppressed(): boolean {
  return skipOnboardingContext().getStore() === true;
}

/**
 * Hook `user.create.after` de better-auth: el primer usuario REAL de una
 * instancia virgen se convierte en propietario (onUserCreated). El alta del
 * demo lo atraviesa con el arranque suprimido y sale sin organización: la suya
 * la crea después `ensureDemoOrg` (una organización `demo` aislada, que
 * `contarOrganizacionesReales` no ve). Exportado a propósito: el unit test
 * lo prueba sin levantar better-auth.
 */
export async function alCrearUsuario(user: { id: string; name: string }) {
  if (isOnboardingSuppressed()) return;
  await onUserCreated(user.id, user.name);
}

const RATE_LIMITED_PATHS = new Set(["/sign-in/email", "/sign-up/email"]);

function createAuth() {
  const env = getEnv();
  return betterAuth({
    baseURL: env.APP_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        organization: schema.organization,
        member: schema.member,
        invitation: schema.invitation,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    plugins: [organization({ creatorRole: "owner" })],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Rate limit por IP en login/registro (FR-062): 10 / 10 min → 429.
        if (RATE_LIMITED_PATHS.has(ctx.path)) {
          const ip = clientIp(ctx.headers);
          const result = checkRateLimit(`${ctx.path}:${ip}`, AUTH_RATE_LIMIT);
          if (!result.allowed) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Demasiados intentos; espera unos minutos",
            });
          }
        }
        // Registro público cerrado tras la primera organización (FR-060).
        if (ctx.path === "/sign-up/email") {
          if (!isInternalSignup() && !(await isPublicSignupAllowed())) {
            throw new APIError("FORBIDDEN", {
              message:
                "El registro está cerrado: esta instancia ya tiene su organización",
            });
          }
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: alCrearUsuario,
        },
      },
      session: {
        create: {
          before: async (session) => {
            const organizationId = await resolveActiveOrganizationId(
              session.userId
            );
            return {
              data: { ...session, activeOrganizationId: organizationId },
            };
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __whatspowerAuth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.__whatspowerAuth) globalForAuth.__whatspowerAuth = createAuth();
  return globalForAuth.__whatspowerAuth;
}
