import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REQUIRED_PATHS = [
  'docs/DISASTER_RECOVERY_RUNBOOK.md',
  'supabase/tests/disaster_recovery_verification.sql',
  'supabase/migrations/20260823140535_create_runtime_error_events.sql',
];
const REQUIRED_IGNORE_RULES = ['backups/', '*.backup', '*.dump', '*.sql.gz'];

export function evaluateReadiness(rootDir) {
  const failures = [];
  const warnings = [];
  const migrationDir = join(rootDir, 'supabase', 'migrations');
  const migrationFiles = existsSync(migrationDir)
    ? readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))
    : [];

  for (const relativePath of REQUIRED_PATHS) {
    const absolutePath = join(rootDir, relativePath);
    if (!existsSync(absolutePath) || statSync(absolutePath).size === 0) {
      failures.push(`Arquivo obrigatório ausente ou vazio: ${relativePath}`);
    }
  }

  if (migrationFiles.length === 0) {
    failures.push('Nenhuma migration SQL foi encontrada.');
  }

  const modernVersions = migrationFiles
    .map((name) => name.match(/^(\d{14})_/u)?.[1])
    .filter(Boolean);
  const duplicateVersions = modernVersions.filter(
    (version, index) => modernVersions.indexOf(version) !== index
  );
  if (duplicateVersions.length > 0) {
    failures.push(`Timestamps de migration duplicados: ${[...new Set(duplicateVersions)].join(', ')}`);
  }

  const ignorePath = join(rootDir, '.gitignore');
  const ignoreContents = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8') : '';
  for (const rule of REQUIRED_IGNORE_RULES) {
    if (!ignoreContents.split(/\r?\n/u).includes(rule)) {
      failures.push(`Proteção ausente no .gitignore: ${rule}`);
    }
  }

  const legacyMigrations = migrationFiles.filter((name) => !/^\d{14}_[a-z0-9_]+\.sql$/u.test(name));
  if (legacyMigrations.length > 0) {
    warnings.push(
      `${legacyMigrations.length} migration(s) legada(s) não seguem o timestamp moderno de 14 dígitos.`
    );
  }

  return { failures, warnings, migrationCount: migrationFiles.length };
}

async function appendSummary(result) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const status = result.failures.length === 0 ? 'APROVADO' : 'REPROVADO';
  const lines = [
    '## Prontidão de recuperação',
    '',
    `**Status:** ${status}`,
    `**Migrations versionadas:** ${result.migrationCount}`,
    '',
    ...result.warnings.map((warning) => `- Aviso: ${warning}`),
    ...result.failures.map((failure) => `- Falha: ${failure}`),
  ];
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const rootDir = resolve(scriptDir, '..');
  const result = evaluateReadiness(rootDir);

  for (const warning of result.warnings) console.warn(`Aviso: ${warning}`);
  for (const failure of result.failures) console.error(`Falha: ${failure}`);
  await appendSummary(result);

  if (result.failures.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(`Prontidão aprovada: ${result.migrationCount} migrations e ativos de recuperação válidos.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Falha ao verificar prontidão: ${error.message}`);
    process.exitCode = 1;
  });
}
