# RIESGOS_TECNICOS.md

**Proyecto:** Construcción del nuevo CRM SaaS multi-tenant
**Fase:** 1-3 — Registro de riesgos derivado de la auditoría
**Fecha:** 2026-11-27
**Método:** cada riesgo con evidencia verificada en los repositorios, probabilidad (P) e impacto (I) en escala 1-5, nivel = P×I, mitigación concreta y fase propietaria del roadmap. Registro vivo: se revisa en el gate de cada fase.

## 1. Matriz de valoración

| Nivel (P×I) | Tratamiento |
|---|---|
| 15-25 | **Crítico** — bloquea la fase asociada; decisión de dirección |
| 8-14 | **Alto** — mitigación obligatoria dentro de la fase; seguimiento semanal |
| 4-7 | **Medio** — mitigación programada; seguimiento por fase |
| 1-3 | **Bajo** — aceptado y monitorizado |

## 2. Registro de riesgos

### 2.1 Legal y licencias

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| L1 | Reutilizar código de `CRM-ALBRA` sin licencia (todos los derechos reservados) | Sin LICENSE ni campo `license`; landing «Todos los derechos reservados» | 3 | 5 | **15** | Tratarlo como especificación de solo lectura; obtener LICENSE/autorización escrita del titular; si no llega, clean-room | F1 (acción legal), todas |
| L2 | Ídem para `WHATSPOWER-ULTRA` | Sin LICENSE; `private: true` | 3 | 5 | **15** | Ídem; el motor de campañas F9 tiene plan clean-room desde su FICHA | F1, F9 |
| L3 | Contaminación GPL-3.0 por Baileys/libsignal en el producto comercial | Daemons Baileys en CRM-ALBRA y dashboard de AGENTE-GENERAL; CRM-WHATSAPP lo confina por GPL | 2 | 5 | 10 | Solo APIs oficiales en el producto; transporte no oficial excluido de distribución y de dependencias; gate de licencias en CI | F1, F4, F6, F9 |
| L4 | Secretos comprometidos en historial git (PAT compartido, purga pendiente) | `CRM-ALBRA/OWNER_TODO.md` (82 entradas ROTACION-PENDIENTE), scripts E2E con credenciales | 2 | 4 | 8 | No clonar historiales de repos afectados; rotación de credenciales por el titular; escáner de secretos en CI propio | F1, F4 |
| L5 | Marcas de referencia visibles en la UI | Mandato §17; marcas presentes en los repos de origen | 2 | 3 | 6 | Identidad propia (WhatsPower); revisión visual por fase; avisos MIT/OFL solo en notices | F4, F6 |
| L6 | Dependencia con licencia copyleft/propia entra a producción sin revisión | Lockfiles grandes no verificados formalmente aún | 2 | 4 | 8 | Verificación desde lockfile + generación de `THIRD_PARTY_NOTICES` + gate de CI con lista de licencias permitidas | F4 |
| L7 | Campañas sin base legal de contacto (consentimiento/anti-spam) | El ecosistema ya modela Ley 1581; el mandato exige consentimiento | 2 | 5 | 10 | Consentimiento obligatorio por contacto, supresión por org, plantillas aprobadas, bajas inmediatas; auditoría de campañas | F9, F11 |

