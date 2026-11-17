# MATRIZ MAESTRA DE CASOS DE PRUEBA (QA-DOC-04)
## DATA_CIRCULAR • Fundación IMARA
**Versión:** 1.0.0  
**Cobertura:** 15 Módulos Funcionales (5.1 al 5.15)  
**Total Casos Definidos:** 65 Casos de Prueba  
**Fecha:** 2026-11-06  

---

## 1. CONVENCIONES Y CLASIFICACIÓN DE PRUEBAS

- **Tipo:**  
  - `[POS]` Caso Positivo (flujo estándar)  
  - `[NEG]` Caso Negativo (manejo de errores y rechazos)  
  - `[LIM]` Caso Límite / Borde (valores extremos)  
  - `[SEC]` Prueba de Seguridad / Control de Acceso (RBAC / OWASP)  
- **Prioridad:**  
  - `P1` Crítica (bloqueante para operación circular)  
  - `P2` Alta (afecta experiencia o integridad parcial)  
  - `P3` Media (validaciones secundarias)  

---

## 2. MATRIZ DETALLADA POR MÓDULO

### 2.1 Módulo 1: Registro de Usuarios (TC-REG)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-REG-01` | POS | P1 | Nuevo Generador | Sin sesión activa | Enviar payload de registro con datos válidos y aceptación de política. | Correo único, contraseña robusta (>8 carácteres, mayúscula, minúscula, dígito), municipio Colombia. | HTTP 201 Created. Usuario registrado en PostgreSQL con hash Argon2id y registro de política aceptada. |
| `TC-REG-02` | NEG | P1 | Aspirante | Correo existente | Intentar registrarse con correo ya utilizado por `GeneradorPrueba1`. | `email: "generador1.prueba@datacircular.local"` | HTTP 409 Conflict. Mensaje descriptivo `"El correo electrónico ya se encuentra registrado"`. |
| `TC-REG-03` | NEG | P1 | Aspirante | Username existente | Intentar registrarse con nombre de usuario duplicado. | `username: "GeneradorPrueba1"` | HTTP 409 Conflict. Mensaje claro sin exponer trazas de base de datos. |
| `TC-REG-04` | NEG | P2 | Aspirante | Ninguna | Enviar contraseña débil (menos de 8 caracteres o solo letras). | `password: "12345"` | HTTP 400 Bad Request. Validación Zod reporta incumplimiento de complejidad de contraseña. |
| `TC-REG-05` | NEG | P2 | Aspirante | Ninguna | Enviar registro sin aceptar política de datos Ley 1581. | `acceptsTerms: false` | HTTP 400 Bad Request. El sistema rechaza el registro sin aceptación explícita de política de datos. |

---

### 2.2 Módulo 2: Autenticación y Sesiones (TC-AUTH)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-AUTH-01` | POS | P1 | GeneradorPrueba1 | Usuario ACTIVO en BD | Iniciar sesión con identificador (correo o username) y contraseña correcta. | Credencial válida de testing | HTTP 200 OK. Retorna JWT Bearer firmado y objeto con rol/perfil. |
| `TC-AUTH-02` | NEG | P1 | Cualquiera | Usuario existe | Intentar login con contraseña errónea. | Contraseña incorrecta | HTTP 401 Unauthorized. Mensaje genérico de credenciales inválidas para prevenir enumeración. |
| `TC-AUTH-03` | NEG | P1 | Cualquiera | Sin token | Intentar consumir endpoint protegido `/api/offers` sin header Authorization. | Header vacío | HTTP 401 Unauthorized. Acceso denegado. |
| `TC-AUTH-04` | NEG | P2 | Cualquiera | Token alterado | Consumir endpoint protegido con JWT con firma HMAC alterada. | Token manipulado | HTTP 401 Unauthorized. Token inválido o corrupto. |
| `TC-AUTH-05` | POS | P2 | RecicladorPrueba1 | Sesión activa | Invocar endpoint de cierre de sesión (`/api/auth/logout`). | Header Bearer válido | HTTP 200 OK. Sesión invalidada o confirmación de logout. |

---

