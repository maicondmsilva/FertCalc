import React from 'react';
import { User } from '../types';

interface PricingReportProps {
  currentUser: User;
}

export default function PricingReport({ currentUser }: PricingReportProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-stone-800">Relatório de Precificação</h2>
      <p className="text-stone-500">Detalhes e análises das precificações.</p>
      {/* Add pricing report content here */}
    </div>
  );
}
