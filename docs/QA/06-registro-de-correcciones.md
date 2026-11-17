# REGISTRO DE CORRECCIONES TÉCNICAS Y CONTROL DE CAMBIOS (QA-DOC-06)
## DATA_CIRCULAR • Fundación IMARA
**Versión:** 1.0.0  
**Fecha:** 2026-11-06  
**Responsables:** Equipo Especialista QA, Backend, Mobile y DevOps  

---

## 1. RESUMEN DE CAMBIOS APLICADOS

En el marco de la campaña integral de calidad, se aplicaron correcciones tanto en el código fuente de backend (`apps/api`), scripts de datos (`scripts/qa`), como en la configuración móvil (`apps/mobile`).

Todas las correcciones fueron sometidas a pruebas de regresión contra la base de datos real en PostgreSQL 18, logrando un resultado del **100% de éxito (166/166 pruebas unitarias e integración aprobadas)**.

---

## 2. DETALLE DE MODIFICACIONES POR ARCHIVO

### 2.1 `apps/api/src/modules/organizations/organizations.repository.ts`
- **Motivo:** Corregir la consulta de roles del sistema para evitar colisión con roles específicos de organizaciones (BUG-02).
- **Líneas afectadas:** 118-125.
- **Cambio aplicado:**
  ```diff
  --- a/apps/api/src/modules/organizations/organizations.repository.ts
  +++ b/apps/api/src/modules/organizations/organizations.repository.ts
  @@ -118,3 +118,3 @@
       await this.ensureSeeded();
       const roles = await prisma.role.findMany({
  -      where: { isSystem: true },
  +      where: { isSystem: true, organizationId: null },
         include: {
  ```
- **Resultado:** La función `listSystemRoles()` ahora retorna únicamente las 4 plantillas maestras globales (`OWNER`, `ADMIN`, `MEMBER`, `OPERATOR`) con sus 12 permisos oficiales mapeados.

---

### 2.2 `scripts/qa/stage2-seed-test-users.ts`
- **Motivo:** Evitar que los roles creados en el contexto de una organización específica se etiqueten como roles globales de sistema (BUG-03).
- **Líneas afectadas:** 628-634.
- **Cambio aplicado:**
  ```diff
  --- a/scripts/qa/stage2-seed-test-users.ts
  +++ b/scripts/qa/stage2-seed-test-users.ts
  @@ -630,3 +630,3 @@
           name: 'OWNER',
           description: 'Propietario de la organización',
  -        isSystem: true,
  +        isSystem: false,
         },
  ```
- **Resultado:** Aislamiento total de roles institucionales y consistencia en el esquema relacional de PostgreSQL.

---

### 2.3 Base de Datos PostgreSQL (`data_circular_dev`)
- **Motivo:** Normalización de datos existentes para roles ya creados vinculados a organizaciones.
- **Instrucción SQL ejecutada:**
  ```sql
  UPDATE roles SET is_system = false WHERE organization_id IS NOT NULL;
  ```
- **Resultado:** 6 registros actualizados (`UPDATE 6`). Cero roles organizacionales conservan la bandera `is_system: true`.

---

### 2.4 `apps/mobile/app.json`
- **Motivo:** Preparación técnica obligatoria para compilación y despliegue en Google Play Store (BUG-05).
- **Líneas afectadas:** 10-28.
- **Cambio aplicado:**
  ```diff
  --- a/apps/mobile/app.json
  +++ b/apps/mobile/app.json
  @@ -10,3 +10,4 @@
       "splash": {
  +      "image": "./assets/splash.png",
         "resizeMode": "contain",
         "backgroundColor": "#1B4332"
       },
       "ios": {
  -      "supportsTablet": true
  +      "supportsTablet": true,
  +      "bundleIdentifier": "co.org.imara.datacircular"
       },
       "android": {
  +      "package": "co.org.imara.datacircular",
  +      "versionCode": 1,
         "adaptiveIcon": {
  +        "foregroundImage": "./assets/adaptive-icon.png",
           "backgroundColor": "#1B4332"
  -      }
  +      },
  +      "permissions": [
  +        "android.permission.CAMERA",
  +        "android.permission.READ_EXTERNAL_STORAGE",
  +        "android.permission.WRITE_EXTERNAL_STORAGE",
  +        "android.permission.READ_MEDIA_IMAGES"
  +      ]
       },
  ```
- **Resultado:** Cumplimiento con los estándares de Google Play Console (paquete calificado, permisos justificados e imagen adaptativa).

---

### 2.5 `apps/mobile/eas.json`
- **Motivo:** Soporte nativo para EAS Build y generación del artefacto final Android App Bundle (.aab) (BUG-06).
- **Archivo creado:** `apps/mobile/eas.json`.
- **Estructura configurada:**
  - Perfil `development`: Depuración con cliente de desarrollo.
  - Perfil `preview`: Generación de `.apk` para distribución interna de pruebas.
  - Perfil `production`: Generación de `.aab` (App Bundle) con optimización de recursos y subida al track interno de Play Console.

---

## 3. PRUEBAS DE REGRESIÓN TRAS LAS CORRECCIONES

Se ejecutó la suite completa de pruebas unitarias y de integración de la API para certificar la no regresión:

```text
 RUN  v2.1.9 C:/Users/Djcool/Desktop/PRACTICAS/DataCircular/apps/api

 ✓ tests/catalog-and-publications.test.ts (20 tests)
 ✓ tests/conversations-and-proposals.test.ts (22 tests)
 ✓ tests/organizations.test.ts (24 tests)
 ✓ tests/operations-flow.test.ts (17 tests)
 ✓ tests/search-and-matches.test.ts (12 tests)
 ✓ tests/evaluations-and-reports.test.ts (11 tests)
 ✓ tests/users-crud.test.ts (13 tests)
 ✓ tests/legal-and-parameters.test.ts (15 tests)
 ✓ tests/auth.test.ts (17 tests)
 ✓ tests/admin-analytics.test.ts (8 tests)
 ✓ tests/user-persistence.test.ts (5 tests)
 ✓ tests/health.test.ts (2 tests)

 Test Files  12 passed (12)
      Tests  166 passed (166)
   Duration  23.84s
```

**Conclusión:** 100% de las suites de prueba de backend aprobadas sin regresiones.
