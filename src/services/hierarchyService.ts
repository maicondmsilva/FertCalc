import { supabase } from './supabase';

export interface UserManagementCapabilities {
  canManage: boolean;
  canDelete: boolean;
}

export async function getUserManagementCapabilities(
  userIds: string[]
): Promise<Record<string, UserManagementCapabilities>> {
  const entries = await Promise.all(
    userIds.map(async (userId) => {
      const [{ data: canManage }, { data: canDelete }] = await Promise.all([
        supabase.rpc('can_manage_user', { target_user_id: userId }),
        supabase.rpc('can_delete_user', { target_user_id: userId }),
      ]);
      return [userId, { canManage: canManage === true, canDelete: canDelete === true }] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function canChangeUserRole(userId: string, role: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_change_role', {
    target_user_id: userId,
    new_role: role,
  });
  if (error) throw error;
  return data === true;
}