### 2.2 Datos y tenancy

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| D1 | Fuga de datos entre tenants | Mandato §7 (prohibido); aislamiento parcial hoy (org_id sin RLS en VOCERO) | 2 | 5 | 10 | RLS + FORCE + doble valla `scoped()` + batería T1-T15 en CI (`MODELO_MULTI_TENANT.md`) | F5 |
| D2 | AGENTE-GENERAL sin multi-tenancy real (memoria sin org_id, SQLite local) | `MemoryIsolator` por 4-tupla sin org; SQLite stores | 4 | 4 | **16** | Mapeo `org:*` + backend de memoria Postgres del CRM (extensión prevista por su `docs/MEMORY.md` §11); prohibido SQLite de negocio en producción | F7 |
| D3 | Motores de flujos/campañas en SQLite no aptos para multi-nodo | `node:sqlite` en WP/ULTRA; limitación reconocida en AUDIT_REPORT de ULTRA | 3 | 3 | 9 | Mantener servicios mono-instancia con volumen por org; migrar cola de campañas a Postgres si se multi-instancia (ADR-N2); worker round-robin por org | F9 |
| D4 | Migración destructiva sin backup | Mandato §12 (prohibido); VOCERO sin backup/drill en repo | 2 | 5 | 10 | Política: backup + revisión + prueba en staging antes de toda migración destructiva; drill de restauración por fase | F4, F12 |
| D5 | Derecho al olvido incompleto (conversación borrada pero memoria del agente residual) | VOCERO borra conversación + «lo que el agente aprendió»; el agente guarda memoria propia | 3 | 3 | 9 | Evento de borrado → `memory.forget` del agente por contrato; verificación E2E de olvido (patrón ya probado: `conversation.deleted` del Laboratorio) | F6, F7 |
| D6 | Importador CSV solo canóniza Colombia | `canonicalizePhone` de ULTRA (10 dígitos que empiezan por 3) | 3 | 2 | 6 | Reemplazar por validación E.164 multi-país en el adaptador propio | F9 |

### 2.3 Arquitectura y escalabilidad

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| A1 | SSE y rate-limits in-process no escalan a múltiples réplicas | Constitución VOCERO (sin Redis, una máquina en Fly/Railway) | 4 | 3 | **12** | Backplane de eventos + almacén de límites compartido (Postgres LISTEN/NOTIFY como base; Redis opcional) — ADR-N1 en F5 | F5 |
| A2 | MCP y handoff de AGENTE-GENERAL solo in-process | `mcp/server.py` (transporte en memoria); `handoff/manager.py` | 3 | 3 | 9 | El CRM expone su propio MCP HTTP ya probado (VOCERO); la integración con el agente va por REST/A2A (HTTPTransport sí existe); no depender del MCP in-process del agente | F7, F10 |
| A3 | Scheduler y jobs del agente no persistentes | Docstring del scheduler («persistent scheduling… specialization layers»); SQLiteJobQueue local | 3 | 3 | 9 | Los seguimientos/automatizaciones del negocio viven en el CRM (outbox durable) o en workflows con store durable del agente; jamás en memoria | F7, F9 |
| A4 | Refactor de módulos grandes rompe comportamiento (regresión) | `inbox/send.ts` 967 líneas, `composer.tsx`/`message-thread.tsx` 891, `schema.ts` 1674 | 3 | 3 | 9 | Modularización solo por extracción con tests de vigía; los guiones E2E de VOCERO como red; Prohibido «arreglar de paso» | F4, F6 |
| A5 | Checkout local de VOCERO con rutas corruptas | `src/app/api/bot/media/ediaId]/` etc. (artefacto de sync, no upstream) | 4 | 1 | 4 | Al crear el monorepo, partir del árbol git correcto (verificado en HEAD), no del checkout local | F4 |
| A6 | Percepción de «anti-ban» como evasión de restricciones de plataforma | ULTRA: jitter, spintax, fatiga | 2 | 4 | 8 | Marco explícito: control de ritmo = calidad operativa; nunca evadir políticas; cumplimiento con plantillas/consentimiento/bajas; revisión legal por mercado | F9, F11 |

