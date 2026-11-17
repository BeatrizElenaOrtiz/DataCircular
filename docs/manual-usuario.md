# DATA_CIRCULAR — Manual de Usuario

**Guía práctica para generadores, recicladores, transportadores, transformadores y administradores**
**Fundación IMARA • Colombia • Actualizado: 2 de noviembre de 2026**

---

## 1. Para qué sirve esta guía

Este manual explica cómo registrarse, acceder y utilizar las funciones disponibles en la aplicación móvil/Web de DATA_CIRCULAR según el tipo de usuario. Los nombres de botones pueden variar ligeramente entre móvil y Web.

La aplicación conecta a quienes ofrecen materiales aprovechables con organizaciones y participantes que pueden recuperarlos, transportarlos o transformarlos. En el estado actual:

- Solo el perfil **Generador** puede crear y administrar ofertas.
- Los perfiles **Reciclador**, **Transportador** y **Transformador** pueden explorar ofertas, iniciar conversaciones y participar en negociaciones.
- **Administrador** es un rol de plataforma asignado por un administrador; no se obtiene al registrarse como participante.
- Los datos y las pantallas requieren conexión con la API. Una lista vacía puede significar que aún no hay publicaciones, mensajes, organizaciones u operaciones en ese entorno.
- El mapa de actividad no está disponible. Los indicadores administrativos incluyen gráficos, pero algunas métricas de usuarios, visitas, conexiones y sugerencias todavía usan valores de ejemplo; no deben interpretarse como datos reales.

## 2. Tipos de cuenta y funciones

| Perfil seleccionado al registrarse | Para quién es | Funciones disponibles |
|---|---|---|
| **Generador (`GENERATOR`)** | Persona, comercio, institución o empresa que tiene materiales para ofrecer. | Crear y administrar sus ofertas, atender conversaciones, responder propuestas y consultar el estado de las operaciones vinculadas. No cuenta con acceso al explorador general de ofertas. |
| **Reciclador (`RECYCLER`)** | Recuperador u organización que recolecta y clasifica materiales. | Explorar ofertas, filtrar materiales, iniciar conversaciones, presentar propuestas y consultar operaciones. Puede asociar materiales a su organización. |
| **Transportador (`TRANSPORTER`)** | Participante que presta o coordina transporte de materiales. | Explorar ofertas, iniciar conversaciones, presentar propuestas y consultar operaciones. Puede asociar materiales a su organización; la app no asigna automáticamente vehículos ni rutas. |
| **Transformador (`TRANSFORMER`)** | Participante que incorpora materiales recuperados a un proceso productivo. | Explorar ofertas, filtrar materiales, iniciar conversaciones, presentar propuestas y consultar operaciones. Puede asociar materiales a su organización. |
| **Administrador (`ADMIN`)** | Persona autorizada para administrar la plataforma. | Revisar organizaciones, consultar indicadores, administrar el catálogo y los parámetros, y gestionar usuarios. No participa en el marketplace como generador o comprador. |

El tipo de participante describe la actividad principal de la cuenta. Las funciones de creación y revisión de organizaciones dependen también del rol y de los permisos de la persona dentro de esa organización.

## 3. Primer acceso

### 3.1 Crear una cuenta de participante

1. En la pantalla de bienvenida, elige **Crear Cuenta Nueva**.
2. Escribe el nombre de la persona o el nombre de contacto de la empresa. Se requieren al menos 3 caracteres.
3. Ingresa un correo válido. Se normaliza a minúsculas; no se permiten cuentas duplicadas con el mismo correo.
4. Ingresa el teléfono móvil. Es opcional; si se proporciona, debe tener un número válido de Colombia.
5. Selecciona el tipo de participante que mejor describe tu actividad. La selección define qué pantallas estarán disponibles:
   - Generador: ofrece materiales.
   - Reciclador: recupera materiales.
   - Transportador: moviliza materiales.
   - Transformador: aprovecha materiales.
6. Selecciona tu ciudad o municipio.
7. Crea y confirma la contraseña. Debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo.
8. Lee la información sobre tratamiento de datos, consulta la política si el enlace está configurado y marca la casilla de aceptación.
9. Pulsa **Registrar Cuenta en DATA_CIRCULAR**.
10. Si el registro termina correctamente, se inicia la sesión y se abre el perfil. Desde allí puedes completar tus datos y vincular una organización si corresponde.

