import React from 'react';
import { LayoutDashboard, Settings, ShieldCheck, Calculator, Database, Target, Users, UserCheck, Building2, BarChart3, CreditCard } from 'lucide-react';
import { User } from '../types';

interface HomeProps {
  currentUser: User;
  onSelectModule: (moduleId: 'pricing' | 'config' | 'prd' | 'managementReports' | 'expenses') => void;
}

export default function Home({ currentUser, onSelectModule }: HomeProps) {
  const modules = [
    {
      id: 'pricing',
      label: 'PRECIFICAÇÃO',
      description: 'Dashboard de vendas, cálculos, tabelas de preços, clientes e metas.',
      icon: Calculator,
      color: 'bg-emerald-600',
      hoverColor: 'hover:bg-emerald-700',
      textColor: 'text-emerald-600',
      allowed: true
    },
    {
      id: 'managementReports',
      label: 'RELATÓRIO DIÁRIO',
      description: 'Acompanhe o desempenho consolidado das unidades de negócio.',
      icon: BarChart3,
      color: 'bg-indigo-600',
      hoverColor: 'hover:bg-indigo-700',
      textColor: 'text-indigo-600',
      allowed: currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager'
    },
    {
      id: 'config',
      label: 'CONFIGURAÇÃO',
      description: 'Gerenciamento de usuários, filiais e personalização do sistema.',
      icon: Settings,
      color: 'bg-stone-800',
      hoverColor: 'hover:bg-stone-900',
      textColor: 'text-stone-800',
      allowed: currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager'
    },
    {
      id: 'prd',
      label: 'DOCUMENTAÇÃO PRD',
      description: 'Acesse o Documento de Requisitos do Produto do sistema.',
      icon: LayoutDashboard, // Placeholder icon, consider a document-related icon if available
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      textColor: 'text-blue-600',
      allowed: currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager'
    },
    {
      id: 'expenses',
      label: 'GASTOS CARTÃO',
      description: 'Controle de despesas do cartão de crédito corporativo com aprovações e relatórios.',
      icon: CreditCard,
      color: 'bg-purple-600',
      hoverColor: 'hover:bg-purple-700',
      textColor: 'text-purple-600',
      allowed: currentUser.role === 'master' || currentUser.role === 'admin' || currentUser.role === 'manager' || !!(currentUser.permissions as any)?.expenses
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-stone-800 mb-4">Bem-vindo, {currentUser.name}</h1>
        <p className="text-stone-500 text-lg">Selecione um módulo para começar a trabalhar.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {modules.filter(m => m.allowed).map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => onSelectModule(module.id as any)}
              className="group bg-white p-8 rounded-3xl shadow-sm border border-stone-200 hover:shadow-xl hover:border-emerald-200 transition-all duration-300 text-left flex flex-col items-start"
            >
              <div className={`${module.color} p-4 rounded-2xl text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <Icon className="w-8 h-8" />
              </div>
              <h2 className={`text-2xl font-black ${module.textColor} mb-2`}>{module.label}</h2>
              <p className="text-stone-500 leading-relaxed">{module.description}</p>
              <div className="mt-8 flex items-center text-sm font-bold text-stone-400 group-hover:text-emerald-600 transition-colors">
                Acessar módulo
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
          <div className="text-emerald-600 font-bold text-sm mb-2 uppercase tracking-wider">Status do Sistema</div>
          <p className="text-emerald-800 text-sm">Todos os serviços estão operando normalmente.</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <div className="text-blue-600 font-bold text-sm mb-2 uppercase tracking-wider">Suporte Técnico</div>
          <p className="text-blue-800 text-sm">Precisa de ajuda? Entre em contato com o suporte.</p>
        </div>
        <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
          <div className="text-stone-600 font-bold text-sm mb-2 uppercase tracking-wider">Versão</div>
          <p className="text-stone-800 text-sm">FertCalc Pro v2.5.0 - Fevereiro 2026</p>
        </div>
      </div>
    </div>
  );
}
