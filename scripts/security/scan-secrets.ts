import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SecretPattern {
  label: string;
  regex: RegExp;
}

const knownDemoPatterns: SecretPattern[] = [
  { label: 'Contraseña demo de consola', regex: /ImaraBogota2026/g },
  { label: 'Correo demo de consola', regex: /recuperador\.bogota@imara\.org/g },
  { label: 'Contraseña E2E móvil', regex: /Password123!@#/g },
  { label: 'Contraseña E2E generador', regex: /GeneradorPassword123!@#/g },
  { label: 'Contraseña E2E reciclador', regex: /RecicladorPassword123!@#/g },
  { label: 'Contraseña QA de respaldo', regex: /PruebaSegura2026/g },
  { label: 'Contraseña QA generador', regex: /GeneradorPass2026/g },
  { label: 'Contraseña QA reciclador', regex: /RecicladorPass2026/g },
  { label: 'Contraseña QA transformador', regex: /TransformadorPass2026/g },
  { label: 'Contraseña QA transportador', regex: /TransportadorPass2026/g },
  { label: 'Contraseña QA verificador', regex: /VerificadorAdmin2026/g },
  { label: 'Correo administrador demo', regex: /admin@datacircular\.com/g },
];

const highRiskPatterns: SecretPattern[] = [
  { label: 'Clave privada PEM', regex: /BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY/g },
  { label: 'Clave de acceso AWS', regex: /AKIA[0-9A-Z]{16}/g },
  { label: 'Token GitHub', regex: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { label: 'Token Slack', regex: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { label: 'Clave Stripe', regex: /sk_(live|test)_[A-Za-z0-9]{16,}/g },
  { label: 'Clave privada de service account', regex: /"private_key"\s*:/g },
];

const ignoredDirectories = /^(node_modules|\.git|dist|build|\.expo|coverage|postgres-data)\//;
const ignoredFiles = /(^|\/)(tests?|__tests__)\/|\.test\.(ts|tsx|js|jsx)$|^scripts\/security\/scan-secrets\.ts$/;
const maxFileSize = 2 * 1024 * 1024;

function gitFiles(repoRoot: string, args: string[]): string[] {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function isProbablyText(buffer: Buffer): boolean {
  return !buffer.includes(0);
}

function main(): void {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const files = new Set([
    ...gitFiles(repoRoot, ['ls-files']),
    ...gitFiles(repoRoot, ['ls-files', '--others', '--exclude-standard']),
  ]);

  const findings: Array<{ file: string; line: number; label: string }> = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (ignoredDirectories.test(file) || ignoredFiles.test(file)) continue;

    const fullPath = path.join(repoRoot, file);
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (!stat.isFile() || stat.size > maxFileSize) continue;

    const buffer = fs.readFileSync(fullPath);
    if (!isProbablyText(buffer)) continue;

    const content = buffer.toString('utf8');

    for (const pattern of [...knownDemoPatterns, ...highRiskPatterns]) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length;
        const key = `${file}:${line}:${pattern.label}`;
        if (!seen.has(key)) {
          seen.add(key);
          findings.push({ file, line, label: pattern.label });
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log('✅ No se encontraron credenciales demo ni secretos de alto riesgo en el árbol de trabajo.');
    return;
  }

  console.error(`❌ Se encontraron ${findings.length} coincidencias de secretos o credenciales demo:`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} — ${finding.label}`);
  }
  process.exit(1);
}

main();
