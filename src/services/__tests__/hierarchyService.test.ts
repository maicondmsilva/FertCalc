import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: { rpc: rpcMock } }));

import { canChangeUserRole, getUserManagementCapabilities } from '../hierarchyService';

describe('hierarchyService', () => {
  beforeEach(() => rpcMock.mockReset());

  it('obtém as capacidades do banco, sem recalcular papéis no frontend', async () => {
    rpcMock.mockResolvedValueOnce({ data: true }).mockResolvedValueOnce({ data: false });
    const result = await getUserManagementCapabilities(['target-1']);
    expect(result['target-1']).toEqual({ canManage: true, canDelete: false });
    expect(rpcMock).toHaveBeenCalledWith('can_manage_user', { target_user_id: 'target-1' });
    expect(rpcMock).toHaveBeenCalledWith('can_delete_user', { target_user_id: 'target-1' });
  });

  it('consulta a política can_change_role', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    await expect(canChangeUserRole('target-1', 'master')).resolves.toBe(false);
  });
});
