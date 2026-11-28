import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { resetRateLimit } from "@/lib/rate-limit";

/**
 * Acceso al demo sin registro (DEMO_MODE).
 *
 * Lo que importa: con la bandera apagada la ruta NO existe (404 mudo) y no se
 * prepara nada; el demo entra TAMBIÉN en una instancia virgen (D-032) sin
 * robarle la primera organización al propietario real (el alta pasa con el
 * arranque suprimido y la org demo no cuenta para el arranque); el alta es
 * idempotente (un clic más no duplica org ni semillas); y la sesión llega al
 * navegador con las cookies de better-auth. La BD va simulada por FORMA de
 * consulta — el camino completo contra la app viva queda para el host con
 * Postgres (misma situación que sse-backplane).
 */

const st = vi.hoisted(() => ({
  demoUser: false,
  demoMembership: false,
  orgCount: 1,
  inserts: [] as { tabla: string; valores: unknown }[],
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
  runWithoutOnboarding: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock("@/lib/db", () => {
  const tables = {
    user: { __tabla: "user" },
    member: { __tabla: "member" },
    organization: { __tabla: "organization" },
    pipelineStage: { __tabla: "pipelineStage" },
    agentProfile: { __tabla: "agentProfile" },
  };
  function filas(table: { __tabla?: string }, claves: string[]): unknown[] {
    if (table?.__tabla === "organization" && claves.includes("n")) {
      return [{ n: st.orgCount }];
    }
    if (table?.__tabla === "member" && claves.includes("organizationId")) {
      return st.demoMembership ? [{ organizationId: "org_demo" }] : [];
    }
    // user por email
    return st.demoUser ? [{ id: "usr_demo" }] : [];
  }
  function consulta(fields: Record<string, unknown>) {
    const claves = Object.keys(fields);
    return {
      from(table: { __tabla?: string }) {
        // Thenable: el conteo de organizaciones NO pasa por where/limit
        // (`await db.select({n}).from(organization)`), los demás sí.
        const rows = () => Promise.resolve(filas(table, claves));
        return {
          then: (
            res?: (v: unknown[]) => unknown,
            rej?: (e: unknown) => unknown
          ) => rows().then(res, rej),
          where: () => ({
            limit: () => rows(),
          }),
          limit: () => rows(),
        };
      },
    };
  }
  type Insertable = { __tabla?: string };
  function insert(table: Insertable) {
    return {
      values(valores: unknown) {
        st.inserts.push({ tabla: table.__tabla ?? "?", valores });
        return Promise.resolve();
      },
    };
  }
  type FakeDb = {
    select: typeof consulta;
    insert: typeof insert;
    execute: () => Promise<unknown>;
    transaction: (cb: (tx: FakeDb) => Promise<void>) => Promise<void>;
  };
  function db(): FakeDb {
    return {
      select: consulta,
      insert,
      execute: () => Promise.resolve(),
      transaction: (cb: (tx: FakeDb) => Promise<void>) => cb(db()),
    };
  }
  return { getDb: db, schema: tables };
});

import { POST } from "@/app/api/demo/sesion/route";
import {
  DEMO_EMAIL,
  DEMO_ORG_SLUG,
  ErrorInstanciaSinInicializar,
  demoDisabledResponse,
  demoModeEnabled,
  ensureDemoOrg,
  parseDemoFlag,
} from "@/server/identity/auth/demo";

const PETICION = () =>
  new Request("https://crm.negocio.test/api/demo/sesion", {
    method: "POST",
    headers: { "x-forwarded-for": "9.9.9.9" },
  });

const envAntes = { DEMO_MODE: process.env.DEMO_MODE };
afterAll(() => {
  if (envAntes.DEMO_MODE === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = envAntes.DEMO_MODE;
});

function estadoLimpio() {
  st.demoUser = false;
  st.demoMembership = false;
  st.orgCount = 1;
  st.inserts = [];
  st.signUp.mockReset();
  st.signUp.mockImplementation(async () => {
    st.demoUser = true;
    return { user: { id: "usr_demo" } };
  });
  st.signIn.mockReset();
  st.signIn.mockImplementation(async () =>
    new Response(null, {
      status: 200,
      headers: { "set-cookie": "better-auth.session_token=demo; Path=/" },
    })
  );
}

describe("bandera DEMO_MODE", () => {
  it.each(["on", "1", "true", "si", "sí", "SI", " yes "])("acepta %s", (v) => {
    expect(parseDemoFlag(v)).toBe(true);
  });
  it.each([undefined, "", "off", "0", "apagado"])("rechaza %s", (v) => {
    expect(parseDemoFlag(v as string | undefined)).toBe(false);
  });
  it("demoModeEnabled lee el entorno", () => {
    process.env.DEMO_MODE = "on";
    expect(demoModeEnabled()).toBe(true);
    delete process.env.DEMO_MODE;
    expect(demoModeEnabled()).toBe(false);
  });
  it("la respuesta de apagado es 404 mudo", async () => {
    const res = demoDisabledResponse();
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });
});

describe("POST /api/demo/sesion", () => {
  beforeEach(() => {
    resetRateLimit();
    estadoLimpio();
  });

  it("con la bandera apagada la ruta no existe y no toca nada", async () => {
    delete process.env.DEMO_MODE;
    const res = await POST(PETICION());
    expect(res.status).toBe(404);
    expect(st.signUp).not.toHaveBeenCalled();
    expect(st.signIn).not.toHaveBeenCalled();
    expect(st.inserts).toEqual([]);
  });

  it("respeta el rate limit propio (FR-062): 11.º intento → 429", async () => {
    process.env.DEMO_MODE = "on";
    st.demoUser = true;
    st.demoMembership = true;
    for (let i = 0; i < 10; i++) {
      const res = await POST(PETICION());
      expect(res.status).toBe(200);
    }
    const res = await POST(PETICION());
    expect(res.status).toBe(429);
    const cuerpo = (await res.json()) as { error: { code: string } };
    expect(cuerpo.error.code).toBe("rate_limited");
    // La llave del demo es distinta de la del login: este IP puede seguir
    // entrando con su contraseña real.
    const { checkRateLimit, AUTH_RATE_LIMIT } = await import("@/lib/rate-limit");
    expect(
      checkRateLimit("/sign-in/email:9.9.9.9", AUTH_RATE_LIMIT).allowed
    ).toBe(true);
  });

  it("en una instancia virgen el demo entra y se prepara (D-032)", async () => {
    process.env.DEMO_MODE = "on";
    st.orgCount = 0;
    const res = await POST(PETICION());
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=demo");
    // Se crea la cuenta demo (el arranque suprimido se prueba en
    // alta-demo-sin-arranque.test.ts) y se siembra su organización.
    expect(st.signUp).toHaveBeenCalledTimes(1);
    expect(st.signIn).toHaveBeenCalledTimes(1);
    const tablas = st.inserts.map((i) => i.tabla).sort();
    expect(tablas).toEqual(["agentProfile", "member", "organization", "pipelineStage"]);
  });

  it("camino feliz: prepara el demo y devuelve la sesión con cookies", async () => {
    process.env.DEMO_MODE = "on";
    const res = await POST(PETICION());
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("better-auth.session_token=demo");
    expect(st.signIn).toHaveBeenCalledTimes(1);
    const llamada = st.signIn.mock.calls[0]?.[0] as
      | { body: { email: string; password: string } }
      | undefined;
    expect(llamada?.body.email).toBe(DEMO_EMAIL);
    expect(llamada?.body.password.length).toBeGreaterThanOrEqual(8);
    // Semillas de la organización demo
    const tablas = st.inserts.map((i) => i.tabla).sort();
    expect(tablas).toEqual(["agentProfile", "member", "organization", "pipelineStage"]);
  });
});

describe("ensureDemoOrg", () => {
  beforeEach(() => {
    resetRateLimit();
    estadoLimpio();
    process.env.DEMO_MODE = "on";
  });

  it("crea cuenta, organización aislada y semillas cuando no hay nada", async () => {
    await ensureDemoOrg();
    expect(st.signUp).toHaveBeenCalledTimes(1);
    const llamada0 = st.signUp.mock.calls[0]?.[0] as
      | { body: Record<string, string> }
      | undefined;
    const cuerpo = llamada0?.body ?? {};
    expect(cuerpo.email).toBe(DEMO_EMAIL);
    expect(cuerpo.name).toBe("Demo");

    const porTabla = Object.fromEntries(
      st.inserts.map((i) => [i.tabla, i.valores])
    ) as Record<string, unknown>;
    const org = porTabla["organization"] as { name: string; slug: string };
    expect(org.slug).toBe(DEMO_ORG_SLUG);
    expect(org.name).toContain("Demo");
    const member = porTabla["member"] as { role: string; userId: string };
    expect(member.role).toBe("owner");
    expect(member.userId).toBe("usr_demo");
    const etapas = porTabla["pipelineStage"] as {
      position: number;
      kind: string;
      name: string;
    }[];
    expect(etapas.map((e) => e.name)).toEqual([
      "Nuevo",
      "En conversación",
      "Interesado",
      "Cliente",
      "Perdido",
    ]);
    expect(etapas.map((e) => e.position)).toEqual([0, 1, 2, 3, 4]);
    expect(etapas.find((e) => e.name === "Cliente")?.kind).toBe("won");
    expect(etapas.find((e) => e.name === "Perdido")?.kind).toBe("lost");
    const agente = porTabla["agentProfile"] as { reactivateAfterHours: number };
    expect(typeof agente.reactivateAfterHours).toBe("number");
  });

  it("es idempotente: con cuenta y membresía no vuelve a registrar ni sembrar", async () => {
    st.demoUser = true;
    st.demoMembership = true;
    await ensureDemoOrg();
    expect(st.signUp).not.toHaveBeenCalled();
    expect(st.inserts).toEqual([]);
  });

  it("recupera el sembrado si la cuenta existe pero la org no (corte a media vía)", async () => {
    st.demoUser = true;
    await ensureDemoOrg();
    expect(st.signUp).not.toHaveBeenCalled();
    const tablas = st.inserts.map((i) => i.tabla).sort();
    expect(tablas).toEqual(["agentProfile", "member", "organization", "pipelineStage"]);
  });

  it("toma la carrera benigna como éxito si otro clic ya creó la cuenta", async () => {
    st.signUp.mockImplementation(async () => {
      st.demoUser = true;
      throw new Error("User already exists");
    });
    await ensureDemoOrg();
    expect(st.inserts.map((i) => i.tabla).sort()).toEqual([
      "agentProfile",
      "member",
      "organization",
      "pipelineStage",
    ]);
  });

  it("existe el error de instancia virgen para la ruta", () => {
    expect(new ErrorInstanciaSinInicializar().message).toBe(
      "instancia-sin-inicializar"
    );
  });
});
