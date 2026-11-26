/**
 * FertCalc Pro — Auth Service
 * Camada de autenticação segura usando Supabase Auth.
 * Substitui a comparação manual de senhas em texto plano.
 */

import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import { mapUser } from './db';
import type { User } from '../types';
import { logger } from '../utils/logger';

export const INVALID_CREDENTIALS = 'E-mail/usuário ou senha incorretos.';
export const TOO_MANY_ATTEMPTS =
  'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';

/**
 * Mensagem para o usuário. Credencial errada recebe sempre a mesma mensagem,
 * sem dizer se o e-mail existe (antes dizia "Senha incorreta", o que confirmava
 * que a conta existia).
 */
export function authErrorMessage(error: {
  message?: string;
  status?: number;
  code?: string;
}): string {
  const message = String(error.message || '');
  if (error.status === 429 || /rate limit|too many/i.test(message)) return TOO_MANY_ATTEMPTS;
  if (
    /invalid login credentials|invalid_credentials/i.test(message) ||
    error.code === 'invalid_credentials'
  )
    return INVALID_CREDENTIALS;
  if (/email not confirmed/i.test(message))
    return 'E-mail não confirmado. Verifique sua caixa de entrada.';
  if (/fetch|network/i.test(message)) return 'Sem conexão com o servidor. Verifique a internet.';
  return 'Não foi possível entrar agora. Tente novamente.';
}

/** Perfil do app pelo id do usuário autenticado. */
export async function getAppUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase.from('app_users').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapUser(data);
}

/** Mensagem para falhas ao definir nova senha. */
export function passwordUpdateErrorMessage(error: { message?: string; code?: string }): string {
  const message = String(error.message || '');
  if (error.code === 'same_password' || /different from the old|same.*password/i.test(message))
    return 'A nova senha precisa ser diferente da atual.';
  if (error.code === 'weak_password' || /weak|at least|characters/i.test(message))
    return 'Senha fraca: use pelo menos 8 caracteres, com letras e números.';
  if (/session|jwt|expired/i.test(message))
    return 'Sua sessão expirou. Entre novamente ou solicite um novo link.';
  if (/rate limit|too many/i.test(message)) return TOO_MANY_ATTEMPTS;
  return 'Não foi possível salvar a nova senha. Tente novamente.';
}

/**
 * Primeiro acesso: troca a senha, encerra a exigência (o banco confere que a
 * senha mudou) e recarrega o perfil completo.
 */
export async function completeFirstAccess(
  userId: string,
  newPassword: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
    if (passwordError) return { user: null, error: passwordUpdateErrorMessage(passwordError) };
    const { error: flagError } = await supabase
      .from('app_users')
      .update({ requer_alteracao_senha: false })
      .eq('id', userId);
    if (flagError)
      return {
        user: null,
        error: 'Senha salva, mas não foi possível concluir o primeiro acesso. Tente de novo.',
      };
    const user = await getAppUserById(userId);
    if (!user)
      return { user: null, error: 'Não foi possível recarregar seu perfil. Entre novamente.' };
    return { user, error: null };
  } catch (err) {
    logger.error('[authService] completeFirstAccess:', err);
    return { user: null, error: 'Sem conexão com o servidor. Tente novamente.' };
  }
}

const SESSION_ENDED =
  'Sua sessão foi encerrada (saída em outro aparelho ou guia). Entre novamente para continuar.';

/**
 * Chama uma função administrativa (edge function) com o token atual. Se a
 * resposta for 401 — token vencido ou sessão encerrada em outro aparelho —
 * renova a sessão e tenta uma vez de novo. Sem sessão renovável, devolve null
 * e a tela pede para entrar novamente.
 */
export async function postAdminFunction(
  name: string,
  body: unknown
): Promise<globalThis.Response | null> {
  const call = (token: string) =>
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const first = await call(token);
  if (first.status !== 401) return first;
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  const freshToken = refreshed.session?.access_token;
  if (error || !freshToken) return null;
  return call(freshToken);
}

export interface AuthResult {
  user: User | null;
  error: string | null;
}

export interface CreateAuthUserPayload {
  email: string;
  password: string;
  name?: string;
  nickname?: string;
  role?: string;
  ativo?: boolean;
  managed_user_ids?: string[];
  permissions?: Record<string, unknown>;
  filiais_permitidas?: string[];
  requer_alteracao_senha?: boolean;
  access_profile_id?: string;
}

