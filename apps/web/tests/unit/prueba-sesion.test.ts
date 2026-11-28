import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "@/lib/rate-limit";

/**
 * Acceso de PRUEBA sin registro (D-033).
 *
 * Lo que importa: con la bandera apagada la ruta NO existe (404 mudo) y no se
 * prepara nada; en instancia VIRGEN el alta pasa POR EL CAMINO REAL
 * (`signUpEmail` con el hook de primera organización intacto — nada de
 * organización demo ni semillas ajenas); en instancia ya inicializada sin
 * cuenta de prueba responde 409 y no toca nada (nadie entra a la organización
 * de otro); con la cuenta de prueba ya creada es reentrada (solo sign-in); y
 * la sesión llega al navegador con las cookies de better-auth. La BD va
 * simulada por FORMA de consulta — el camino completo contra la app viva
 * queda para el host con Postgres (misma situación que sse-backplane).
 */

const st = vi.hoisted(() => ({
  pruebaUser: false,
  /** Organizaciones REALES (el conteo SQL ya excluye la org demo, D-032). */
  orgCount: 0,
  signUp: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: {
      signUpEmail: st.signUp,
      signInEmail: st.signIn,
    },
  }),
  runInternalSignup: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/db", () => {
  const tables = {
    user: { __tabla: "user" },
    organization: { __tabla: "organization" },
  };
  function filas(table: { __tabla?: string }, claves: string[]): unknown[] {
    if (table?.__tabla === "organization" && claves.includes("n")) {
      return [{ n: st.orgCount }];
    }
    // user por email
    return st.pruebaUser ? [{ id: "usr_prueba" }] : [];
  }
  function consulta(fields: Record<string, unknown>) {
    const claves = Object.keys(fields);
    return {
      from(table: { __tabla?: string }) {
        const rows = () => Promise.resolve(filas(table, claves));
        // Nodo encadenable y thenable a la vez: el conteo de organizaciones
        // termina en `.where(...)` y se espera directo; la cuenta por email
        // termina en `.where(...).limit(1)`.
        const node = {
          then: (
            res?: (v: unknown[]) => unknown,
            rej?: (e: unknown) => unknown
          ) => rows().then(res, rej),
          where: () => node,
          limit: () => rows(),
        };
        return node;
      },
    };
  }
  function db() {
    return {
      select: consulta,
      // `ensureSesionDePrueba` no inserta nada: el alta real (usuario,
      // organización, semillas) la hace better-auth dentro de signUpEmail.
    };
  }
  return { getDb: db, schema: tables };
});

import { POST } from "@/app/api/prueba/sesion/route";
import {
  PRUEBA_EMAIL,
  ErrorInstanciaYaInicializada,
  pruebaDisabledResponse,
  pruebaModeEnabled,
  parsePruebaFlag,
  ensureSesionDePrueba,
} from "@/server/identity/auth/prueba";

const PETICION = () =>
  new Request("https://crm.negocio.test/api/prueba/sesion", {
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9" },
  });

const envAntes = {
  PRUEBA_MODE: process.env.PRUEBA_MODE,
  DEMO_MODE: process.env.DEMO_MODE,
};
afterAll(() => {
  for (const k of ["PRUEBA_MODE", "DEMO_MODE"] as const) {
    if (envAntes[k] === undefined) delete process.env[k];
    else process.env[k] = envAntes[k];
  }
});

function estadoLimpio() {
  st.pruebaUser = false;
  st.orgCount = 0;
  st.signUp.mockReset();
  st.signUp.mockImplementation(async () => {
    st.pruebaUser = true;
    return { user: { id: "usr_prueba" } };
  });
  st.signIn.mockReset();
  st.signIn.mockImplementation(async () =>
    new Response(null, {
      status: 200,
      headers: { "set-cookie": "better-auth.session_token=prueba; Path=/" },
    })
  );
}

describe("bandera del acceso de prueba", () => {
  it.each(["on", "1", "true", "si", "sí", "SI", " yes "])("acepta %s", (v) => {
    expect(parsePruebaFlag(v)).toBe(true);
  });
  it.each([undefined, "", "off", "0", "apagado"])("rechaza %s", (v) => {
    expect(parsePruebaFlag(v as string | undefined)).toBe(false);
  });
  it("PRUEBA_MODE enciende", () => {
    process.env.PRUEBA_MODE = "on";
    delete process.env.DEMO_MODE;
    expect(pruebaModeEnabled()).toBe(true);
  });
  it("DEMO_MODE sigue aceptándose (legacy D-031/D-032, despliegues vivos)", () => {
    delete process.env.PRUEBA_MODE;
    process.env.DEMO_MODE = "on";
    expect(pruebaModeEnabled()).toBe(true);
  });
  it("sin ninguna bandera está apagado", () => {
    delete process.env.PRUEBA_MODE;
    delete process.env.DEMO_MODE;
    expect(pruebaModeEnabled()).toBe(false);
  });
  it("la respuesta de apagado es 404 mudo", async () => {
    const res = pruebaDisabledResponse();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });
});

