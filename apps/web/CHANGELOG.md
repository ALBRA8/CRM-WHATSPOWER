# Changelog — WhatsPower (apps/web)

## No liberado

### Acceso al demo sin registro

- Nuevo interruptor opcional `DEMO_MODE` (mismo patrón que `AGENDA`/`API_V1`).
  Encendido, el login muestra el botón «Entrar al demo»: un visitante explora
  el CRM sin crear cuenta, dentro de una organización demo aislada (su propia
  organización, membresía y semillas de pipeline/agente), vía
  `POST /api/demo/sesion` con rate limit propio (FR-062). Apagado, la ruta
  responde 404 mudo y el login no cambia.
- El demo funciona desde la PRIMERA visita (D-032): el alta demo atraviesa el
  bypass interno del gate de registro (FR-060) con el hook de primera
  organización suprimido (`runWithoutOnboarding`), y la organización demo no
  cuenta para el arranque (`contarOrganizacionesReales` la excluye). El
  propietario real conserva su primer registro intacto y el registro público
  sigue abierto hasta que exista su organización; bot, OAuth y la marca/apariencia
  del login nunca toman la organización demo como la de la instancia.

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