### 2.3 Módulo 3: Perfiles y Permisos RBAC (TC-RBAC)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-RBAC-01` | SEC | P1 | GeneradorPrueba1 (USER) | Token emitido | Intentar acceder a endpoint administrativo `/api/admin/analytics/summary`. | Header Bearer de usuario USER | HTTP 403 Forbidden. Acceso restringido exclusivamente a administradores (`ADMIN`). |
| `TC-RBAC-02` | POS | P1 | VerificadorPrueba1 (ADMIN) | Token emitido | Acceder a endpoint `/api/admin/analytics/summary`. | Header Bearer de ADMIN | HTTP 200 OK. Retorna métricas globales del sistema. |
| `TC-RBAC-03` | SEC | P2 | RecicladorPrueba1 | Token emitido | Intentar editar el perfil de `GeneradorPrueba1` (IDOR / BOLA). | `userId` de otro usuario | HTTP 403 Forbidden o 404 Not Found. Aislamiento estricto de recursos. |
| `TC-RBAC-04` | POS | P2 | TransformadorPrueba1 | Token emitido | Consultar propio perfil autenticado `/api/users/me`. | Header Bearer propio | HTTP 200 OK. Retorna exclusivamente datos de `TransformadorPrueba1`. |

---

### 2.4 Módulo 4: Organizaciones (TC-ORG)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-ORG-01` | POS | P1 | RecicladorPrueba1 | Usuario registrado | Crear organización con NIT, razón social y municipio Fontibón. | NIT 901.888.777-1 | HTTP 201 Created. Organización persistida con estado ACTIVA. |
| `TC-ORG-02` | POS | P1 | RecicladorPrueba1 | Org creada | Asignar categorías de interés para coincidencia (`PET`, `Cartón`). | IDs de categorías oficiales | HTTP 200 OK. Categorías vinculadas en `organization_material_categories`. |
| `TC-ORG-03` | NEG | P2 | Cualquiera | Ninguna | Crear organización con NIT duplicado. | NIT existente | HTTP 409 Conflict. Control de unicidad de NIT en base de datos. |

---

### 2.5 Módulo 5: Catálogo de Materiales (TC-CAT)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-CAT-01` | POS | P1 | Público / Usuario | Catálogo migrado | Consultar árbol jerárquico de categorías de materiales `/api/catalog/categories`. | GET sin filtros | HTTP 200 OK. Lista no vacía, estructurada con subcategorías y unidades de medida. |
| `TC-CAT-02` | POS | P2 | Cualquiera | Catálogo migrado | Buscar material por término de búsqueda (`"PET"`). | `?search=PET` | HTTP 200 OK. Retorna coincidencias exactas y parciales de categoría plásticos. |
| `TC-CAT-03` | POS | P2 | Cualquiera | Catálogo migrado | Consultar listado de municipios normalizado de Colombia. | `COLOMBIA_MUNICIPALITIES` | 100% de departamentos y municipios disponibles en orden alfabético más opción "Otro". |

---

### 2.6 Módulo 6: Publicaciones de Materiales (TC-PUB)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-PUB-01` | POS | P1 | GeneradorPrueba1 | Org vinculada | Crear Oferta 1: 450 kg de PET en Fontibón. | Categoría PET, 450 kg, Fontibón | HTTP 201 Created. Oferta persistida con estado `ACTIVE`. |
| `TC-PUB-02` | POS | P1 | GeneradorPrueba1 | Org vinculada | Crear Oferta 2: 600 kg de Cartón en Fontibón. | Categoría Cartón, 600 kg, Fontibón | HTTP 201 Created. Oferta persistida con estado `ACTIVE`. |
| `TC-PUB-03` | POS | P1 | GeneradorPrueba2 | Org vinculada | Crear Oferta 3: 300 kg de Aluminio en Kennedy. | Categoría Aluminio, 300 kg, Kennedy | HTTP 201 Created. Oferta persistida con estado `ACTIVE`. |
| `TC-PUB-04` | NEG | P2 | RecicladorPrueba1 | Perfil RECYCLER | Intentar publicar una `OFFER` (restringido a GENERATOR por regla de negocio). | Payload de Oferta | HTTP 403 Forbidden. Solo los generadores pueden publicar ofertas directas de residuo. |
| `TC-PUB-05` | NEG | P2 | GeneradorPrueba1 | Ninguna | Crear oferta con cantidad negativa o cero (`quantity: -50`). | Cantidad negativa | HTTP 400 Bad Request. Validación Zod rechaza cantidades menores o iguales a cero. |
| `TC-PUB-06` | POS | P2 | GeneradorPrueba1 | Oferta activa | Pausar oferta temporalmente (`status: PAUSED`). | PATCH `/api/offers/:id/status` | HTTP 200 OK. Oferta deja de sugerirse en el motor de coincidencias. |

---

