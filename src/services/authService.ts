/**
 * FertCalc Pro — Auth Service
 * Camada de autenticação segura usando Supabase Auth.
 * Inclui fallback para usuários legacy (com senha na tabela app_users).
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
 * FALLBACK: Se o usuário não existir no Supabase Auth, tenta autenticar com senha legacy.
 */
export async function signIn(emailOrNickname: string, password: string): Promise<AuthResult> {
  try {
    let emailToUse = emailOrNickname;
    let profile: User | null = null;

    // Se não parece um e-mail, busca pelo nickname para obter o e-mail real
    if (!emailOrNickname.includes('@')) {
      profile = await getUserByEmail(emailOrNickname);
      if (!profile) {
        return { user: null, error: 'Usuário não encontrado. Verifique seu e-mail/usuário.' };
      }
      emailToUse = profile.email;
    }

    // Tentativa 1: Autenticação via Supabase Auth (senhas com hash bcrypt)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    // Se autenticou no Supabase Auth com sucesso
    if (!error && data.user) {
      // Carrega perfil completo da tabela app_users
      profile = await getUserByEmail(emailToUse);
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
    }

    // Tentativa 2: Fallback para usuários legacy (senha na tabela app_users)
    logger.warn('[authService] Supabase Auth failed, trying legacy authentication');
    
    // Busca o usuário na tabela
    if (!profile) {
      profile = await getUserByEmail(emailToUse);
    }

    if (!profile) {
      return { user: null, error: 'Usuário não encontrado. Verifique seu e-mail/usuário.' };
    }

    // Verifica se tem senha legacy na tabela
    if (!profile.password) {
      logger.warn('[authService] User has no legacy password and Supabase Auth failed');
      if (error?.message.includes('Invalid login credentials')) {
        return { user: null, error: 'Senha incorreta. Verifique e tente novamente.' };
      }
      if (error?.message.includes('Email not confirmed')) {
        return { user: null, error: 'E-mail não confirmado. Verifique sua caixa de entrada.' };
      }
      return { user: null, error: 'Erro ao acessar o sistema. Tente novamente.' };
    }

    // Autentica usando senha legacy (texto plano - inseguro, mas necessário para compatibilidade)
    if (profile.password === password) {
      logger.warn('[authService] Legacy authentication successful for user:', emailToUse);
      
      if (!profile.ativo && profile.role !== 'master') {
        return {
          user: null,
          error: 'Esta conta está desativada. Entre em contato com o administrador.',
        };
      }

      // Cria uma sessão "fake" no localStorage para manter a compatibilidade
      // (O restoreSession vai funcionar com base na tabela app_users)
      try {
        localStorage.setItem('fertcalc_legacy_user', JSON.stringify(profile));
      } catch (err) {
        logger.error('[authService] Failed to store legacy session:', err);
      }

      return { user: profile, error: null };
    }

    // Senha legacy incorreta
    return { user: null, error: 'Senha incorreta. Verifique e tente novamente.' };
  } catch (err) {
    logger.error('[authService] Unexpected error in signIn:', err);
    return { user: null, error: 'Erro ao conectar ao servidor. Tente novamente.' };
  }
}

/**
 * Logout seguro via Supabase Auth + limpa sessão legacy.
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
    // Limpa sessão legacy também
    localStorage.removeItem('fertcalc_legacy_user');
  } catch (err) {
    logger.error('[authService] Error in signOut:', err);
  }
}

/**
 * Recuperação de senha real via Supabase Auth (envia e-mail de reset).
 * Nota: não funciona para usuários legacy (sem conta no Supabase Auth).
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
 * Fallback: tenta restaurar sessão legacy do localStorage.
 */
export async function restoreSession(): Promise<User | null> {
  try {
    // Tentativa 1: Restaurar sessão do Supabase Auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (session?.user?.email) {
      const profile = await getUserByEmail(session.user.email);
      if (profile && (profile.ativo || profile.role === 'master')) {
        return profile;
      }
    }

    // Tentativa 2: Restaurar sessão legacy do localStorage
    const legacyUserJson = localStorage.getItem('fertcalc_legacy_user');
    if (legacyUserJson) {
      try {
        const legacyUser = JSON.parse(legacyUserJson) as User;
        
        // Verifica se o usuário ainda existe e está ativo
        const currentProfile = await getUserByEmail(legacyUser.email);
        if (currentProfile && (currentProfile.ativo || currentProfile.role === 'master')) {
          logger.warn('[authService] Restored legacy session for user:', legacyUser.email);
          return currentProfile;
        }
        
        // Usuário não existe mais ou está desativado
        localStorage.removeItem('fertcalc_legacy_user');
      } catch (err) {
        logger.error('[authService] Failed to parse legacy user:', err);
        localStorage.removeItem('fertcalc_legacy_user');
      }
    }

    return null;
  } catch (err) {
    logger.error('[authService] Error restoring session:', err);
    return null;
  }
}
