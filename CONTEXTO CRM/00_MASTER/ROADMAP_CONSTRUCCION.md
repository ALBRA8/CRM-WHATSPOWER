# ROADMAP_CONSTRUCCION.md

**Proyecto:** Construcción del nuevo CRM SaaS multi-tenant
**Fase:** 3 — Plan de construcción en 12 fases
**Fecha:** 2026-11-27
**Regla de gates:** ninguna fase declara aprobación sin su documentación y sus criterios de aceptación en verde. La unidad de trabajo es el **sprint** (1-2 semanas); las tareas dentro de cada sprint son verificables por prueba o por entregable revisable.

## 0. Flujo general

```
F0 Documentación obligatoria (los 8 documentos)          ← este paquete
F1 Auditoría técnica y legal        F2 Inventario y paridad de VOCERO
F3 Arquitectura maestra y modelo    F4 Base funcional y modularización
F5 Multi-tenancy y seguridad        F6 CRM y omnicanalidad
F7 Integración de AGENTE-GENERAL    F8 Plantillas sectoriales e instalador
F9 WHATSPOWER y ULTRA               F10 MCP, Meta CAPI y agendas
F11 SaaS, monetización y admin      F12 Pruebas, despliegue y producción
```

Dependencias duras: F4←F3; F5←F4; F6←F5; F7←F6; F9←F6 (adaptadores) y F7 (agente para flujos con IA); F8←F6; F10←F7; F11←F10; F12←F11. F8 puede correr en paralelo con F7 si hay dos líneas de trabajo.

---

## FASE 0 — Documentación obligatoria (este paquete)

**Objetivo.** Congelar la base documental antes de tocar código (mandato §20).

**Entregables.** `ARQUITECTURA_MAESTRA_CRM.md`, `REPOSITORIOS_AUDITORIA.md`, `MATRIZ_PARIDAD_VOCERO.md`, `MATRIZ_LICENCIAS.md`, `MODELO_MULTI_TENANT.md`, `CONTRATOS_INTEGRACION.md`, `ROADMAP_CONSTRUCCION.md`, `RIESGOS_TECNICOS.md`.

**Criterios de aceptación.** [x] Los 8 documentos existen, cubren el mandato línea por línea y son revisables; [ ] revisión y aprobación de los titulares; [ ] acciones legales de `MATRIZ_LICENCIAS.md` §10 iniciadas (licencia de CRM-ALBRA/ULTRA o confirmación de camino clean-room).

## FASE 1 — Auditoría técnica y legal de los seis repositorios

**Objetivo.** Evidencia completa de stack, capacidades, licencias y riesgos por repositorio.

**Alcance.** Clonación y análisis de los 6 repos; inventario de dependencias; titularidad y licencias; riesgos (`REPOSITORIOS_AUDITORIA.md`, `MATRIZ_LICENCIAS.md`).

**Sprints.**
- S1.1 Clonación + métricas + fichas por repo (stack, estructura, capacidad, seguridad, tests, deuda).
- S1.2 Auditoría de dependencias y licencias terceros; plantilla `THIRD_PARTY_NOTICES`; acción legal sobre repos sin licencia.
- S1.3 Registro de riesgos inicial (`RIESGOS_TECNICOS.md`) y decisiones de disposición (conservar/adaptar/reconstruir).

**Criterios de aceptación.** Las 6 fichas completas con rutas veredictibles; matriz de licencias con obligaciones y condiciones; riesgo legal Baileys/GPL documentado y decisión tomada (solo APIs oficiales); cero código sin licencia trasladado.

## FASE 2 — Inventario funcional y matriz de paridad de VOCERO

**Objetivo.** Garantizar por escrito que nada de VOCERO se pierde.

**Sprints.**
- S2.1 Inventario verificado (28 pantallas, 142 rutas, 43 tablas, 65 specs) y matriz de paridad por dominio.
- S2.2 Mapeo de capacidades del chaleco ausentes en VOCERO (etiquetas, asignación, cotizaciones, productos, empresas, tareas, finanzas…) con origen.
- S2.3 Selección de guiones E2E de VOCERO como base de regresión de la nueva plataforma.

