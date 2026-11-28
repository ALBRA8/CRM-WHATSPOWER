import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-032 — El alta del demo no dispara el arranque de primera organización.
 *
 * El hook `user.create.after` de better-auth (`alCrearUsuario`) convierte al
 * primer usuario de una instancia virgen en propietario (`onUserCreated`).
 * La cuenta demo lo atraviesa envuelta en `runWithoutOnboarding`: el hook no
 * se dispara y el demo sale sin organización — la suya la crea después
 * `ensureDemoOrg` (org `demo` aislada que no cuenta para el arranque).
 * Así, entrar al demo en una instalación nueva deja intacto el primer
 * registro del propietario real.
 */

const mocks = vi.hoisted(() => ({
  onUserCreated: vi.fn(),
}));

vi.mock("@/server/identity/auth/on-signup", () => ({
  onUserCreated: mocks.onUserCreated,
  resolveActiveOrganizationId: vi.fn(async () => null),
  resolveMembership: vi.fn(async () => null),
}));

// Solo imports de módulo: `getAuth()` jamás se llama aquí (no toca better-auth
// ni la BD real; lib/db solo define el cliente perezoso).
import { alCrearUsuario, runWithoutOnboarding } from "@/lib/auth";

describe("el hook de primera organización se puede suprimir", () => {
  beforeEach(() => {
    mocks.onUserCreated.mockReset();
  });

  it("un alta normal dispara el arranque (el primer usuario es propietario)", async () => {
    await alCrearUsuario({ id: "usr_1", name: "Ana" });
    expect(mocks.onUserCreated).toHaveBeenCalledTimes(1);
    expect(mocks.onUserCreated).toHaveBeenCalledWith("usr_1", "Ana");
  });

  it("el alta del demo sale sin organización ni semillas ajenas", async () => {
    await runWithoutOnboarding(() =>
      alCrearUsuario({ id: "usr_demo", name: "Demo" })
    );
    expect(mocks.onUserCreated).not.toHaveBeenCalled();
  });

  it("la supresión no se sale de la llamada envuelta", async () => {
    await runWithoutOnboarding(() =>
      alCrearUsuario({ id: "usr_demo", name: "Demo" })
    );
    // Fuera del contexto, el siguiente alta vuelve a disparar el arranque.
    await alCrearUsuario({ id: "usr_2", name: "Beto" });
    expect(mocks.onUserCreated).toHaveBeenCalledTimes(1);
    expect(mocks.onUserCreated).toHaveBeenCalledWith("usr_2", "Beto");
  });

  it("nidas: solo mientras dura el contexto interno", async () => {
    await runWithoutOnboarding(async () => {
      await runWithoutOnboarding(() =>
        alCrearUsuario({ id: "usr_demo", name: "Demo" })
      );
    });
    await alCrearUsuario({ id: "usr_3", name: "Cara" });
    expect(mocks.onUserCreated).toHaveBeenCalledTimes(1);
    expect(mocks.onUserCreated).toHaveBeenCalledWith("usr_3", "Cara");
  });
});
