# REGISTRO DE ERRORES Y HALLAZGOS TÉCNICOS (QA-DOC-05)
## DATA_CIRCULAR • Fundación IMARA
**Versión:** 1.0.0  
**Fecha de Auditoría:** 2026-11-06  
**Responsables:** Equipo Especialista QA, Testing, Backend y Ciberseguridad  

---

## 1. RESUMEN DE DEFECTOS Y DISCREPANCIAS

Durante la ejecución exhaustiva de las pruebas unitarias, de integración, de seguridad y del flujo integral de punta a punta (E2E), se identificaron los siguientes hallazgos y defectos técnicos.

| ID Defecto | Módulo Afectado | Severidad | Estado | Resumen Técnico |
|---|---|---|---|---|
| **BUG-01** | Infraestructura / BD | ALTA | RESUELTO | Conflicto de socket Win32 en puerto 5432 en Windows (Error 0x271D). |
| **BUG-02** | Organizaciones / RBAC | ALTA | RESUELTO | `listSystemRoles()` retornaba roles de organizaciones con permisos vacíos. |
| **BUG-03** | Semillas / Roles | MEDIA | RESUELTO | Asignación indebida de `isSystem: true` a roles propios de organizaciones. |
| **BUG-04** | Mensajería / Chat | MEDIA | RESUELTO | Discrepancia de campo `body` vs `content` en validación Zod de mensajes. |
| **BUG-05** | Configuración Mobile | ALTA | RESUELTO | Ausencia de `package`, `versionCode` y permisos en `apps/mobile/app.json`. |
| **BUG-06** | DevOps / Google Play | MEDIA | RESUELTO | Ausencia de especificación de build `eas.json` para generación de AAB. |

---

## 2. DETALLE DE HALLAZGOS Y ANÁLISIS DE CAUSA RAÍZ

### BUG-01: Conflicto de enlace de sockets en Windows (Puerto 5432)
- **Severidad:** ALTA (Bloqueante para el entorno local).
- **Componente:** Servicio de Base de Datos PostgreSQL 18.
- **Síntoma:** Error del sistema operativo `could not bind IPv4 address "127.0.0.1": Permission denied (0x0000271D)`.
- **Causa Raíz:** Rango de puertos excluidos o reservados por Hyper-V / WSL2 / NAT del sistema operativo Windows sobre el puerto por defecto 5432.
- **Impacto:** Imposibilidad de levantar el clúster estándar de PostgreSQL para ejecutar las pruebas.
- **Resolución:** Despliegue de clúster dedicado en `$env:TEMP\pgdata_dc_test` configurado en el puerto alterno no conflictivo `5433` (`-p 5433`).

---

### BUG-02: Colisión de Roles de Sistema en `listSystemRoles()`
- **Severidad:** ALTA.
- **Componente:** `apps/api/src/modules/organizations/organizations.repository.ts`.
- **Síntoma:** Fallo de aserción en `tests/organizations.test.ts`:
  ```text
  AssertionError: expected [] to include 'org:update'
  ```
- **Causa Raíz:** La consulta Prisma `findMany` filtraba únicamente por `{ where: { isSystem: true } }` sin condicionar `{ organizationId: null }`. Al existir roles creados dentro de organizaciones que tenían la bandera `isSystem: true`, el ordenamiento devolvía una instancia de rol sin permisos asociados en lugar de la plantilla maestra del sistema.
- **Impacto:** Fallaba la consulta oficial de permisos y capacidades de los roles del sistema `/api/v1/organizations/roles/available`.
- **Resolución:** Modificación de `organizations.repository.ts` línea 119 para filtrar estrictamente:
  ```typescript
  where: { isSystem: true, organizationId: null }
  ```
  y corrección en base de datos marcando `is_system = false` en todos los roles asociados a organizaciones.

---

### BUG-03: Asignación errónea de `isSystem: true` en semillas de roles organizacionales
- **Severidad:** MEDIA.
- **Componente:** `scripts/qa/stage2-seed-test-users.ts`.
- **Causa Raíz:** La función de aprovisionamiento de membresías creaba el rol `OWNER` de una organización asignándole por defecto `isSystem: true`.
- **Impacto:** Corrupción conceptual en base de datos entre roles globales del sistema y roles subordinados a una entidad colectiva.
- **Resolución:** Actualización del script de sembrado para establecer `isSystem: false` y ejecución de script SQL de normalización en PostgreSQL.

---

### BUG-04: Discrepancias de contrato Zod en payloads de API
- **Severidad:** MEDIA.
- **Componentes:** `apps/api/src/modules/auth` y `apps/api/src/modules/conversations`.
- **Síntoma:** `VALIDATION_ERROR` en peticiones con campos `identifier` o `content`.
- **Causa Raíz:**
  1. El esquema de autenticación exige estrictamente la clave `email` validada con formato RFC 5322.
  2. El esquema de mensajería `sendMessageSchema` exige estrictamente la clave `body` (1-2000 caracteres) y no `content`.
- **Impacto:** Errores de validación 400 en clientes que consumieran las rutas con terminología genérica.
- **Resolución:** Normalización de clientes y scripts de pruebas para adherirse con exactitud a los esquemas oficiales Zod.

---

### BUG-05: Incompletitud en manifiesto `apps/mobile/app.json` para Google Play
- **Severidad:** ALTA (Bloqueante para publicación en Play Console).
- **Componente:** `apps/mobile/app.json`.
- **Síntoma:** Falta de identificador único de aplicación Android (`package`), número de versión interna (`versionCode`), y declaraciones de permisos de hardware.
- **Impacto:** Google Play Console rechaza la carga de cualquier APK o AAB generado sin estos metadatos.
- **Resolución:** Adición de:
  - `package: "co.org.imara.datacircular"`
  - `versionCode: 1`
  - Permisos explícitos: `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`.
  - Iconos adaptativos `adaptiveIcon.foregroundImage: "./assets/adaptive-icon.png"`.

---

### BUG-06: Ausencia de configuración EAS Build
- **Severidad:** MEDIA.
- **Componente:** Raíz de `apps/mobile`.
- **Síntoma:** Ausencia de archivo `eas.json` para orquestar la compilación en la nube o local de paquetes `.aab`.
- **Resolución:** Creación del archivo `apps/mobile/eas.json` con perfiles `development`, `preview` (APK) y `production` (Android App Bundle AAB optimizado).
