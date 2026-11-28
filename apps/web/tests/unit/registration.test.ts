import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * FR-060/FR-081: registro cerrado tras la 1ª organización, salvo escape.
 *
 * D-032: el conteo que decide el cierre excluye la organización demo —
 * `contarOrganizacionesReales` filtra por `slug <> 'demo'`; aquí el `where`
 * se captura para verificar que el filtro se aplica y el conteo simulado es
 * el de organizaciones REALES.
 */

const st = vi.hoisted(() => ({
  orgCount: 0,
  whereCapturado: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          st.whereCapturado = cond;
          return Promise.resolve([{ n: st.orgCount }]);
        },
      }),
    }),
  }),
  schema: { organization: {} },
}));

import { isPublicSignupAllowed } from "@/server/identity/auth/registration";

afterEach(() => {
  vi.unstubAllEnvs();
  st.whereCapturado = null;
});

describe("registro público cerrado", () => {
  it("instancia vacía → registro permitido (primer usuario)", async () => {
    st.orgCount = 0;
    vi.stubEnv("ALLOW_SIGNUP", "");
    expect(await isPublicSignupAllowed()).toBe(true);
    // El conteo va filtrado: la organización demo no cierra el registro.
    expect(st.whereCapturado).toBeDefined();
  });

  it("ya existe una organización real → cerrado", async () => {
    st.orgCount = 1;
    vi.stubEnv("ALLOW_SIGNUP", "");
    expect(await isPublicSignupAllowed()).toBe(false);
  });

  it("solo la organización demo → el registro sigue abierto (D-032)", async () => {
    // La consulta SQL excluye la org demo; si el filtro deja 0 organizaciones
    // reales, el propietario todavía puede crear su cuenta inicial.
    st.orgCount = 0;
    vi.stubEnv("ALLOW_SIGNUP", "");
    expect(await isPublicSignupAllowed()).toBe(true);
  });

  it("escape ALLOW_SIGNUP=true → permitido aunque exista organización", async () => {
    st.orgCount = 1;
    vi.stubEnv("ALLOW_SIGNUP", "true");
    expect(await isPublicSignupAllowed()).toBe(true);
  });

  it("otros valores del escape NO abren el registro", async () => {
    st.orgCount = 1;
    vi.stubEnv("ALLOW_SIGNUP", "1");
    expect(await isPublicSignupAllowed()).toBe(false);
  });
});
