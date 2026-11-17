const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const rootDirectory = path.resolve(__dirname, '..');
const mobileDirectory = path.join(rootDirectory, 'apps', 'mobile');
const children = [];
let isStopping = false;
const useTunnel = process.argv.includes('--tunnel');

function getLocalWifiIp() {
  const nets = require('node:os').networkInterfaces();

  for (const [name, addresses] of Object.entries(nets)) {
    if (!/wi-?fi|wlan|wireless|inal[aá]mbric/i.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }

  for (const addresses of Object.values(nets)) {
    for (const address of addresses ?? []) {
      if (
        address.family === 'IPv4' &&
        !address.internal &&
        !address.address.startsWith('172.') &&
        !address.address.startsWith('169.254')
      ) {
        return address.address;
      }
    }
  }

  throw new Error('No se pudo detectar la IP Wi-Fi del computador para conectar la API al teléfono.');
}

async function getApiStatus(port = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    return {
      reachable: true,
      healthy: response.ok && body?.data?.service === 'DATA_CIRCULAR API',
    };
  } catch {
    return { reachable: false, healthy: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForApi(port, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await getApiStatus(port);
    if (status.healthy) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `La API no respondió en http://127.0.0.1:${port}/api/v1/health. Revisa el error de inicio de la API.`
  );
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(firstPort, lastPort) {
  for (let port = firstPort; port <= lastPort; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No hay puertos libres entre ${firstPort} y ${lastPort}.`);
}

function stopAll(exitCode) {
  if (isStopping) return;
  isStopping = true;
  process.exitCode = exitCode;

  for (const { child } of children) {
    if (child.exitCode !== null || child.killed) continue;

    if (isWindows) {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => child.kill());
    } else {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

function startProcess(name, executable, args, cwd, env = process.env) {
  const child = spawn(executable, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: isWindows && executable === npmCommand,
  });
  children.push({ name, child });

  child.on('error', (error) => {
    console.error(`[${name}] No se pudo iniciar: ${error.message}`);
    stopAll(1);
  });

  child.on('exit', (code, signal) => {
    if (isStopping) return;
    console.error(`[${name}] terminó${signal ? ` por ${signal}` : ` con código ${code}`}.`);
    stopAll(code ?? 1);
  });
}

async function main() {
  const apiStatus = await getApiStatus();
  let apiPort = 3000;

  if (apiStatus.healthy) {
    console.log('[API] Ya está activa en http://localhost:3000; se reutiliza.');
  } else {
    apiPort = await findAvailablePort(3000, 3010);
    console.log(`[API] Se usará el puerto libre ${apiPort}.`);
    startProcess('API', npmCommand, ['run', 'dev:api'], rootDirectory, {
      ...process.env,
      PORT: String(apiPort),
    });
    await waitForApi(apiPort);
    console.log(`[API] Lista en http://localhost:${apiPort}.`);
  }

  const expoPort = await findAvailablePort(8081, 8090);
  console.log(`[Expo móvil] Se usará el puerto libre ${expoPort}.`);
  const expoArgs = [
    path.join(mobileDirectory, 'scripts', 'start-mobile.js'),
    '--port',
    String(expoPort),
  ];
  const expoEnv = {
    ...process.env,
    EXPO_PUBLIC_API_PORT: String(apiPort),
  };

  if (useTunnel) {
    expoArgs.push('--tunnel');
    if (!expoEnv.EXPO_PUBLIC_API_URL && !expoEnv.EXPO_PUBLIC_API_HOST) {
      expoEnv.EXPO_PUBLIC_API_HOST = getLocalWifiIp();
    }
    console.log('[Expo móvil] Modo túnel: Metro usa ngrok y la API usa la IP Wi-Fi del computador.');
    console.log(
      `[API móvil] http://${expoEnv.EXPO_PUBLIC_API_HOST || getLocalWifiIp()}:${apiPort}/api/v1`
    );
  }

  startProcess(
    'Expo móvil',
    process.execPath,
    expoArgs,
    mobileDirectory,
    expoEnv
  );
}

main().catch((error) => {
  console.error(`[dev] ${error.message}`);
  stopAll(1);
});