El registro público crea una cuenta de participante (`USER`). No intentes elegir `ADMIN`: el acceso administrativo lo asigna el personal autorizado.

### 3.2 Iniciar sesión

1. Escribe el correo asociado a tu cuenta y la contraseña.
2. Pulsa **Ingresar**.
3. La aplicación te lleva al área correspondiente:
   - Generador: **Gestión de Materiales**.
   - Reciclador, Transportador o Transformador: **Inicio / Mercado**.
   - Administrador: **Panel Nacional IMARA**.

Si aparece un error, revisa que el correo esté escrito correctamente, que la cuenta no esté desactivada y que el servicio esté disponible. Si el problema continúa, contacta al administrador del sistema por el canal institucional.

> **Importante sobre “¿Olvidaste tu contraseña?”:** la pantalla de recuperación actualmente muestra una confirmación simulada; no envía un correo ni cambia la contraseña. Solicita el restablecimiento al administrador por un canal seguro. No compartas tu contraseña en chats ni la incluyas en capturas o documentos.

### 3.3 Navegación principal

- **Generador:** la barra inferior muestra **Publicar**, **Chat** y **Perfil**. El botón **+** también abre la creación de una publicación.
- **Reciclador, Transportador y Transformador:** la barra inferior muestra **Inicio**, **Chat** y **Perfil**.
- **Administrador:** no usa la barra del marketplace. Puede volver al perfil desde el panel con **Perfil**; desde el perfil puede abrir nuevamente el panel y **Administrar Usuarios**.
- En las pantallas de detalle o formularios, utiliza la flecha de regreso. Si no existe historial de navegación, la app usa una ruta de retorno segura.

## 4. Instrucciones según el tipo de participante

### 4.1 Generador: crear y administrar ofertas

Al ingresar, la cuenta Generador abre **Gestión de Materiales**. También puedes abrir **Publicar** o el botón **+** desde la barra inferior.

#### Crear una oferta

1. Abre la pestaña **Nueva Publicación**.
2. Elige una categoría principal y luego una **subcategoría específica**. Por ejemplo: *Plásticos → PET*. No basta con seleccionar la categoría principal.
3. Ingresa la cantidad mayor que cero y selecciona una unidad del catálogo (kg, tonelada, unidad, litro, metro cúbico o bulto, según las opciones disponibles).
4. Completa la descripción con información útil para quien recoge el material: composición, presentación, embalaje y condiciones.
5. Selecciona una organización asociada si deseas publicar en nombre de ella; este campo es opcional cuando aparece como tal.
6. Indica la ciudad o municipio, la dirección de retiro y la condición del material. La dirección es obligatoria.
7. Si quieres adjuntar una foto, concede el permiso de acceso a la galería y selecciona una imagen. La foto es opcional; el límite admitido es 2 MB.
8. Activa **Urgente** solo cuando aplique.
9. Revisa los datos y pulsa **Publicar Oferta de Material**.
10. Cuando el servidor confirme la creación, verás un mensaje de éxito y se abrirá el detalle de la oferta.

Si no aparece el catálogo o el botón no termina de guardar, revisa la conexión y vuelve a intentar. No envíes varias veces si ya aparece el mensaje de éxito.

#### Consultar o cerrar tus publicaciones

1. Abre **Mis Publicaciones**.
2. Selecciona una publicación para ver su detalle.
3. Mientras esté activa, puedes abrir **Editar publicación** desde el detalle y modificar los campos permitidos.
4. Para dejar de recibir contactos por una oferta, usa la acción de cierre de la publicación y confirma. El cierre no equivale a borrar el historial.
5. Vuelve a **Mis Publicaciones** para actualizar la lista.

#### Atender una negociación

1. Cuando un participante contacte una de tus ofertas, la conversación aparecerá en **Chat → Mensajes**.
2. Abre la conversación y revisa el material al que está vinculada.
3. Responde usando el campo de mensaje.
4. Revisa las condiciones y cantidad de cada propuesta formal. Si la recibiste, puedes **Aceptar** o **Rechazar**; también puedes enviar una contrapropuesta desde la conversación.
5. Aceptar una propuesta crea automáticamente una operación vinculada. Revisa sus datos en **Chat → Operaciones**.