### 2.4 Integración con AGENTE-GENERAL

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| I1 | El motor no está verificado en producción (`PRODUCTION NOT VERIFIED`, sin lockfile) | `docs/CERTIFICATION.md`; CI 648 passed | 3 | 4 | **12** | Staging obligatorio con batería de aceptación del propio repo (`ACCEPTANCE_TEST_BATTERY.md`) + piloto controlado antes de activar por defecto; lockfile propio del despliegue | F7, F12 |
| I2 | ASR no operativo (notas de voz del agente) | `docs/ASR_LIMITATION.md` (proveedor NVIDIA bloqueado) | 3 | 2 | 6 | El CRM mantiene su pipeline de audio propio (transcripción de notas de voz ya existente en el ecosistema); el agente consume texto por contrato; conmutación de proveedor configurable | F6, F7 |
| I3 | Doble respuesta (CRM, agente y flujos contestan a la vez) | Precedente documentado: `GUIA_ACTIVACION_CONTROLADA.md` del ecosistema (fallback 3.5 s) | 3 | 4 | **12** | Autoridad única de despacho por conversación (outbox con único despacho vivo — índice parcial ya existente); locks de flujos; interruptor por organización; E2E de no-duplicación | F7, F9 |
| I4 | Codificación de errores heterogénea entre módulos | VOCERO (409 tipados), WP/ULTRA (SENT/REJECTED/UNCERTAIN), agente (verdicts) | 3 | 2 | 6 | Catálogo único tipado (`CONTRATOS_INTEGRACION.md` §7) con conservación de códigos existentes; pruebas de contrato por módulo | F4, F7 |
| I5 | Conocimiento empresarial acoplado al agente (antipatrón prohibido) | Mandato §4 | 2 | 4 | 8 | KB vive en el CRM (org-scoped) y se consume por contrato; cualquier agente compatible la usa; la especialización es configuración, no motor | F6, F7 |
| I6 | Dependencia externa Zernio para TikTok | `tiktok_credentials.source = "zernio"`; única vía verificada | 3 | 3 | 9 | Adaptador de canal con contrato propio; monitoreo de salud; plan B con API oficial de TikTok cuando esté disponible; degradación documentada | F6 |

### 2.5 Canales y plataformas externas

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| C1 | Restricciones de TikTok (48 h, no iniciar, tope 10 mensajes/48 h, cuentas Business fuera de UE/Suiza/UK) | `capabilities.ts`, spec 022 | 4 | 2 | 8 | Capacidades por canal ya modeladas; `message_limit` 409 sin reintento; UI informa límites al operador | F6 |
| C2 | Baneo/calidad de WABA por uso incorrecto de campañas | Mandato §10; políticas de Meta | 3 | 4 | **12** | Plantillas aprobadas, pacing, consentimiento, supresión, bajas; monitoreo de calidad de cuenta; sin evasión de políticas | F9 |
| C3 | Ventana social de IG/Messenger (solo humano fuera de 24 h) | `windowMsFor`, etiqueta HUMAN_AGENT | 3 | 2 | 6 | Regla conservada de VOCERO (bloqueo correcto de la IA); UI clara | F6 |
| C4 | Complejidad del Embedded Signup (FedCM, permisos, split de cuentas 2026) | `embedded.ts` v4, `docs/embedded-signup.md` con troubleshooting | 3 | 2 | 6 | Reutilizar el flujo probado y su guía; wizard propio del instalador F8 con verificación de credenciales | F6, F8 |
| C5 | Pérdida de mensajes por fallos de webhook | Mitigado en origen: persistir antes del ACK + reintentos (spec 047) | 1 | 5 | 5 | Conservar el patrón sin excepción para todos los canales nuevos (incluido Telegram) + alerta de cola retrasada | F6 |

