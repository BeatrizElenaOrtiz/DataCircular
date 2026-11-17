# Plan y Estrategia de Pruebas - DATA_CIRCULAR

## 1. Niveles de Pruebas
1. **Pruebas Unitarias**:
   - Validación de utilidades, hashing, esquemas Zod.
2. **Pruebas de Integración de API**:
   - Pruebas de endpoints HTTP usando `Supertest` sobre la aplicación Express sin necesidad de levantar el socket de red real.
   - Verificación de códigos de estado (200, 400, 404, 500, 503).
3. **Pruebas de Persistencia**:
   - Verificación de conectividad real con PostgreSQL y ejecución de consultas de verificación de salud.

## 2. Pruebas de la Fase 1
- `apps/api/tests/health.test.ts`:
  - `GET /api/v1/health` responde con 200 y confirma `healthy` + base de datos `connected`.
  - Verifica que no exista ninguna fuga de credenciales en el JSON de respuesta.
  - Verifica que las rutas no existentes respondan con 404 estructurado.

## 3. Usuarios y Administración
- El registro exige y persiste `userType` (`GENERATOR`, `RECYCLER`, `TRANSPORTER` o `TRANSFORMER`).
- El CRUD administrativo verifica listado, creación, actualización y desactivación lógica de cuentas.
- La eliminación permanente verifica borrado físico, control de rol `ADMIN` y protección contra autoeliminación.
- Las rutas administrativas deben permitir el rol `ADMIN` y responder `403 FORBIDDEN` para `USER`.

## 4. Estado y resultados registrados

- Suite API: último resultado registrado de 166 pruebas aprobadas en 12 archivos (`npm run test:api`). Ejecutar de nuevo para verificar el entorno actual.
- UI/contraste: `npm --workspace=apps/mobile run test:ui-quality` registró 12 verificaciones, incluyendo contrastes de marca y retornos de navegación del administrador.
- TypeScript móvil y build de API: pasaron en la revisión de rendimiento documentada.
- No se registra una prueba de carga ni una ejecución E2E completa reciente. No atribuir al sistema capacidad de concurrencia, latencia o rendimiento en Android físico hasta medirlo en infraestructura y dispositivo representativos.

Para repetir pruebas que crean participantes o movimientos, usar una base aislada. El script `db:clean` es destructivo y solo se permite para bases `_dev` con confirmación explícita.