### 4.2 Reciclador: encontrar y negociar materiales

1. En **Inicio**, usa la búsqueda para localizar por tipo de material, descripción o ciudad/municipio.
2. Puedes tocar una categoría para limitar la búsqueda.
3. Abre **Filtros** para configurar:
   - Más recientes o urgentes primero.
   - Mostrar solo ofertas urgentes.
   - Cantidad mínima o máxima.
   - Unidad de medida.
   - Ciudad o municipio, incluyendo **Otro** cuando necesites escribir un lugar manualmente.
4. Pulsa **Aplicar filtros**. Usa **Restablecer** para quitar los filtros avanzados.
5. Abre una tarjeta para revisar cantidad, condición, ubicación, descripción y datos del ofertante.
6. En el detalle, revisa **Coincidencias compatibles** si están disponibles. Una lista vacía solo indica que no se encontraron coincidencias en ese momento.
7. Pulsa **Iniciar Conversación o Propuesta** para contactar al generador.
8. Conversa y presenta una propuesta con una cantidad y términos claros. La propuesta debe describir condiciones de retiro/entrega y cualquier acuerdo de precio o pago entre las partes.
9. Revisa el resultado en **Chat → Mensajes** o **Chat → Propuestas**.

Si quieres que tus sugerencias sean más pertinentes, abre **Perfil → Mis Organizaciones → Vincular**, crea una organización y selecciona las subcategorías que recolecta. La selección de categorías describe la actividad; no crea ofertas en nombre de la organización.

### 4.3 Transportador: coordinar participación logística

1. En **Inicio**, busca ofertas por material, cantidad, urgencia y municipio.
2. Abre el detalle y contacta al generador si puedes ofrecer o coordinar el servicio de transporte.
3. Si ya eres parte de una coincidencia, el detalle puede mostrar **Solicitar transporte**. Actívalo para indicar que se requiere transporte en esa negociación; coordina condiciones y disponibilidad con la contraparte por el chat.
4. Usa **Chat → Operaciones** para consultar las operaciones visibles para tu cuenta.
5. Si representas una organización, vincúlala desde **Perfil** y selecciona las subcategorías relacionadas con su actividad.

**Límite actual:** el perfil Transportador no asigna vehículos, conductores ni rutas automáticamente. En la pantalla móvil actual, **Operaciones** permite consultar el estado, pero no ofrece controles para programar el transporte, registrar la recolección o subir evidencias. Coordina esos pasos directamente con la contraparte y el administrador hasta que esas acciones estén disponibles en la app.

### 4.4 Transformador: buscar material para aprovechamiento

1. En **Inicio**, busca una categoría y subcategoría que correspondan a tu proceso productivo.
2. Usa filtros de municipio, cantidad y unidad para encontrar ofertas viables.
3. Abre el detalle y verifica condición, volumen, ubicación y descripción antes de contactar.
4. Pulsa **Iniciar Conversación o Propuesta**.
5. Aclara en el chat la cantidad que puedes recibir, condiciones de calidad, punto y fecha de entrega, transporte y condiciones comerciales.
6. Envía una propuesta formal con la cantidad y los términos acordados. Si la recibes, puedes aceptarla o rechazarla.
7. Tras la aceptación, consulta la operación asociada desde **Chat → Operaciones**.

Para registrar las categorías que tu organización procesa, vincula la organización desde **Perfil** y selecciona los materiales correspondientes.

## 5. Chat, propuestas y operaciones

### 5.1 Mensajes

1. Abre **Chat → Mensajes**.
2. Selecciona una conversación para abrir el hilo.
3. Escribe el mensaje y pulsa el botón de envío.
4. Las conversaciones se actualizan periódicamente. Si no ves un mensaje reciente, vuelve a la lista y actualízala.

La conversación se inicia desde el detalle de una oferta ajena. No puedes iniciar una conversación contigo mismo ni con una publicación propia. Los datos de contacto privados de la contraparte no se muestran; utiliza el canal de la aplicación.

### 5.2 Propuestas

