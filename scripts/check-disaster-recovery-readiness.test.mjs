import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateReadiness } from './check-disaster-recovery-readiness.mjs';

function createFixture({ duplicateMigration = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fertcalc-dr-'));
  for (const directory of ['docs', 'supabase/tests', 'supabase/migrations']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  writeFileSync(join(root, 'docs/DISASTER_RECOVERY_RUNBOOK.md'), 'runbook');
  writeFileSync(join(root, 'supabase/tests/disaster_recovery_verification.sql'), 'select 1;');
  writeFileSync(
    join(root, 'supabase/migrations/20260823140535_create_runtime_error_events.sql'),
    'select 1;'
  );
  if (duplicateMigration) {
    writeFileSync(join(root, 'supabase/migrations/20260823140535_duplicate.sql'), 'select 1;');
  }
  writeFileSync(join(root, '.gitignore'), 'backups/\n*.backup\n*.dump\n*.sql.gz\n');
  return root;
}

describe('disaster recovery readiness', () => {
  it('approves a complete recovery package', () => {
    const result = evaluateReadiness(createFixture());
    expect(result.failures).toEqual([]);
    expect(result.migrationCount).toBe(1);
  });

  it('rejects duplicate modern migration versions', () => {
    const result = evaluateReadiness(createFixture({ duplicateMigration: true }));
    expect(result.failures).toContain('Timestamps de migration duplicados: 20260823140535');
  });
});
