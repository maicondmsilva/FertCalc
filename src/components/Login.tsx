import React, { useState } from 'react';
import { Lock, Mail, Leaf, ShieldCheck, KeyRound } from 'lucide-react';
import { User } from '../types';
import { signIn, resetPassword } from '../services/authService';
import { updateUser } from '../services/db';
import { supabase } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
  forceChangePasswordUserId?: string;
  onPasswordChanged?: (user: User) => void;
}

export default function Login({ onLogin, forceChangePasswordUserId, onPasswordChanged }: LoginProps) {
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [resetMessage, setResetMessage] = useState('');
  const [emailOrNickname, setEmailOrNickname] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isForceChange = !!forceChangePasswordUserId;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { user, error: authError } = await signIn(emailOrNickname, password);

    if (authError) {
      setError(authError);
    } else if (user) {
      onLogin(user);
    }

    setLoading(false);
  };

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMessage('');

    const { success, message } = await resetPassword(resetEmail.trim());

    if (success) {
      setResetMessage(message);
    } else {
      setError(message);
    }

    setLoading(false);
  };

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Atualizar a senha no Supabase Auth para a sessão ativa
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) {
        throw new Error(authError.message);
      }

      // 2. Atualizar no banco de dados
      await updateUser(forceChangePasswordUserId!, { requer_alteracao_senha: false });

      // 3. Carregar o perfil atualizado do app_users
      const { data: userProfile, error: dbError } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', forceChangePasswordUserId)
        .single();

      if (dbError || !userProfile) {
        throw new Error('Falha ao recarregar perfil após a atualização.');
      }

      const updatedUser: User = {
        id: userProfile.id,
        idNumeric: userProfile.id_numeric,
        email: userProfile.email,
        name: userProfile.name,
        nickname: userProfile.nickname || userProfile.custom_code || '',
        ativo: !!userProfile.ativo,
        role: userProfile.role,
        managedUserIds: userProfile.managed_user_ids || [],
        filiais_permitidas: userProfile.filiais_permitidas || [],
        permissions: userProfile.permissions || {},
        requer_alteracao_senha: false,
      };

      if (onPasswordChanged) {
        onPasswordChanged(updatedUser);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className={`max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border ${
        isForceChange ? 'border-amber-300 shadow-amber-100/50' : 'border-stone-200'
      } transition-all duration-300`}>
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isForceChange ? 'bg-amber-100' : 'bg-emerald-100'
          }`}>
            {isForceChange ? (
              <ShieldCheck className="w-8 h-8 text-amber-600 animate-pulse" aria-hidden="true" />
            ) : (
              <Leaf className="w-8 h-8 text-emerald-600" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-3xl font-black text-stone-800 tracking-tight">
            FertCalc <span className={isForceChange ? 'text-amber-500' : 'text-emerald-600'}>Pro</span>
          </h1>
          <p className="text-stone-500 text-sm mt-2 font-medium">
            {isForceChange 
              ? 'Primeiro Acesso - Defina sua Nova Senha' 
              : view === 'login' 
                ? 'Entre com suas credenciais' 
                : 'Recupere sua senha'
            }
          </p>
        </div>

        {isForceChange ? (
          <form onSubmit={handleForceChangePassword} className="space-y-6" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
              >
                {error}
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 space-y-2">
              <div className="flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Atenção:</strong> Por motivos de segurança, você deve definir uma nova senha personalizada no seu primeiro acesso antes de prosseguir para o painel.
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Nova Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-stone-800"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Confirme a Nova Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-stone-800"
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-amber-200 active:scale-[0.98]"
            >
              {loading ? 'Salvando...' : 'Salvar Senha e Acessar'}
            </button>
          </form>
        ) : view === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
              >
                {error}
              </div>
            )}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                E-mail ou usuário
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="login-email"
                  type="text"
                  value={emailOrNickname}
                  onChange={(e) => setEmailOrNickname(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-stone-800"
                  placeholder="seu@email.com ou joao.silva"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-stone-800"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('forgot');
                    setError('');
                    setResetMessage('');
                  }}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
            >
              {loading ? 'Verificando...' : 'Acessar Sistema'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailReset} className="space-y-6" noValidate>
            {error && (
              <div
                role="alert"
                className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100"
              >
                {error}
              </div>
            )}
            {resetMessage && (
              <div
                role="status"
                className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg border border-emerald-100"
              >
                {resetMessage}
              </div>
            )}
            <div>
              <label
                htmlFor="reset-email"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                E-mail de Cadastro
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-stone-800"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-2">
                Enviaremos um link de recuperação para o e-mail informado acima.
              </p>
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || !!resetMessage}
                aria-busy={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-emerald-200"
              >
                {loading ? 'Processando...' : 'Enviar Link de Recuperação'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setError('');
                }}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-2 rounded-lg transition-all"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
