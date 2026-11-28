import { describe, expect, it } from "vitest";
import { tituloConNoLeidos } from "@/components/avisos-de-mensajes";

/** 045 — El contador de la pestaña, como «(3) WhatsApp». */
describe("tituloConNoLeidos", () => {
  it("antepone los chats sin leer", () => {
    expect(tituloConNoLeidos("WhatsPower — CRM", 3)).toBe("(3) WhatsPower — CRM");
  });
  it("sin pendientes deja el título limpio", () => {
    expect(tituloConNoLeidos("(3) WhatsPower — CRM", 0)).toBe("WhatsPower — CRM");
  });
  it("no apila contadores al actualizar", () => {
    expect(tituloConNoLeidos("(3) WhatsPower — CRM", 5)).toBe("(5) WhatsPower — CRM");
  });
  it("más de 99 se muestra como 99+", () => {
    expect(tituloConNoLeidos("WhatsPower", 140)).toBe("(99+) WhatsPower");
    expect(tituloConNoLeidos("(99+) WhatsPower", 2)).toBe("(2) WhatsPower");
  });
});
