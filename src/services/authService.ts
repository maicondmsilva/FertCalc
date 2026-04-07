/**
 * FertCalc Pro — Auth Service
 * Camada de autenticação segura usando Supabase Auth.
 * Substitui a comparação manual de senhas em texto plano.
 */

import { supabase } from './supabase';
import { getUserByEmail } from './db';
import type { User } from '../types';
import { logger } from '../utils/logger';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Login seguro: autentica via Supabase Auth e carrega o perfil do usuário.
 * Suporta login por e-mail ou por nickname (busca o e-mail correspondente).
 */
export async function signIn(emailOrNickname: string, password: string): Promise<AuthResult> {
  try {
    let emailToUse = emailOrNickname;

    // Se não parece um e-mail, busca pelo nickname para obter o e-mail real
    if (!emailOrNickname.includes('@')) {
      const profile = await getUserByEmail(emailOrNickname);
      if (!profile) {
        return { user: null, error: 'Usuário não encontrado. Verifique seu e-mail/usuário.' };
      }
      emailToUse = profile.email;
    }

    // Autenticação via Supabase Auth (senhas com hash bcrypt)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error) {
      logger.warn('[authService] signIn error:', error.message);
      if (error.message.includes('Invalid login credentials')) {
        return { user: null, error: 'Senha incorreta. Verifique e tente novamente.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { user: null, error: 'E-mail não confirmado. Verifique sua caixa de entrada.' };
      }
      return { user: null, error: 'Erro ao acessar o sistema. Tente novamente.' };
    }

    if (!data.user) {
      return { user: null, error: 'Usuário não encontrado.' };
    }

    // Carrega perfil completo da tabela app_users
    const profile = await getUserByEmail(emailToUse);
    if (!profile) {
      return { user: null, error: 'Perfil de usuário não encontrado. Contate o administrador.' };
    }

    if (!profile.ativo && profile.role !== 'master') {
      await supabase.auth.signOut();
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
    await supabase.auth.signOut();
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
      redirectTo: `${window.location.origin}/reset-password`,
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
    if (!session?.user?.email) return null;

    const profile = await getUserByEmail(session.user.email);
    if (!profile || (!profile.ativo && profile.role !== 'master')) return null;

    return profile;
  } catch (err) {
    logger.error('[authService] Error restoring session:', err);
    return null;
  }
}
