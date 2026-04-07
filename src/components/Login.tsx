import React, { useState } from 'react';
import { Lock, Mail, Leaf } from 'lucide-react';
import { User } from '../types';
import { signIn, resetPassword } from '../services/authService';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [resetMessage, setResetMessage] = useState('');
  const [emailOrNickname, setEmailOrNickname] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { user, error: authError } = await signIn(emailOrNickname.trim(), password);

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-stone-200 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Leaf className="w-8 h-8 text-emerald-600" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-black text-stone-800 tracking-tight">
            FertCalc <span className="text-emerald-600">Pro</span>
          </h1>
          <p className="text-stone-500 text-sm mt-2">
            {view === 'login' ? 'Entre com suas credenciais' : 'Recupere sua senha'}
          </p>
        </div>

        {view === 'login' ? (
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
                E-mail ou Usuário (Nickname)
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
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
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