- En el chat, pulsa **Formular Propuesta Formal**.
- Ingresa una cantidad positiva y escribe los términos completos. La unidad se toma de la publicación.
- Para cambiar una propuesta pendiente, envía una contrapropuesta. La propuesta anterior queda reemplazada.
- El destinatario puede aceptar o rechazar una propuesta pendiente que no haya creado.
- Comprueba siempre cantidad, términos, transporte, calidad, fechas y condiciones económicas antes de aceptar. La aceptación genera una operación y no debe usarse como simple confirmación de lectura.
- La pantalla **Chat → Propuestas** lista propuestas vinculadas a tus conversaciones. Si no hay propuestas, no aparecerán elementos.

La propuesta de la aplicación contiene cantidad y texto de términos; no calcula ni liquida automáticamente precio, transporte o pagos. Esos términos deben quedar expresos y ser acordados por las partes.

### 5.3 Operaciones y límites disponibles

Tras aceptar una propuesta, la operación aparece en **Chat → Operaciones** con su código, material, contraparte, estado y línea de progreso, cuando esos datos estén disponibles.

El ciclo previsto en el servidor incluye programación, recolección, evidencias, recepción, cierre o cancelación. Sin embargo, la aplicación móvil actual presenta la lista y el estado de las operaciones, pero no incluye los formularios para ejecutar esas transiciones, adjuntar evidencias ni emitir una evaluación. No asumas que una fase avanzó hasta verla reflejada en el estado de la operación. Para completar un proceso que requiera esas acciones, solicita apoyo al administrador.

## 6. Perfil y organizaciones

### 6.1 Editar perfil

1. Abre **Perfil → Editar Perfil**.
2. Actualiza el nombre o teléfono.
3. Guarda los cambios y vuelve al perfil.

El correo y el tipo de participante no se cambian desde esta pantalla. Para corregirlos, contacta al administrador.

### 6.2 Vincular una organización

1. En **Perfil**, busca **Mis Organizaciones** y pulsa **Vincular**. En el formulario actual, esta acción crea una organización nueva y la vincula a tu cuenta; no busca ni incorpora una organización ya registrada.
2. Ingresa el nombre y, si corresponde, el NIT.
3. Para perfiles distintos de Generador, selecciona al menos una subcategoría de material que recolecta o transforma.
4. Pulsa **Crear** y confirma que la organización aparezca en la lista.

La aplicación crea y vincula la organización a tu cuenta. Este formulario no incorpora todos los datos legales o de domicilio; proporciona la información faltante al administrador cuando solicites verificación.

### 6.3 Solicitar verificación

1. En **Mis Organizaciones**, comprueba que la organización figure como **Sin verificar**.
2. Pulsa **Solicitar verificación** y completa el formulario con la información o documentos solicitados.
3. Consulta **Mis Solicitudes de Verificación** y el estado mostrado:
   - **Sin verificar:** aún no hay aprobación.
   - **En revisión / Pendiente:** la solicitud está radicada.
   - **Verificada:** el administrador aprobó la organización.
4. Si se aprueba, abre la constancia desde la tarjeta de la organización.

La verificación requiere revisión administrativa; radicar la solicitud no equivale a obtener aprobación. Si la solicitud no aparece o necesitas corregir documentos, contacta al administrador.

### 6.4 Cerrar sesión o desactivar la cuenta

- **Cerrar Sesión:** desde Perfil, pulsa **Cerrar Sesión** y confirma. La sesión local termina y se vuelve a la pantalla de acceso.
- **Desactivar mi cuenta:** úsalo solo si deseas dejar de acceder. La cuenta queda inactiva y no podrás iniciar sesión hasta que un administrador la reactive. Esta acción no es lo mismo que cerrar sesión y no elimina el historial relacionado.

No desactives la cuenta ADMIN principal para salir del panel: utiliza **Perfil** y después **Cerrar Sesión**.

## 7. Guía para administradores

El administrador inicia sesión con una cuenta cuyo rol ya fue asignado. Al acceder se abre el panel; para volver al perfil, pulsa **Perfil**. Desde el perfil puedes regresar al panel.

### 7.1 Revisar organizaciones

1. Abre la pestaña **Verificación**.
2. Selecciona una organización pendiente para consultar los datos y documentos disponibles.
3. Revisa la información antes de emitir un dictamen.
4. Aprueba o rechaza según el procedimiento institucional. Si se rechaza, registra el motivo cuando el formulario lo solicite.
5. La decisión actualiza el estado que ve la organización en su perfil.

### 7.2 Indicadores