**Criterios de aceptación.** `MATRIZ_PARIDAD_VOCERO.md` con cobertura 100 % y estrategia por capacidad; suite de regresión definida (guiones + arneses a portar).

## FASE 3 — Arquitectura maestra y modelo de datos

**Objetivo.** Definir límites de módulos y contratos antes de escribir código (mandato §18).

**Sprints.**
- S3.1 `ARQUITECTURA_MAESTRA_CRM.md` (dominios, diagramas, stack, composición).
- S3.2 `MODELO_MULTI_TENANT.md` (RLS, propagación, batería de pruebas de fuga) y `CONTRATOS_INTEGRACION.md` (catálogo de operaciones, errores, payloads).
- S3.3 Modelo de datos por dominio (extensiones del esquema Drizzle de VOCERO: empresas, cotizaciones, productos, tareas, etiquetas, asignaciones, audit_log, billing) en specs SDD.

**Criterios de aceptación.** Diagramas publicados; contratos versionados con payloads; esquema de datos propuesto revisado contra las 43 tablas existentes; decisiones abiertas (ADR backlog) listadas con dueño.

## FASE 4 — Preparación de la base funcional y modularización

**Objetivo.** El código de VOCERO organizado en dominios, funcionando igual que hoy.

**Sprints.**
- S4.1 Nuevo monorepo (`apps/web`, `packages/contracts`, `infra/`); portar núcleo VOCERO (auth, db, crypto, meta client, rate-limit, eventos); verificación de licencias desde lockfile + `THIRD_PARTY_NOTICES` generado.
- S4.2 Reorganización de `src/server/*` en los 14 dominios (extracción, sin cambios de comportamiento); tabla `audit_log` tamper-evident + ganchos de auditoría en operaciones sensibles.
- S4.3 Test de vigilancia de fronteras: ningún dominio importa tablas de otro por fuera de su contrato; suite de regresión VOCERO en verde (guiones E2E portados).

**Criterios de aceptación.** typecheck/lint/build/test en verde; paridad E2E (muestra de guiones de bandeja, pipeline, agenda, laboratorio, resultados); `doctor` e `init-env` operando; sin cambios visibles de comportamiento.

## FASE 5 — Multi-tenancy y seguridad

**Objetivo.** Convertir la instancia mono-tenant en plataforma multi-tenant con aislamiento demostrable.

**Sprints.**
- S5.1 RLS habilitada con políticas por tabla + rol `app_runtime` + `SET LOCAL app.current_org` por transacción; `scoped()` revisado como segunda valla.
- S5.2 Propagación de contexto (AsyncLocalStorage → workers/jobs/SSE/MCP/backplane SSE multi-replica); credenciales y media org-scoped; rate-limit y límites compatibles con multi-replica.
- S5.3 RBAC fino + 2FA (especificación de CRM-ALBRA, implementación nueva) + super-admin con switch-organization auditado; **batería de pruebas de fuga T1-T15 en CI**.

**Criterios de aceptación.** T1-T15 verdes sobre PostgreSQL real; un despliegue con 2 organizaciones demostrando aislamiento completo (datos, media, credenciales, cachés, memoria del agente); auditoría operativa y verificable.

## FASE 6 — CRM y omnicanalidad

**Objetivo.** El entorno de trabajo completo: bandeja omnicanal + CRM comercial.

**Sprints.**
- S6.1 Canales: WhatsApp + Instagram + Messenger + TikTok (adaptador Zernio) + **Telegram** (nuevo adaptador oficial); embedded signup; plantillas; webhook en dos capas; persistir antes del ACK.
- S6.2 Bandeja paridad total (estados, ventana, adjuntos, notas de voz, citar, reenviar, reacciones, fijar, borradores, búsqueda, respuestas rápidas, eventos de hilo) + SSE por tenant.
- S6.3 CRM: contactos (import CSV E.164 multi-país, «sin agente»), etiquetas, asignación de asesores, pipeline kanban + bitácora, notas, **empresas, productos, cotizaciones con PDF, tareas y seguimientos**.
- S6.4 Resultados/analítica paridad + higiene; PWA y marca blanca por organización.

