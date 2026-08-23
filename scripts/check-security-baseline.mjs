import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SECRET_PATTERNS = [
  { name: 'chave secreta Supabase', pattern: /sb_secret_[A-Za-z0-9_-]{16,}/u },
  { name: 'chave privada', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  {
    name: 'service_role exposta',
    pattern: /service[_-]?role[^\n]{0,80}eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/iu,
  },
  {
    name: 'senha em URL PostgreSQL',
    pattern: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s$<{][^@\s]*@/iu,
  },
  { name: 'service_role no frontend', pattern: /VITE_[A-Z0-9_]*SERVICE[_-]?ROLE/iu },
];

const TEXT_FILE_PATTERN = /\.(?:cjs|css|env|example|html|js|json|jsx|md|mjs|sql|ts|tsx|toml|yaml|yml)$/iu;

export function scanFiles(files) {
  const findings = [];
  for (const file of files) {
    if (!TEXT_FILE_PATTERN.test(file.path) || file.path === 'package-lock.json') continue;
    for (const secret of SECRET_PATTERNS) {
      if (secret.pattern.test(file.content)) findings.push(`${file.path}: ${secret.name}`);
    }
  }
  return findings;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ path, content: readFileSync(path, 'utf8') }));
}

function main() {
  const findings = scanFiles(trackedFiles());
  if (findings.length > 0) {
    for (const finding of findings) console.error(`::error::${finding}`);
    process.exitCode = 1;
    return;
  }
  console.log('Nenhum segredo de alto risco foi encontrado nos arquivos versionados.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
