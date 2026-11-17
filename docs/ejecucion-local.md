# Ejecución local

## Iniciar API y aplicación móvil

Desde la raíz del repositorio ejecuta:

```bash
npm run dev
```

El comando reutiliza la API saludable en el puerto `3000` o busca uno libre entre `3000` y `3010`. Expo busca un puerto libre entre `8081` y `8090`, evitando prompts por colisiones, y muestra un QR para Expo Go. El teléfono y el computador deben estar en la misma red Wi-Fi. En la consola de Expo, pulsa `w` para abrir la versión web.

El puerto seleccionado para la API se comparte automáticamente con la app móvil. Durante desarrollo, CORS permite los orígenes `localhost` y `127.0.0.1` aunque Expo seleccione un puerto distinto.

Pulsa `Ctrl+C` para detener los procesos iniciados por el comando.

Para iniciar Expo Go con túnel y la API desde VS Code, conecta el teléfono y el computador a la misma Wi-Fi, abre **Terminal → Ejecutar tarea...** (`Ctrl+Shift+P`, busca `Tareas: Ejecutar tarea`) y selecciona **Iniciar Expo Go (túnel)**. También puedes usar la terminal integrada:

```bash
npm run mobile:tunnel
```

El comando inicia o reutiliza la API, configura automáticamente la IP Wi-Fi del computador para que el teléfono acceda a ella y luego inicia Expo por túnel. Espera a que aparezca `Tunnel ready` y escanea el QR nuevo con Expo Go. Acepta el siguiente puerto si Expo indica que el puerto actual está ocupado. Detén ambos servicios con `Ctrl+C`.

## Iniciar servicios por separado

```bash
npm run dev:api
npm run dev:mobile
npm run mobile:web
```

## Cuenta y datos de desarrollo

En la base `data_circular_dev` revisada se conserva una sola cuenta ADMIN, cuyo correo se define con `EVAL_ADMIN_EMAIL`; no se incluyen contraseñas en este documento. El script `npm run db:clean` elimina datos operativos y usuarios restantes, y crea o actualiza solamente esa cuenta. Solo permite ejecutarse con `ALLOW_DEMO_SEED=true` y `NODE_ENV=development`, con una base cuyo nombre termine en `_dev`, confirmación explícita e identidad administrativa entregada mediante variables de entorno seguras. Se niega a ejecutarse con `NODE_ENV=production`. No ejecutar contra datos que se deban conservar.