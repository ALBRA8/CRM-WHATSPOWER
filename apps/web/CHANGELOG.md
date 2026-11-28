# Changelog — WhatsPower (apps/web)

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
