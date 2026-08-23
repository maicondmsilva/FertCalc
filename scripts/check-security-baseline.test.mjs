import { describe, expect, it } from 'vitest';
import { scanFiles } from './check-security-baseline.mjs';

describe('security baseline', () => {
  it('accepts public Supabase configuration', () => {
    expect(
      scanFiles([{ path: '.env.example', content: 'VITE_SUPABASE_URL=https://demo.supabase.co' }])
    ).toEqual([]);
  });

  it('rejects private keys and frontend service-role variables', () => {
    const findings = scanFiles([
      { path: 'unsafe.env', content: 'VITE_SUPABASE_SERVICE_ROLE=unsafe' },
      { path: 'private.md', content: '-----BEGIN PRIVATE KEY-----' },
    ]);
    expect(findings).toHaveLength(2);
  });
});
