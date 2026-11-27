import React, { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { verificarAssinatura, type VerificacaoAssinatura } from '../../services/propostaService';
import { moedaProposta } from '../../utils/propostaDocumento';
import { getCompanyDisplayName } from '../../utils/companyBranding';

/**
 * Página pública (sem login) aberta pelo QR code do comprovante: confere se o
 * aceite (ou a recusa) é autêntico e se nada foi alterado depois.
 */
export default function VerificacaoAssinaturaPage({ codigo }: { codigo: string }) {
  const [dados, setDados] = useState<VerificacaoAssinatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    verificarAssinatura(codigo)
      .then((resultado) => ativo && setDados(resultado))
      .catch(
        (error: unknown) =>
          ativo && setErro(error instanceof Error ? error.message : 'Não foi possível verificar.')
      );
    return () => {
      ativo = false;
    };
  }, [codigo]);

  if (!dados && !erro) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando…
      </main>
    );
  }

  if (erro || !dados?.encontrada) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 font-black text-stone-900">Código não encontrado</p>
          <p className="mt-1 text-sm text-stone-500">
            {erro || `Nenhum comprovante com o código ${codigo}. Confira o código impresso.`}
          </p>
        </div>
      </main>
    );
  }

  const empresa = getCompanyDisplayName({
    companyName: dados.empresa?.nome || '',
    companyLogo: dados.empresa?.logo || '',
    showCompanyName: dados.empresa?.mostrarNome,
  });
  const moeda = dados.moeda === 'USD' ? 'USD' : 'BRL';
  const integra = Boolean(dados.integra);

  return (
    <main className="min-h-screen bg-stone-100 pb-8">
      <div className="mx-auto max-w-lg">
        <header className="bg-emerald-800 px-4 pb-5 pt-4 text-white">
          {(dados.empresa?.logo || empresa) && (
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 font-black text-emerald-800">
              {dados.empresa?.logo && (
                <img src={dados.empresa.logo} alt="" className="h-7 max-w-[140px] object-contain" />
              )}
              {empresa}
            </span>
          )}
          <h1 className="mt-3 text-xl font-black">Verificação de assinatura</h1>
          <p className="text-sm text-emerald-100">Código {dados.codigo}</p>
        </header>

        <div className="space-y-3 p-3">
          <section
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              integra ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            }`}
          >
            {integra ? (
              <ShieldCheck className="h-8 w-8 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-8 w-8 shrink-0 text-red-600" />
            )}
            <div>
              <p className={`font-black ${integra ? 'text-emerald-900' : 'text-red-900'}`}>
                {integra ? 'Documento autêntico' : 'Atenção: o registro foi alterado'}
              </p>
              <p className={`text-sm ${integra ? 'text-emerald-800' : 'text-red-800'}`}>
                {integra
                  ? 'O conteúdo confere com o que foi assinado eletronicamente.'
                  : 'O conteúdo atual não confere com o resumo gravado na assinatura.'}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <dl className="space-y-1.5">
              {[
                ['Proposta', dados.proposta],
                ['Cliente', dados.cliente],
                ['CPF/CNPJ', dados.documento],
                ['Resposta', dados.resposta === 'aceite' ? 'Aceite' : 'Recusa'],
                [
                  'Data e hora',
                  dados.respondidoEm ? new Date(dados.respondidoEm).toLocaleString('pt-BR') : '—',
                ],
              ].map(([label, valor]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="text-right font-semibold text-stone-900">{valor || '—'}</dd>
                </div>
              ))}
            </dl>
          </section>

          {dados.resposta === 'aceite' && (dados.itens || []).length > 0 && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
              <p className="mb-2 text-xs font-bold uppercase text-stone-500">Produtos aceitos</p>
              {(dados.itens || []).map((item) => (
                <p key={item.nome} className="flex justify-between gap-3">
                  <span>{item.nome}</span>
                  <b className="tabular-nums">
                    {Number(item.quantidade).toLocaleString('pt-BR')} t ·{' '}
                    {moedaProposta(Number(item.precoTonelada), moeda)}/t
                  </b>
                </p>
              ))}
              <p className="mt-2 flex justify-between border-t border-stone-100 pt-2 font-black">
                <span>Total</span>
                <span className="tabular-nums">
                  {moedaProposta(Number(dados.valorTotal) || 0, moeda)}
                </span>
              </p>
            </section>
          )}

          <p className="break-all px-1 text-[11px] text-stone-400">Resumo SHA-256: {dados.hash}</p>
        </div>
      </div>
    </main>
  );
}