**Criterios de aceptación.** Regresión E2E de VOCERO en verde por canal; flujo E2E completo: clic de anuncio → conversación → lead → cotización → venta, con datos de un solo tenant; sin botones muertos.

## FASE 7 — Integración de AGENTE-GENERAL

**Objetivo.** Único cerebro conectado por adaptador versionado; el CRM no reimplementa nada cognitivo.

**Sprints.**
- S7.1 Adaptador CRM↔agente (despacho firmado con coalescing + red de seguridad; contexto autorizado; ficha; etapa; handoff; typing; media) según `CONTRATOS_INTEGRACION.md`; agentes lógicos por organización (perfil + especialización + herramientas autorizadas).
- S7.2 Memoria del agente tenant-safe: mapeo `org:*` + backend de memoria Postgres del CRM (procedencia, evidencia, derecho al olvido) — sin SQLite de negocio.
- S7.3 Cola de aprobaciones HITL en la UI (pending/decision/resume) + resultados de ejecuciones con `ExecutionTrace` + panel de salud del cerebro; interruptor IA con `sin_cerebro`.
- S7.4 Laboratorio conectado al adaptador (personas + juez + sandbox `is_test` + olvido).

**Criterios de aceptación.** E2E de despacho con AGENTE-GENERAL real en staging (respuesta, ficha, etapa, handoff, reserva); sin agente → bandeja manual garantizada; sandbox del Laboratorio nunca envía al canal; memoria aislada por tenant verificada por prueba; HITL E2E (acción retenida → aprobación humana → ejecución).

## FASE 8 — Plantillas sectoriales e instalador

**Objetivo.** Onboarding guiado y biblioteca sectorial original.

**Sprints.**
- S8.1 Instalador guiado (patrón CRM-WHATSAPP): identificación del negocio → configuración inicial → conexión del agente → conexión de WhatsApp → verificación de credenciales → prueba de funcionamiento → diagnóstico; soporte VPS/Docker/local (validación de dominio, systemd/usuario no privilegiado, verificación de binarios); sin scripts remotos sin revisión; `doctor` extendido a los satélites.
- S8.2 Biblioteca sectorial **original** (10 sectores: inmobiliarias, reformas, clínicas, restaurantes, comercio, educación, turismo, servicios profesionales, belleza y estética, otros): objetivo, identidad, personalidad, tono, preguntas de calificación, guiones, manejo de objeciones, restricciones, seguimientos, reglas anti-spam, consentimiento, escalamiento humano — como presets multi-tenant con resolver + firma HMAC (patrón MIT de CRM-WHATSAPP, contenido nuevo).
- S8.3 Personas del Laboratorio por sector (los clientes simulados usan el guion del sector) + seed demo por sector.

**Criterios de aceptación.** Instalación limpia en VPS y Docker con doctor en verde y 7 pasos completos; 10 plantillas revisadas legalmente (contenido original) y activables por organización; E2E de onboarding por plantilla.

## FASE 9 — WHATSPOWER y WHATSPOWER-ULTRA (módulos independientes)

**Objetivo.** Motores intercambiables conectados por adaptadores; su caída no afecta el CRM.

**Sprints.**
- S9.1 Adaptador de flujos (inbound firmado, acciones CRM con eco de org, transporte por el CRM, clasificación SENT/REJECTED/UNCERTAIN); parametrización por tenant de reglas/textos; retirar UI embebida.
- S9.2 Editor visual de flujos **dentro de la plataforma** (consume la API JSON del motor; simulador incluido); locks, secuencias y temporizadores visibles en la bandeja.
- S9.3 Adaptador de campañas: colas, ciclo de vida, checks JIT fail-closed, supresión/consentimiento por org; **si ULTRA sigue sin licencia, reconstrucción clean-room desde su FICHA**; importador CSV E.164 multi-país; programación diferida por fecha (capacidad faltante) y reintento selectivo.
- S9.4 Controles de cumplimiento: base legal por contacto, plantillas aprobadas, límites de calidad de cuenta, bajas inmediatas; panel de resultados de campaña.

