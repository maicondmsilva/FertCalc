import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STRICT_VERSION = 20260823000000n;

export function validateMigrations(files) {
  const failures = [];
  const warnings = [];
  const versions = new Map();

  for (const file of files) {
    const match = file.name.match(/^(\d{8}|\d{14})_[a-z0-9_]+\.sql$/u);
    if (!match) {
      warnings.push(`${file.name}: nome legado fora do padrão atual.`);
      continue;
    }

    const version = match[1];
    if (version.length === 14) {
      if (versions.has(version)) failures.push(`Timestamp duplicado: ${version}.`);
      versions.set(version, file.name);
    }
    if (file.content.trim().length === 0) failures.push(`${file.name}: migration vazia.`);
    if (version.length !== 14 || BigInt(version) < STRICT_VERSION) continue;

    if (/\b(?:insert\s+into|update|delete\s+from)\s+cron\.job\b/iu.test(file.content)) {
      failures.push(`${file.name}: alteração direta de cron.job não é permitida.`);
    }
    if (/\bcreate\s+extension\b[^;]*\bversion\b/iu.test(file.content)) {
      failures.push(`${file.name}: não fixe versão de extensão Supabase.`);
    }
    if (/\bsecurity\s+definer\b/iu.test(file.content) && !/set\s+search_path\s*=\s*''/iu.test(file.content)) {
      failures.push(`${file.name}: SECURITY DEFINER sem search_path seguro.`);
    }

    const publicTables = [...file.content.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+public\.([a-z0-9_]+)/giu)]
      .map((tableMatch) => tableMatch[1]);
    for (const table of publicTables) {
      const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'iu');
      if (!rlsPattern.test(file.content)) failures.push(`${file.name}: public.${table} foi criada sem habilitar RLS.`);
    }
  }

  return { failures, warnings, migrationCount: files.length };
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const migrationDir = join(root, 'supabase', 'migrations');
  const files = readdirSync(migrationDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, content: readFileSync(join(migrationDir, name), 'utf8') }));
  const result = validateMigrations(files);

  for (const warning of result.warnings) console.warn(`Aviso: ${warning}`);
  for (const failure of result.failures) console.error(`::error::${failure}`);
  if (result.failures.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(`${result.migrationCount} migrations aprovadas pela política de segurança.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