### 2.6 Operación

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| O1 | Sin backups ni drill en la base funcional de VOCERO | Repo sin scripts de backup (existían en CRM-ALBRA como práctica) | 3 | 5 | **15** | Backups nightly + drill de restauración desde F4 (hereda la práctica de CRM-ALBRA); política de migraciones D4 | F4, F12 |
| O2 | Observabilidad insuficiente para SaaS multi-tenant | Métricas por tenant nuevas; tracing disperso | 3 | 3 | 9 | Métricas por org, trazas correlacionadas (`X-Request-Id` ↔ `ExecutionTrace`), alertas mínimas (cerebro caído, cola de webhooks, worker detenido, cuota) | F5, F12 |
| O3 | Manifests PaaS desactualizados (`railway.toml` obsoleto; Fly Postgres no gestionado) | `railway.toml` (obsolescencia declarada hasta 2026-12-01) | 3 | 2 | 6 | Blueprint propio (render.yaml nuevo) + compose como camino primario; revisar PaaS en F12 | F12 |
| O4 | Dependencias Python no reproducibles (sin lockfile) | `AGENTE-GENERAL` sin lock | 4 | 2 | 8 | Generar lock (`uv`/`pip-tools`) en el despliegue de la plataforma; CI con versiones fijadas | F7 |
| O5 | Pilotos sin tráfico real previo (ULTRA con `SENT=0` en pilotos documentados; agente no verificado) | `CONTEXT.md` de ULTRA; `CERTIFICATION.md` del agente | 3 | 3 | 9 | Piloto F12 con organizaciones reales y criterios de éxito definidos antes de abrir registros | F12 |

### 2.7 Seguridad

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| S1 | Patrones de credenciales en texto plano del ecosistema | CRM-WHATSAPP (claves planas) — patrón a NO replicar | 2 | 4 | 8 | Regla fija: todo secreto cifrado AES-256-GCM + hash lookup timing-safe (patrón probado); doctor valida ausencia de planos | F4-F7 |
| S2 | Regla de firewall permisiva en demo del agente (`*`→allow) | `render_app.py` (líneas 85-93) | 3 | 3 | 9 | El despliegue de producción usa config estricta default-deny (policy+RBAC por ruta); verificación en staging de que no se usa `render_app.py` demo | F7 |
| S3 | Autenticación débil en satélites si se exponen | WP/ULTRA con claves por env (`INTERNAL_API_KEYS`) | 2 | 4 | 8 | Satélites solo en red interna del compose; mTLS/HMAC por org; jamás expuestos al borde (Caddy solo núcleo) | F9 |
| S4 | Super-admin mal usado (acceso global sin trazabilidad) | Patrón switch-organization | 2 | 4 | 8 | Rol de BD propio + motivo obligatorio + auditoría por acceso; sin acceso con rol de migraciones | F5 |

### 2.8 Producto

| ID | Riesgo | Evidencia | P | I | Nivel | Mitigación | Fase |
|---|---|---|---|---|---|---|---|
| P1 | Botones sin funcionamiento o integraciones simuladas presentadas como reales | Mandato §18 (prohibido); riesgo de heredar mocks | 2 | 4 | 8 | Gate de revisión de UI por fase (todo control ejecuta acción real); `dev-guard` 404 en producción para mocks; fallbacks honestos (`AI_UNAVAILABLE_FALLBACK` como patrón) | Todas |
| P2 | Corte incorrecto por límites de plan (bloquea clientes legítimos) | Billing nuevo sin precedentes propios | 3 | 3 | 9 | Degradación degradada («solo humano», avisos, `ai_paused`) jamás pérdida de datos; pruebas de límites E2E; periodo de gracia configurable | F11 |
| P3 | UI en español solo (sin i18n) | Constitución VOCERO; mandato no exige multi-idioma aún | 2 | 2 | 4 | i18n como ADR post-F12; contenido de negocio ya separado de etiquetas | Post-F12 |
| P4 | Escala de la batería de regresión (59 guiones E2E + arneses) requiere mantenimiento doble | VOCERO 60 arneses | 3 | 2 | 6 | Portar por prioridad con orquestador único (`e2e-selftest`) y mocks (`wa-mock`, `ai-mock`) reutilizados; CI con gates por fase | F4-F12 |

## 3. Top 10 riesgos críticos y altos (orden por nivel)