export interface UpdateAuthUserPayload {
  user_id: string;
  email: string;
  name: string;
  nickname: string;
  role: string;
  ativo: boolean;
  managed_user_ids: string[];
  permissions: Record<string, unknown>;
  filiais_permitidas: string[];
  access_profile_id?: string;
}

export async function adminUpdateAuthUser(
  payload: UpdateAuthUserPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await postAdminFunction('admin-update-user', payload);
    if (!response) return { success: false, error: SESSION_ENDED };
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 404) {
      return {
        success: false,
        error:
          'Serviço de atualização de usuários indisponível. Publique a função admin-update-user.',
      };
    }
    if (response.status === 401) return { success: false, error: SESSION_ENDED };
    if (response.status === 403) {
      return { success: false, error: body.error || 'Sem permissão para alterar este usuário.' };
    }
    return response.ok
      ? { success: true }
      : { success: false, error: body.error || 'Erro ao atualizar usuário' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Login seguro: autentica via Supabase Auth e carrega o perfil do usuário.
 * Autentica diretamente por e-mail. O perfil só é consultado depois que a
 * sessão existe, para não expor a tabela de usuários a visitantes anônimos.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const identifier = email.trim().toLowerCase();
    let data;
    let error;

    if (identifier.includes('@')) {
      ({ data, error } = await supabase.auth.signInWithPassword({ email: identifier, password }));
    } else {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-with-identifier`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ identifier, password }),
        }
      );
      const body = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
      };
      if (response.status === 429) return { user: null, error: TOO_MANY_ATTEMPTS };
      if (!response.ok || !body.access_token || !body.refresh_token) {
        return { user: null, error: INVALID_CREDENTIALS };
      }
      const sessionResult = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      data = sessionResult.data;
      error = sessionResult.error;
    }

    if (error) {
      logger.warn('[authService] signIn error:', error.message);
      return { user: null, error: authErrorMessage(error) };
    }

    if (!data.user) {
      return { user: null, error: INVALID_CREDENTIALS };
    }

    // Perfil pelo id da sessão (o id do app_users é o mesmo do Supabase Auth).
    const profile = await getAppUserById(data.user.id);
    if (!profile) {
      await supabase.auth.signOut({ scope: 'local' });
      return { user: null, error: 'Perfil de usuário não encontrado. Contate o administrador.' };
    }

    if (!profile.ativo && profile.role !== 'master') {
      await supabase.auth.signOut({ scope: 'local' });
      return {
        user: null,
        error: 'Esta conta está desativada. Entre em contato com o administrador.',
      };
    }

    return { user: profile, error: null };
  } catch (err) {
    logger.error('[authService] Unexpected error in signIn:', err);
    return { user: null, error: 'Erro ao conectar ao servidor. Tente novamente.' };
  }
}

/**
 * Logout seguro via Supabase Auth.
 */
export async function signOut(): Promise<void> {
  try {
    // Só este aparelho: o padrão ("global") derrubava a sessão do usuário em
    // todos os aparelhos, e as telas abertas passavam a falhar ao salvar.
    await supabase.auth.signOut({ scope: 'local' });
  } catch (err) {
    logger.error('[authService] Error in signOut:', err);
  }
}

/**
 * Recuperação de senha real via Supabase Auth (envia e-mail de reset).
 */
export async function resetPassword(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Capacitor.isNativePlatform()
        ? 'fertcalc://auth/reset-password'
        : `${window.location.origin}/reset-password`,
    });

    if (error) {
      logger.warn('[authService] resetPassword error:', error.message);
      return { success: false, message: 'Erro ao enviar e-mail de recuperação. Tente novamente.' };
    }

    return {
      success: true,
      message:
        'Um link de recuperação foi enviado para seu e-mail. Verifique sua caixa de entrada.',
    };
  } catch (err) {
    logger.error('[authService] Unexpected error in resetPassword:', err);
    return { success: false, message: 'Erro inesperado. Tente novamente.' };
  }
}

/**
 * Restaura a sessão do usuário logado ao recarregar a página.
 * Usa a sessão do Supabase Auth (cookie/localStorage gerenciado internamente).
 */
export async function restoreSession(): Promise<User | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    const profile = await getAppUserById(session.user.id);
    if (!profile || (!profile.ativo && profile.role !== 'master')) {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }

    return profile;
  } catch (err) {
    logger.error('[authService] Error restoring session:', err);
    return null;
  }
}

/**
 * Cria um usuário no Supabase Auth (auth.users) via Edge Function admin-create-user.
 * Usa supabase.auth.admin.createUser para criar o usuário já confirmado,
 * sem disparar e-mail de confirmação, e sem expor a service_role key no frontend.
 */
export async function createAuthUser(
  payloadOrEmail: CreateAuthUserPayload | string,
  passwordArg?: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const payload: CreateAuthUserPayload =
      typeof payloadOrEmail === 'string'
        ? { email: payloadOrEmail, password: passwordArg ?? '' }
        : payloadOrEmail;

    const res = await postAdminFunction('admin-create-user', payload);
    if (!res) return { success: false, error: SESSION_ENDED };

    let responseBody: { user_id?: string; userId?: string; code?: string; error?: string } = {};
    const contentType =
      typeof res.headers?.get === 'function' ? (res.headers.get('content-type') ?? '') : '';
    if (contentType.includes('application/json')) {
      responseBody = (await res.json()) as {
        user_id?: string;
        userId?: string;
        code?: string;
        error?: string;
      };
    } else {
      const text = await res.text();
      responseBody = { error: text };
    }

    if (!res.ok) {
      let message = responseBody.error ?? 'Erro ao criar usuário no Auth';
      if (res.status === 404) {
        message =
          'Função admin-create-user não encontrada. Faça o deploy com: supabase functions deploy admin-create-user';
      } else if (res.status === 403) {
        message = 'Apenas usuários com nível Master/Admin podem criar novos usuários.';
      } else if (res.status === 401) {
        message = SESSION_ENDED;
      } else if (res.status === 422) {
        if (responseBody.code === 'email_exists') {
          message = 'Este e-mail já está cadastrado no autenticador.';
        } else if (responseBody.code === 'weak_password') {
          message = 'Senha fraca. Use pelo menos 6 caracteres com maior complexidade.';
        } else {
          message = responseBody.error ?? 'Dados inválidos para criação do usuário.';
        }
      }
      logger.warn('[authService] createAuthUser error:', message);
      return { success: false, error: message };
    }

    const userId = responseBody.user_id ?? responseBody.userId;
    if (!userId) {
      logger.warn('[authService] createAuthUser invalid response: missing user_id');
      return { success: false, error: 'Resposta inválida da função de autenticação.' };
    }

    return { success: true, userId };
  } catch (err: unknown) {
    logger.error('[authService] Unexpected error in createAuthUser:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Atualiza a senha do usuário logado no Supabase Auth.
 * Funciona apenas para o próprio usuário autenticado
 * (ex: via página de redefinição de senha com link por e-mail).
 */
export async function updateAuthPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      logger.warn('[authService] updateAuthPassword error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    logger.error('[authService] Unexpected error in updateAuthPassword:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Atualiza a senha de qualquer usuário via Edge Function admin-update-password.
 * Usa supabase.auth.admin.updateUserById no servidor, sem expor a service_role key.
 * Deve ser chamada por administradores ao redefinir a senha de outro usuário.
 */
export async function adminUpdateAuthPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await postAdminFunction('admin-update-password', {
      user_id: userId,
      new_password: newPassword,
    });
    if (!res) return { success: false, error: SESSION_ENDED };

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      const message = err.error ?? 'Erro ao atualizar senha no Auth';
      logger.warn('[authService] adminUpdateAuthPassword error:', message);
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err: unknown) {
    logger.error('[authService] Unexpected error in adminUpdateAuthPassword:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Exclui um usuário do Supabase Auth e da tabela app_users via Edge Function admin-delete-user.
 * Usa supabase.auth.admin.deleteUser no servidor, sem expor a service_role key.
 * Deve ser chamada por administradores ao excluir um usuário do sistema.
 */
export async function adminDeleteAuthUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await postAdminFunction('admin-delete-user', { user_id: userId });
    if (!res) return { success: false, error: SESSION_ENDED };

    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      const message = err.error ?? 'Erro ao excluir usuário no Auth';
      if (res.status === 404) {
        const notFoundMessage =
          'Função admin-delete-user não encontrada; o perfil local será removido pelo sistema.';
        logger.warn('[authService] admin-delete-user not deployed, using profile fallback');
        return { success: false, error: notFoundMessage };
      }
      logger.warn('[authService] adminDeleteAuthUser error:', message);
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err: unknown) {
    logger.error('[authService] Unexpected error in adminDeleteAuthUser:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