### 2.7 Módulo 7: Motor de Coincidencias / Matching (TC-MAT)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-MAT-01` | POS | P1 | RecicladorPrueba1 | Org con PET configurado | Consultar sugerencias de materiales compatibles `/api/matches/suggestions`. | Token de RecicladorPrueba1 | HTTP 200 OK. Incluye la Oferta 1 (PET 450 kg) y Oferta 2 (Cartón 600 kg) de `GeneradorPrueba1`. |
| `TC-MAT-02` | POS | P1 | TransformadorPrueba2 | Org con Metales configurado | Consultar sugerencias de materiales compatibles. | Token de TransformadorPrueba2 | HTTP 200 OK. Sugiere la Oferta 3 (Aluminio 300 kg) de `GeneradorPrueba2`. |
| `TC-MAT-03` | POS | P2 | RecicladorPrueba1 | Sin categoría Vidrio | Verificar que ofertas de Vidrio (si existiesen) no se muestren a RecicladorPrueba1. | Filtro de coincidencia | Las sugerencias se restringen exactamente a las categorías habilitadas por la organización. |

---

### 2.8 Módulo 8: Conversaciones y Mensajería (TC-CHAT)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-CHAT-01` | POS | P1 | RecicladorPrueba1 | Oferta 1 activa | Iniciar conversación vinculada a la Oferta 1 con `GeneradorPrueba1`. | `offerId: Oferta1` | HTTP 201 Created. Conversación creada con ambos participantes asociados. |
| `TC-CHAT-02` | POS | P1 | RecicladorPrueba1 | Conversación creada | Enviar mensaje: `"Hola, estamos interesados en los 450 kg de PET"`. | Texto de mensaje válido | HTTP 201 Created. Mensaje almacenado en PostgreSQL con timestamp exacto. |
| `TC-CHAT-03` | POS | P1 | GeneradorPrueba1 | Mensaje recibido | Consultar conversación y responder: `"Perfecto, material disponible para despacho inmediato"`. | Respuesta en el canal | HTTP 201 Created. Mensaje entregado y visible para ambos participantes. |
| `TC-CHAT-04` | SEC | P1 | TransformadorPrueba2 | No participante | Intentar leer mensajes de la conversación entre Generador1 y Reciclador1. | ID de conversación ajena | HTTP 403 Forbidden. Aislamiento total de mensajería privada. |

---

### 2.9 Módulo 9: Negociaciones y Propuestas (TC-NEG)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-NEG-01` | POS | P1 | RecicladorPrueba1 | Conversación activa | Enviar propuesta comercial formal: $1.200 COP/kg por los 450 kg de PET. | Precio, condiciones de retiro | HTTP 201 Created. Propuesta con estado `PENDING`. |
| `TC-NEG-02` | POS | P1 | GeneradorPrueba1 | Propuesta recibida | Realizar contrapropuesta formal: $1.350 COP/kg. | Monto contrapropuesta | HTTP 200 OK. Estado actualizado a `COUNTER_OFFERED`. |
| `TC-NEG-03` | POS | P1 | RecicladorPrueba1 | Contrapropuesta | Aceptar las condiciones de la contrapropuesta ($1.350 COP/kg). | Acción: Aceptar | HTTP 200 OK. Propuesta pasa a estado `ACCEPTED`. |
| `TC-NEG-04` | NEG | P2 | GeneradorPrueba1 | Propuesta aceptada | Intentar modificar el precio una vez la propuesta ya fue aceptada. | Cambio de precio | HTTP 400 Bad Request. Inmutabilidad de propuestas en estado terminal. |

---

### 2.10 Módulo 10: Operaciones y Órdenes (TC-OP)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-OP-01` | POS | P1 | Sistema / Generador1 | Propuesta `ACCEPTED` | Generar orden operativa formal de recolección y aprovechamiento. | Derivada de propuesta | HTTP 201 Created. Orden operativa creada con código único y estado `PENDING`. |
| `TC-OP-02` | POS | P1 | GeneradorPrueba1 | Orden creada | Iniciar ejecución operativa de la orden. | PATCH `/api/orders/:id/status` | HTTP 200 OK. Orden transiciona a estado `IN_PROGRESS`. |
| `TC-OP-03` | POS | P1 | RecicladorPrueba1 | Material recibido en bodega | Confirmar recepción conforme del material aprovechable. | Check de recepción | HTTP 200 OK. Orden transiciona a estado `DELIVERED` / `COMPLETED`. |

---

### 2.11 Módulo 11: Logística y Transporte (TC-LOG)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-LOG-01` | POS | P1 | Reciclador / Generador | Orden `IN_PROGRESS` | Asignar transportador especializado (`TransportadorPrueba1`). | ID TransportadorPrueba1 | HTTP 200 OK. Transportador vinculado a la orden logística. |
| `TC-LOG-02` | POS | P1 | TransportadorPrueba1 | Asignado | Programar ventana horaria de recolección en Fontibón. | Fecha y franja horaria | HTTP 200 OK. Cronograma logístico guardado y notificado. |
| `TC-LOG-03` | POS | P1 | TransportadorPrueba1 | Recolección física | Confirmar recolección de carga y salida hacia centro de acopio. | Check de despacho | HTTP 200 OK. Estado logístico `IN_TRANSIT`. |