| # | ID | Riesgo | Nivel | Decisión clave |
|---|---|---|---|---|
| 1 | D2 | Memoria del agente sin tenant (SQLite, sin org) | 16 | **CERRADO lado cerebro en S4.4** (D-023: dimensión `org_id` fail-closed + cubeta legacy + pruebas negativas 15/15 y por HTTP; suite del cerebro 821/821). La actividad de negocio del CRM sigue en Postgres del CRM con RLS (D-014); para producción falta solo despliegue operativo (F5) |
| 2 | L1 | CRM-ALBRA sin licencia | 15 | Especificación de solo lectura; acción legal en F0/F1 |
| 3 | L2 | ULTRA sin licencia | 15 | Ídem; plan clean-room para F9 |
| 4 | O1 | Sin backups/drill | 15 | Backups + drill desde F4 (no llega a F12) |
| 5 | A1 | SSE/rate-limit in-process vs multi-replica | 12 | Backplane + límites compartidos en F5 (ADR-N1) |
| 6 | I1 | Agente no verificado en producción | 12 | Staging + batería de aceptación + piloto controlado |
| 7 | I3 | Doble respuesta CRM/agente/flujos | 12 | Autoridad única de despacho + locks + E2E de no-duplicación |
| 8 | C2 | Calidad/baneo de WABA por campañas | 12 | Cumplimiento estricto en el motor de campañas |
| 9 | D1 | Fuga cross-tenant | 10 | RLS + batería T1-T15 en CI |
| 10 | D4 | Migraciones destructivas | 10 | Política backup+revisión+prueba |
| 11 | L3 | GPL por Baileys | 10 | Solo APIs oficiales; exclusión de distribución |
| 12 | L7 | Campañas sin base legal | 10 | Consentimiento/supresión/bajas obligatorios |

## 4. Seguimiento

1. Este registro se actualiza en el gate de cada fase: los riesgos de la fase entrante pasan a «activo con mitigación en curso»; los de la fase saliente se cierran con evidencia.
2. Cualquier riesgo nuevo detectado en construcción se añade con ID secuencial (categoría-prefijo + número) y dueño.
3. Los riesgos críticos (nivel ≥ 15) requieren decisión de dirección documentada (minuta en `docs/decisiones/`) antes de cerrar su fase.
4. Los riesgos que se materializan en incidentes de piloto (F12) se analizan con el runbook de incidentes y alimentan la matriz final.

### Registro S4.4 (2026-11-27)

| ID | Cambio de estado | Evidencia |
|---|---|---|
| D2 | **CERRADO lado cerebro** (bloqueador T9): memoria de AGENTE-GENERAL con dimensión de organización fail-closed, compatible con memoria preexistente (migración aditiva probada) | `AGENTE-GENERAL/tests/unit/test_memory_org_isolation.py` 15/15; integración HTTP org A/org B; suite cerebro 821/821; `cerebro-real.test.ts` 9/9 (`memory_store: configured`) |
| R-AG-1 | **CERRADO** (bloqueador): `/crm/dispatch` implantado en el cerebro (D-022) con HMAC ±300 s, eco de org, RBAC, firewall, HITL 202, envelope D-013, idempotencia y rate limit por org | `AGENTE-GENERAL/tests/integration/test_crm_dispatch.py` 25/25; `cerebro-real.test.ts` 9/9 contra uvicorn real (despacho 200 `{accepted, event_id, approvalRequired:false}`) |
| S2 | Sigue VIGENTE para staging/producción: `render_app.py` demo trae firewall allow-all `*`; el despliegue real exige reglas default-deny explícitas + autenticador real + `ALBRA_CRM_HMAC_SECRET` fuerte + `ALBRA_MEMORY_DB` persistente | `AGENTE-GENERAL/render_app.py`; `ENTREGA_S4_4.md` §7 |
| Limitación de entorno | E2E 036 completa requiere ≥8 GB RAM (mandato); el sandbox tiene 3,9 GB → corrida continua hasta **269/302 checks (0 FAIL)**, parada reproducible al inicio de R11, igual que S4.3; 4 configuraciones probadas; nada simulado | `ENTREGA_S4_4.md` §5; `SESSION_2026-11-27_S4.4_CIERRE_BLOQUEOS_AGENTE.md` §3 |
