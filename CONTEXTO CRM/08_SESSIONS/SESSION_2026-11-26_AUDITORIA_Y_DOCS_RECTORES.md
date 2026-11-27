# SESIÓN 2026-11-26 — Auditoría de repositorios y documentos rectores (F0-F3)

## Objetivo

Cumplir F0-F3 del roadmap: auditar realmente los 6 repositorios, mapear la
paridad funcional de VOCERO, resolver el cuadro de licencias, fijar la
arquitectura maestra, el modelo multi-tenant, los contratos de integración, el
roadmap de construcción y el registro de riesgos.

## Hechos con evidencia

1. **Clonación real de los 6 repositorios** (no análisis superficial): vocero-crm (v2.12.0, commit `aa90a81`), CRM-WHATSAPP, CRM-ALBRA v0.2.1, WHATSPOWER, WHATSPOWER-ULTRA, AGENTE-GENERAL (albra-seed).
2. **Matriz de paridad VOCERO:** 156 capacidades mapeadas al 100 % (67 conservar / 69 adaptar / 5 refactorizar / 15 nuevas), identificando las carencias de VOCERO frente al mandato (etiquetas, asignación de asesor, cotizaciones, productos).
3. **Cuadro de licencias:** MIT confirmado en VOCERO (Kevin Belier), CRM-WHATSAPP (AILINK), WHATSPOWER y AGENTE-GENERAL (+OpenClaw MIT). CRM-ALBRA y WHATSPOWER-ULTRA SIN licencia. Baileys/libsignal detectados como GPL-3.0 → exclusión del producto comercial.
4. **Arquitectura maestra:** 14 dominios, decisión de stack (base VOCERO), monorepo modular, AGENTE-GENERAL como único cerebro, C4 y modelo de datos.
5. **Modelo multi-tenant:** PostgreSQL + RLS con `FORCE`, doble valla, propagación de contexto, memoria del agente por `org:*`, batería T1-T15.
6. **Contratos de integración:** 15 operaciones del mandato, bot API v1 de 13 rutas conservado, catálogo único de errores tipados, contratos de flujos y campañas, conectores de agenda, webhooks de canales.
7. **Roadmap F0-F12** con sprints y criterios de aceptación por fase; **registro de 40+ riesgos** con exposición.

## Resultado

8/8 documentos rectores entregados y aprobados como base de la Fase 4.

## Pendientes que hereda la siguiente sesión

- Decisión del propietario sobre licencias de CRM-ALBRA/ULTRA (solicitudes de LICENSE).
- Confirmación de la marca «Vestro» (D-012).
- Inicio de F4 (S4.1): monorepo y portación del núcleo.
