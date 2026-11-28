# Changelog — WhatsPower (apps/web)

## No liberado

### Acceso de prueba sin registro

- Puerta de PRUEBAS (se quita cuando deje de hacer falta): con
  `PRUEBA_MODE=on` (legacy: `DEMO_MODE=on`, mismo efecto), el login muestra
  «Entrar sin registro». En una instancia VIRGEN, un clic crea la cuenta
  propietaria POR EL MISMO CAMINO que un registro real (`signUpEmail` + hook
  de primera organización intacto): organización de la instancia
  (`slug: principal`), semillas del negocio nuevo y guía de inicio. El proceso
  que sigue es el normal de principio a fin — no hay organización demo ni
  datos de ejemplo.
- Límites y seguridad: solo inicializa una instancia sin organización real
  (después responde 409 `ya_inicializada`, nadie entra a la organización de
  otro); con la cuenta de prueba ya creada el botón es reentrada (solo
  sign-in, idempotente); contraseña fija SOLO server-side; rate limit propio
  con la misma política de login/registro (FR-062). Con la bandera apagada la
  ruta responde 404 mudo y el botón no se pinta.
- Sustituye al «Entrar al demo» de D-031/D-032 (organización demo aislada con
  datos de ejemplo), que no servía para recorrer el proceso real. El filtro
  que excluye la organización demo (`slug: demo`) del arranque se conserva
  para las instalaciones que llegaron a crearla.

## 2.12.0 — 2026-11-27

### Migración a WhatsPower

- El núcleo (bandeja, canales, CRM, agenda, API v1, MCP, Laboratorio) se migra
  al monorepo WhatsPower como `apps/web` (paquete `@whatspower/web`), con procedencia
  documentada en `PROVENANCE.md` y atribución de terceros en
  `THIRD_PARTY_NOTICES.md` de la raíz.
- Reorganización estructural de `src/server/*` en los 14 dominios de la
  arquitectura maestra (S4.2), sin cambios de comportamiento: mismas rutas,
  mismos contratos, misma suite de pruebas.
- Rebrand completo de producto: nombre por defecto de instancia («WhatsPower»),
  favicon, marca, documentación, variables `WHATSPOWER_*` y ejemplos de
  `BRAIN_DISPATCH_URL`/`BRAIN_HEALTH_URL` alineados al contrato de
  AGENTE-GENERAL (`{AGENT_DISPATCH_URL}/crm/dispatch`, `/api/v1/health`).
- La versión del paquete continúa en 2.12.0 para mantener la continuidad del
  historial de versiones y el valor por defecto de `CRM_WHATSPOWER_VERSION` en
  `docker-compose.yml`.
