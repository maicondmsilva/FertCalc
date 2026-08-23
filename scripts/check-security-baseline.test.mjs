import { describe, expect, it } from 'vitest';
import { scanFiles } from './check-security-baseline.mjs';

describe('security baseline', () => {
  it('accepts public Supabase configuration', () => {
    expect(
      scanFiles([{ path: '.env.example', content: 'VITE_SUPABASE_URL=https://demo.supabase.co' }])
    ).toEqual([]);
  });

  it('rejects private keys and frontend service-role variables', () => {
    const privateKeyMarker = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
    const unsafeFrontendVariable = ['VITE_SUPABASE', 'SERVICE_ROLE'].join('_');
    const findings = scanFiles([
      { path: 'unsafe.env', content: `${unsafeFrontendVariable}=unsafe` },
      { path: 'private.md', content: privateKeyMarker },
    ]);
    expect(findings).toHaveLength(2);
  });
});
