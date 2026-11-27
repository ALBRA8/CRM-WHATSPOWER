# SECRETOS — gestión segura de credenciales y variables de entorno (F5)

Regla del proyecto: **ningún secreto real vive en el repositorio, en la
bitácora o en el historial de commits**. Todo secreto viaja por el gestor de
secretos de la plataforma (variables de entorno del despliegue, secret manager
de Coolify/Render/AGENTS, etc.). Este documento es la guía operativa para
generarlos, inyectarlos, rotarlos y auditarlos.

## 1. Inventario de secretos del despliegue

| Secreto | Dónde se usa | Generación | Rotación |
|---|---|---|---|
| `DATABASE_URL` | apps/web (dueño de BD) | contraseña con `openssl rand -hex 24`; usuario dueño `vestro`/`postgres` | baja frecuencia; con ventana de doble usuario |
| `DATABASE_URL_RUNTIME` (opcional, F5) | apps/web (rol runtime) | contraseña de `vestro_runtime` (infra/sql/005) — `openssl rand -hex 24` | baja; solo app |
| `BETTER_AUTH_SECRET` | apps/web (sesiones) | `openssl rand -hex 32` | con logout masivo aceptado |
| `ENCRYPTION_KEY` | apps/web (credenciales por org, AES-256-GCM) | `openssl rand -base64 32` (32 bytes exactos) | **solo con re-cifrado planificado** (0020 secreto zernio cifrado) |
| `META_WEBHOOK_VERIFY_TOKEN` | webhook Meta | `openssl rand -hex 16`; el MISMO se registra en Meta | baja |
| `META_APP_SECRET` | firma de webhook Meta | console de Meta | en Meta |
| `BOT_API_KEY` / secreto del gateway | services/agent-gateway → cerebro | **EL MISMO** valor que `ALBRA_CRM_HMAC_SECRET` del cerebro | ver §3 |
| `ALBRA_CRM_HMAC_SECRET` | AGENTE-GENERAL (`/crm/dispatch`) | `openssl rand -hex 32` | ver §3 |
| `ALBRA_MEMORY_DB` | AGENTE-GENERAL (memoria T9 persistente) | ruta/URL persistente del entorno (no es secreto si es ruta; sí si es URL con credenciales) | n/a |
| `SSE_BACKPLANE` | apps/web (F5) | no es secreto: `off`\|`postgres` | n/a |

## 2. Reglas de inyección

1. **Variables de entorno del runtime**, jamás archivos `.env` dentro del
   repositorio ni en la imagen. `.env` existe SOLO en desarrollo local y está
   fuera del control de versiones (`.gitignore`).
2. Los placeholders de `.env.example` son `REEMPLAZA_*` o valores `dev_only`
   etiquetados como tales — nunca reales.
3. Logs: el CRM y el cerebro no registran cuerpos, firmas ni cabeceras de
   autenticación del puente. Al depurar el puente, hacerlo con datos de
   prueba y sin volcar el cuerpo firmado a la bitácora.
4. `pg_dump`/respaldos contienen DATOS de la base (incluidos los cifrados):
   el destino del respaldo es almacenamiento privado con acceso restringido;
   el `.dump` no se sube nunca a un repo ni a un bucket público.

## 3. Rotación del secreto HMAC del puente (procedimiento)

El puente exige el MISMO secreto en CRM y cerebro. Para rotar sin downtime:

1. Publicar en el cerebro la aceptación del secreto NUEVO manteniendo el
   viejo (ventana de doble secreto) — si la versión del cerebro aún no
   soporta doble secreto, la rotación es con ventana corta de rechazo:
   coordinar el cambio en horario de bajo tráfico.
2. Actualizar el secreto del CRM (gateway) al nuevo.
3. Verificar: despacho real ACK 200; firma manipulada → 401.
4. Retirar el viejo del entorno del cerebro; invalidar en el gestor de
   secretos; registrar la rotación en audit (el propio runtime deja la
   evidencia en su bitácora de plataforma).

## 4. Auditoría de fuga (ejecutada en F5)

- Escaneo del árbol por patrones de secreto (`ghp_`, `sk-`, `AKIA`, PEM,
  `password=`, `Bearer ` en código) y de los placeholders de `.env.example`.
- Verificar con `git log -p | grep -c <patrón>` en el historial cuando el
  sospechoso sea un token con formato conocido. Cualquier hallazgo real →
  **rotar de inmediato** el secreto afectado y registrar el incidente en
  `07_FAILURES/FAILURE_INDEX.md`.
- Los tokens de CI/despliegue (GitHub PAT, etc.) se inyectan SOLO como
  variables de entorno del job; no se escriben en archivos ni en scripts del
  repo.

## 5. Qué NO es un secreto (para no sobre-cifrar)

`APP_BASE_URL`, banderas (`AGENDA`, `ATRIBUCION`, `API_V1`, `CHANNELS`,
`SSE_BACKPLANE`, `MEDIA_STORE`), URLs de mocks de prueba, `AGENT_COALESCE_MS`.
Estas aparecen en `.env.example` documentadas y pueden viajar en el compose.
