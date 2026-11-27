import { describe, expect, it } from "vitest";
import { tituloConNoLeidos } from "@/components/avisos-de-mensajes";

/** 045 — El contador de la pestaña, como «(3) WhatsApp». */
describe("tituloConNoLeidos", () => {
  it("antepone los chats sin leer", () => {
    expect(tituloConNoLeidos("Vestro — CRM", 3)).toBe("(3) Vestro — CRM");
  });
  it("sin pendientes deja el título limpio", () => {
    expect(tituloConNoLeidos("(3) Vestro — CRM", 0)).toBe("Vestro — CRM");
  });
  it("no apila contadores al actualizar", () => {
    expect(tituloConNoLeidos("(3) Vestro — CRM", 5)).toBe("(5) Vestro — CRM");
  });
  it("más de 99 se muestra como 99+", () => {
    expect(tituloConNoLeidos("Vestro", 140)).toBe("(99+) Vestro");
    expect(tituloConNoLeidos("(99+) Vestro", 2)).toBe("(2) Vestro");
  });
});
