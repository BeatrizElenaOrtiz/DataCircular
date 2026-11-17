# GUÍA TÉCNICA Y PREPARACIÓN PARA GOOGLE PLAY STORE (QA-DOC-09)
## DATA_CIRCULAR • Fundación IMARA
**Versión:** 1.0.0  
**Fecha:** 2026-11-06  
**Ecosistema:** Android 14+ (API Level 34) • Expo SDK 58 • React Native 0.88  

---

## 1. RESUMEN DE PREPARACIÓN PARA DESPLIEGUE

Este documento establece la lista de verificación técnica, los parámetros de empaquetado y los requisitos normativos necesarios para la compilación, firma y publicación exitosa de la aplicación móvil **DATA_CIRCULAR** en Google Play Store bajo la titularidad de la **Fundación IMARA**.

---

## 2. CONFIGURACIÓN TÉCNICA DEL MANIFIESTO Y METADATOS

La configuración oficial de la aplicación móvil reside en `apps/mobile/app.json`:

| Parámetro | Valor Configurado | Justificación Técnica |
|---|---|---|
| **`name`** | `DATA_CIRCULAR` | Nombre visible de la aplicación en el launcher de Android. |
| **`slug`** | `data-circular` | Identificador único en el proyecto de Expo Application Services (EAS). |
| **`version`** | `0.1.0` | Versión semántica visible para los usuarios finales. |
| **`package`** | `co.org.imara.datacircular` | Identificador de paquete inverso único exigido por Google Play Console. |
| **`versionCode`** | `1` | Entero incremental obligatorio para el versionamiento binario de Android. |
| **`orientation`** | `portrait` | Bloqueo en modo vertical para interfaces de formularios y logística. |
| **`scheme`** | `datacircular` | Esquema URI para soporte de deep linking y redirecciones de autenticación. |

---

## 3. DECLARACIÓN DE PERMISOS Y POLÍTICA DE PRIVACIDAD

Google Play exige justificación técnica explícita para cada permiso solicitado en el manifiesto de la aplicación:

### 3.1 Declaración de Permisos (`android.permissions`)
```json
"permissions": [
  "android.permission.CAMERA",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES"
]
```

- **`android.permission.CAMERA`:**
  - *Finalidad:* Permitir a los transportadores, generadores y recicladores capturar fotografías en tiempo real de los residuos aprovechables, tickets de báscula de pesaje y actas de entrega para respaldar las evidencias de la orden (Módulo 12).
  - *Declaración en Play Console:* "Funcionalidad de la app / Captura de evidencias de pesaje y carga".
- **`android.permission.READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE`:**
  - *Finalidad:* Permitir al usuario seleccionar imágenes o comprobantes de pesaje previamente guardados en la galería del dispositivo.

### 3.2 Sección de Seguridad de Datos (Data Safety Section)
- **Recolección de Datos:**
  - Información de contacto: Nombre, correo electrónico, teléfono (asociados a la cuenta de usuario y trazabilidad de orden).
  - Fotografías y documentos: Evidencias de materiales cargadas voluntariamente por el usuario.
- **Compartición de Datos:** No se transfieren ni venden datos a redes de publicidad de terceros. Los datos de operaciones son compartidos exclusivamente entre los participantes directos de la transacción y la entidad verificadora ambiental (Fundación IMARA).
- **Cifrado en Tránsito:** La app exige una URL HTTPS en producción. La URL real del backend aún no está configurada, así que la disponibilidad y la versión TLS del servidor deben verificarse antes de publicar.
- **Mecanismo de Eliminación:** Los usuarios pueden solicitar la baja de su cuenta y eliminación de datos personales conforme al artículo 15 de la Constitución Política y Ley 1581 de 2012 de Colombia.

---

## 4. RECURSOS GRÁFICOS Y ADAPTIVE ICONS

La aplicación cuenta con todos los activos gráficos requeridos en `apps/mobile/assets/`:

1. **Icono Principal (`icon.png`):** Resolución estándar 1024x1024 px en formato PNG sin canal alfa en los bordes.
2. **Icono Adaptativo Android (`adaptive-icon.png`):**
   - Primer plano: Isotipo de DATA_CIRCULAR centrado dentro de la zona segura circular (72 dp).
   - Color de fondo: Verde institucional `#1B4332`.
3. **Pantalla de Inicio (`splash.png`):** Imagen de bienvenida con fondo verde `#1B4332` y logotipo centrado.

---

## 5. CONFIGURACIÓN DE CONSTRUCCIÓN EAS (`eas.json`)

Se creó el archivo `apps/mobile/eas.json` para la generación de artefactos nativos:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### Comandos de Compilación para Producción:
```bash
# 1. Iniciar sesión en Expo Application Services
eas login

# 2. Configurar credenciales y firma de Android (Keystore administrado por Expo o IMARA)
eas credentials

# 3. Compilar el Android App Bundle (.aab) para Google Play
eas build --platform android --profile production
```

---

## 6. LISTA DE VERIFICACIÓN PREVIA AL ENVÍO (PRE-LAUNCH CHECKLIST)

- [x] Paquete Android configurado (`co.org.imara.datacircular`).
- [x] Código de versión establecido (`versionCode: 1`).
- [x] Permisos justificados según directrices de Google Play.
- [x] Icono adaptativo y splash screen configurados.
- [x] Configuración de EAS Build preparada.
- [ ] Completar y aprobar legalmente el borrador `/politica-datos` (identificación y contacto del responsable, conservación y demás datos pendientes) antes de usarlo con usuarios reales.
- [ ] URL HTTPS pública y versión aprobada de la política configuradas en el backend.
- [ ] Endpoint de producción desplegado y verificado desde un build Android; TLS y conectividad confirmados.
- [ ] `EXPO_PUBLIC_API_URL` HTTPS configurada en el entorno `production` de EAS.
- [x] 100% de endpoints y suites de prueba validados en backend.
- [ ] Proyecto EAS vinculado y credenciales de firma verificadas.
- [ ] Creación de ficha en Google Play Console (título, descripción breve y detallada, capturas de pantalla de teléfono y tablet de 7"/10").
- [ ] Carga del archivo `.aab` en el Track de Pruebas Internas para validación con usuarios de prueba.