describe("POST /api/prueba/sesion", () => {
  beforeEach(() => {
    resetRateLimit();
    estadoLimpio();
    delete process.env.PRUEBA_MODE;
    delete process.env.DEMO_MODE;
  });

  it("con la bandera apagada la ruta no existe y no toca nada", async () => {
    const res = await POST(PETICION());
    expect(res.status).toBe(404);
    expect(st.signUp).not.toHaveBeenCalled();
    expect(st.signIn).not.toHaveBeenCalled();
  });

  it("respeta el rate limit propio (FR-062): 11.º intento → 429", async () => {
    process.env.PRUEBA_MODE = "on";
    st.pruebaUser = true;
    for (let i = 0; i < 10; i++) {
      const res = await POST(PETICION());
      expect(res.status).toBe(200);
    }
    const res = await POST(PETICION());
    expect(res.status).toBe(429);
    const cuerpo = (await res.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe("rate_limited");
    // La llave de la prueba es distinta de la del login: este IP puede seguir
    // entrando con su contraseña real.
    const { checkRateLimit, AUTH_RATE_LIMIT } = await import("@/lib/rate-limit");
    expect(
      checkRateLimit("/sign-in/email:9.9.9.9", AUTH_RATE_LIMIT).allowed
    ).toBe(true);
  });

  it("en instancia VIRGEN crea la cuenta por el camino REAL y da la sesión", async () => {
    process.env.PRUEBA_MODE = "on";
    st.orgCount = 0;
    const res = await POST(PETICION());
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(
      "better-auth.session_token=prueba"
    );
    // UNA llamada de alta — con el hook de primera organización intacto
    // (organización de la instancia, semillas y guía: proceso normal).
    expect(st.signUp).toHaveBeenCalledTimes(1);
    const alta = st.signUp.mock.calls[0]?.[0] as
      | { body: { email: string; name: string; password: string } }
      | undefined;
    expect(alta?.body.email).toBe(PRUEBA_EMAIL);
    expect(alta?.body.name.length).toBeGreaterThan(0);
    expect(alta?.body.password.length).toBeGreaterThanOrEqual(8);
    expect(st.signIn).toHaveBeenCalledTimes(1);
  });

  it("en instancia YA INICIALIZADA sin cuenta de prueba responde 409 y no crea nada", async () => {
    process.env.PRUEBA_MODE = "on";
    st.orgCount = 1;
    const res = await POST(PETICION());
    expect(res.status).toBe(409);
    const cuerpo = (await res.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe("ya_inicializada");
    expect(st.signUp).not.toHaveBeenCalled();
    expect(st.signIn).not.toHaveBeenCalled();
  });

  it("con la cuenta de prueba ya creada es reentrada: solo sign-in", async () => {
    process.env.PRUEBA_MODE = "on";
    st.pruebaUser = true;
    st.orgCount = 1;
    const res = await POST(PETICION());
    expect(res.status).toBe(200);
    expect(st.signUp).not.toHaveBeenCalled();
    expect(st.signIn).toHaveBeenCalledTimes(1);
    const llamada = st.signIn.mock.calls[0]?.[0] as
      | { body: { email: string; password: string } }
      | undefined;
    expect(llamada?.body.email).toBe(PRUEBA_EMAIL);
  });

  it("toma la carrera benigna como éxito si otro clic ya creó la cuenta", async () => {
    process.env.PRUEBA_MODE = "on";
    st.signUp.mockImplementation(async () => {
      st.pruebaUser = true;
      throw new Error("User already exists");
    });
    const res = await POST(PETICION());
    expect(res.status).toBe(200);
    expect(st.signIn).toHaveBeenCalledTimes(1);
  });
});

describe("ensureSesionDePrueba", () => {
  beforeEach(() => {
    resetRateLimit();
    estadoLimpio();
    process.env.PRUEBA_MODE = "on";
  });

  it("existe el error de instancia ya inicializada", () => {
    expect(new ErrorInstanciaYaInicializada().message).toBe(
      "instancia-ya-inicializada"
    );
  });

  it("no vuelve a registrar una cuenta existente", async () => {
    st.pruebaUser = true;
    await ensureSesionDePrueba();
    expect(st.signUp).not.toHaveBeenCalled();
  });
});
