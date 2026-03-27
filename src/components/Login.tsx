import React, { useState } from 'react';
import { Lock, Mail, Leaf } from 'lucide-react';
import { User } from '../types';
import { getUserByEmail, requestPasswordReset } from '../services/db';

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

    try {
      // Tenta buscar por e-mail ou por nickname
      const user = await getUserByEmail(emailOrNickname);

      if (user) {
         if (!user.ativo && user.role !== 'master') {
          setError('Esta conta está desativada. Entre em contato com o administrador.');
          return;
        }

        if (user.password === password) {
          onLogin(user);
        } else {
          setError('Senha incorreta. Verifique e tente novamente.');
        }
      } else {
        setError('Usuário não encontrado. Verifique seu e-mail/usuário.');
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMessage('');

    try {
      const { success, message } = await requestPasswordReset(resetEmail);
      if (success) {
        setResetMessage(message);
      } else {
        setError(message);
      }
    } catch (err) {
      setError('Erro ao processar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-stone-200 transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Leaf className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-black text-stone-800 tracking-tight">
            FertCalc <span className="text-emerald-600">Pro</span>
          </h1>
          <p className="text-stone-500 font-medium text-sm mt-1">fertcalc.vercel.app</p>
          <p className="text-stone-500 text-sm">
            {view === 'login' ? 'Entre com suas credenciais' : 'Recupere sua senha'}
          </p>
        </div>

        {view === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 animate-pulse">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">E-mail ou Usuário (Nickname)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
                <input
                  type="text"
                  value={emailOrNickname}
                  onChange={(e) => setEmailOrNickname(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="seu@email.com ou joao.silva"
                  required
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-stone-700">Senha</label>
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
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-emerald-200 active:scale-[0.98]"
            >
              {loading ? 'Verificando...' : 'Acessar Sistema'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleEmailReset} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}
            {resetMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg border border-emerald-100">
                {resetMessage}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">E-mail de Cadastro</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="seu@email.com"
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