1. Abre **Indicadores** y selecciona el grupo de indicadores.
2. La sección **Economía Circular** carga métricas soportadas por la API, incluyendo datos agregados por municipio y categoría de material.
3. Usa **Refrescar** si está disponible para volver a consultar.
4. Si la base de desarrollo está vacía, puede no haber barras o resultados.

**Interpretación:** el mapa geográfico por zonas no está implementado. Algunas secciones de usuarios, conexiones, visitas y sugerencias utilizan valores de ejemplo y no deben comunicarse como conteos reales ni usarse para decisiones operativas.

### 7.3 Catálogo

En **Catálogo**, consulta y administra categorías, subcategorías y unidades. El catálogo vigente contiene 11 categorías principales, 77 subcategorías (75 activas y 2 inactivas por revisión jurídica) y 6 unidades. No actives residuos hospitalarios ni equipos con PCB sin la aprobación jurídica correspondiente. Conserva las referencias históricas al inactivar elementos; evita eliminaciones que rompan registros existentes.

### 7.4 Parámetros, auditoría y usuarios

- En **Parámetros**, revisa las tarifas de verificación y su registro de auditoría. Los cambios de tarifa requieren una justificación.
- Desde **Perfil → Administrar Usuarios**, el administrador puede crear, editar, desactivar y, cuando esté habilitado, eliminar usuarios. Comprueba cuidadosamente la cuenta objetivo antes de guardar. La eliminación permanente es irreversible y puede afectar registros relacionados.
- No compartas contraseñas por este manual, capturas, tickets públicos ni repositorios. Provisiona accesos por un canal seguro.

## 8. Preguntas frecuentes y solución de problemas

### No veo la pestaña Inicio o Publicar

Es normal que las opciones dependan del tipo de cuenta. Generador publica, pero no tiene el explorador general. Reciclador, Transportador y Transformador exploran ofertas, pero no crean publicaciones. Si tu tipo es incorrecto, solicítale la corrección al administrador.

### No aparecen ofertas, conversaciones o coincidencias

Comprueba que haya conexión, borra filtros, selecciona **Todas las ciudades / municipios** y actualiza la pantalla. Las coincidencias dependen de las categorías de material registradas en las organizaciones y de las ofertas activas disponibles; el resultado vacío no indica necesariamente un error.

### No puedo publicar

Confirma que iniciaste sesión con una cuenta `USER` de tipo `GENERATOR`, que elegiste una subcategoría, ingresaste una cantidad mayor que cero y completaste la dirección. El tipo de publicación permitido es **Oferta**.

### No puedo aceptar o responder una propuesta

Solo la contraparte puede responder a una propuesta pendiente; quien la creó no puede aceptarla. Si ya fue aceptada, rechazada o reemplazada por una contrapropuesta, esa propuesta dejó de estar pendiente.

### No puedo cambiar el estado de una operación

La pantalla móvil es de consulta y no implementa actualmente controles para programar, confirmar recolección, subir evidencias, recibir, cerrar o evaluar una operación. Solicita apoyo al administrador; no confirmes a terceros que una operación está completada sin verificar el estado actualizado.

### Olvidé mi contraseña

La pantalla de recuperación es solo demostrativa y no envía correo. Solicita restablecimiento al administrador por un canal institucional seguro.

### La app muestra error o queda cargando

1. Comprueba conexión a Internet o a la red configurada para el entorno.
2. Cierra y vuelve a abrir la pantalla; si corresponde, vuelve a iniciar sesión.
3. Usa el gesto o botón de regreso y evita repetir una acción de guardado si ya apareció confirmación.
4. Anota el perfil usado, la pantalla, la hora y el mensaje de error. No envíes contraseñas, tokens ni documentos sensibles en el reporte.
5. Contacta al administrador del sistema.

## 9. Buenas prácticas para operar

- Describe el material y su condición con honestidad; usa la subcategoría más precisa.
- Verifica municipio, dirección, unidad y cantidad antes de publicar o proponer.
- Acuerda explícitamente precio, forma de pago, transporte, horario, embalaje y calidad por escrito con la contraparte.
- No consideres una oferta, solicitud de verificación o propuesta como aprobada hasta que la app muestre el estado correspondiente.
- Protege tus credenciales y los datos personales de otras personas.
- Reporta errores con información suficiente para reproducirlos, sin adjuntar secretos.
