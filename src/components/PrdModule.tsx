import React, { useState, useEffect } from 'react';
import PrdDocument from './PrdDocument';
import { User } from '../types';

interface PrdModuleProps {
  currentUser: User;
}

export default function PrdModule({ currentUser }: PrdModuleProps) {
  const [prdContent, setPrdContent] = useState('');

  useEffect(() => {
    // In a real application, you might fetch this from an API
    // For now, we'll load it from a static markdown file
    fetch('/prd.md')
      .then(response => response.text())
      .then(text => setPrdContent(text));
  }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-stone-800">Documentação PRD</h2>
      <p className="text-stone-500 text-sm">Documento de Requisitos do Produto. Em constante evolução.</p>
      <PrdDocument content={prdContent} />
    </div>
  );
}