---

### 2.12 Módulo 12: Evidencias y Trazabilidad (TC-EVI)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-EVI-01` | POS | P1 | Transportador / Reciclador | Orden activa | Adjuntar ticket de báscula de pesaje oficial (452 kg neto). | Tipo: `SCALE_TICKET`, peso: 452.0 kg | HTTP 201 Created. Evidencia vinculada a la orden con metadatos completos. |
| `TC-EVI-02` | POS | P1 | RecicladorPrueba1 | Entrega física | Registrar fotografía de material conforme recibido en bodega. | Tipo: `PHOTO_EVIDENCE`, URL válida | HTTP 201 Created. Evidencia persistida y trazable en el expediente de la orden. |
| `TC-EVI-03` | NEG | P2 | Cualquiera | Orden cerrada | Intentar eliminar o sobreescribir evidencia registrada en orden completada. | DELETE `/api/evidences/:id` | HTTP 403 Forbidden. Las evidencias son inmutables para garantizar validez auditora ambiental. |

---

### 2.13 Módulo 13: Evaluaciones y Calificaciones (TC-REV)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-REV-01` | POS | P1 | GeneradorPrueba1 | Orden `COMPLETED` | Calificar al RecicladorPrueba1 con 5 estrellas y comentario positivo. | 5 estrellas, `"Excelente cumplimiento y puntualidad"` | HTTP 201 Created. Evaluación registrada y promedio de reputación actualizado. |
| `TC-REV-02` | POS | P1 | RecicladorPrueba1 | Orden `COMPLETED` | Calificar al GeneradorPrueba1 con 5 estrellas. | 5 estrellas, `"Material limpio y bien clasificado"` | HTTP 201 Created. Evaluación bilateral completada. |
| `TC-REV-03` | NEG | P2 | RecicladorPrueba1 | Ya calificó | Intentar enviar una segunda calificación sobre la misma orden. | Payload repetido | HTTP 409 Conflict. Solo se admite una evaluación por participante por orden. |
| `TC-REV-04` | NEG | P2 | GeneradorPrueba1 | Ninguna | Enviar calificación fuera de rango (ej. 6 estrellas o -1). | `score: 6` | HTTP 400 Bad Request. Validación Zod restringe calificación al rango entero [1, 5]. |

---

### 2.14 Módulo 14: Reportes y Analítica Administrativa (TC-REP)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-REP-01` | POS | P1 | VerificadorPrueba1 | Rol ADMIN | Consultar panel de analítica de conexiones `/api/admin/analytics/connections`. | Token ADMIN | HTTP 200 OK. Retorna métricas de conexiones activas, picos por hora y distribución geográfica. |
| `TC-REP-02` | POS | P1 | VerificadorPrueba1 | Rol ADMIN | Consultar métricas de visitas y tiempo en pantalla `/api/admin/analytics/visits`. | Token ADMIN | HTTP 200 OK. Retorna tiempos promedio y pantallas con mayor permanencia. |
| `TC-REP-03` | POS | P2 | VerificadorPrueba1 | Rol ADMIN | Consultar sugerencias automáticas de optimización circular `/api/admin/analytics/suggestions`. | Token ADMIN | HTTP 200 OK. Algoritmo retorna recomendaciones de balance de oferta/demanda. |

---

### 2.15 Módulo 15: Resiliencia, Idempotencia y Manejo de Errores (TC-RES)

| ID | Tipo | Prioridad | Actor | Precondición | Descripción / Pasos | Datos de Entrada | Resultado Esperado |
|---|---|---|---|---|---|---|---|
| `TC-RES-01` | LIM | P2 | Concurrente | Oferta activa | Dos recicladores intentan aceptar simultáneamente una oferta con volumen único. | Peticiones paralelas | Primera solicitud procesada exitosamente; segunda responde con conflicto (409) o validación sin corrupción de datos. |
| `TC-RES-02` | LIM | P2 | Cualquiera | Servidor activo | Enviar payload JSON corrupto o mal formado sintácticamente. | String no JSON | HTTP 400 Bad Request. Servidor responde limpiamente con JSON de error sin caerse ni reiniciar proceso. |
| `TC-RES-03` | SEC | P1 | Atacante | Endpoint público | Intento de inyección SQL en parámetros de búsqueda de materiales (`' OR 1=1 --`). | Query malicioso | Prisma ORM parametrizado previene la inyección de forma nativa. Retorna resultados legítimos o lista vacía. |
