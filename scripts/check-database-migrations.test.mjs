import { describe, expect, it } from 'vitest';
import { validateMigrations } from './check-database-migrations.mjs';

describe('database migration policy', () => {
  it('accepts a modern public table protected by RLS', () => {
    const result = validateMigrations([
      {
        name: '20260824000000_create_safe_table.sql',
        content: 'create table public.safe_table (id uuid); alter table public.safe_table enable row level security;',
      },
    ]);
    expect(result.failures).toEqual([]);
  });

  it('rejects unsafe privileged functions and public tables', () => {
    const result = validateMigrations([
      {
        name: '20260824000001_create_unsafe_objects.sql',
        content: 'create table public.open_data (id uuid); create function public.unsafe() returns void security definer language sql as $$ select 1 $$;',
      },
    ]);
    expect(result.failures).toHaveLength(2);
  });
});