**Criterios de aceptación.** Con `services/flows` y `services/campaigns` detenidos: bandeja, pipeline, agenda y agente operan (degradación limpia); E2E de flujo conversacional completo; E2E de campaña con consentimiento/supresión verificada; cero envío sin `ALLOW_REAL_DISPATCH`.

## FASE 10 — MCP, Meta CAPI y agendas

**Objetivo.** Superficie de herramientas, atribución y agenda universal.

**Sprints.**
- S10.1 API v1 multi-tenant (25 rutas paridad + nuevas tareas/automatizaciones) con límites por plan; OAuth PKCE; MCP con herramientas autorizadas (sin permiso de envío por defecto; «agent first»).
- S10.2 Meta CAPI + CTWA + UTMs generalizados + deduplicación + tabla de actividad; ventas y eventos disparados desde el movimiento de etapa.
- S10.3 Agenda universal: conectores enlace/Zoom/Google conservados + **Microsoft Outlook** + enlaces personalizados de reserva; anti doble-booking; ofertas obligatorias.

**Criterios de aceptación.** E2E OAuth + MCP desde un cliente externo real; conversión CAPI con acuse y dedup verificados con dataset de prueba; cita creada/reprogramada/cancelada por el agente solo sobre slots ofrecidos; outlook E2E con cuenta de prueba.

## FASE 11 — SaaS, monetización y administración

**Objetivo.** Plataforma comercializable.

**Sprints.**
- S11.1 Dominio Billing: planes, suscripciones, pruebas gratuitas, facturación, límites de consumo (usuarios, conversaciones, IA, canales, agentes, campañas) con `usage_record` y corte degradado claro.
- S11.2 Administración global (super-admin): organizaciones, suspensión/reactivación, métricas por tenant, soporte de acceso auditado; onboarding self-service con cobro.
- S11.3 Reportes descargables por organización (PDF/Excel/CSV) + paneles de consumo; métricas de plataforma para la dirección.

**Criterios de aceptación.** Ciclo E2E: registrar org → plan trial → usar → agotar límite → upgrade → facturar; suspensión bloquea acceso sin perder datos; cada límite verificado por prueba.

## FASE 12 — Pruebas, despliegue y producción

**Objetivo.** Salida a producción controlada.

**Sprints.**
- S12.1 Suite completa: unit (portada de los 141 tests de VOCERO + nuevos), integración, E2E de regresión completa, batería de aislamiento, pruebas de carga de despacho y campañas.
- S12.2 Despliegue: compose de plataforma (app + postgres + agent + flows + campaigns + caddy + minio opcional), manifests PaaS, backups + drill de restauración, migraciones no destructivas con revisión, observabilidad (métricas, trazas, alertas mínimas).
- S12.3 Piloto con 2-3 organizaciones reales; runbooks operativos (incidentes, reconciliación UNCERTAIN, rotación de llaves); documentación de producto (instalación, operación, API, MCP) publicada.

**Criterios de aceptación.** Todas las suites en verde en CI; piloto de 2 semanas sin pérdida de mensajes ni fugas; plan de rollback probado; documentación completa.

---

## Definición de Hecho (global, heredada y ampliada)

Una tarea está Hecha cuando: código en el dominio correcto · typecheck/lint/build/test en verde · prueba E2E o de vigilancia correspondiente · contrato actualizado en `packages/contracts` · auditoría en operaciones sensibles · docs/spec actualizada · sin secretos ni rutas personales en el repo · ninguna marca de referencia en la UI.

## Métricas de progreso por fase

| Fase | Métrica principal |
|---|---|
| F0 | 8/8 documentos aprobados |
| F1 | 6/6 fichas + licencias resueltas |
| F2 | 100 % cobertura de paridad mapeada |
| F3 | Contratos + modelo congelados |
| F4 | Regresión VOCERO verde en monorepo |
| F5 | T1-T15 verdes |
| F6 | Paridad omnicanal E2E |
| F7 | E2E con agente real + HITL |
| F8 | 10 plantillas + instalación limpia |
| F9 | Degradación limpia demostrada |
| F10 | MCP/OAuth/CAPI/agenda E2E |
| F11 | Ciclo de facturación E2E |
| F12 | Piloto en producción |
