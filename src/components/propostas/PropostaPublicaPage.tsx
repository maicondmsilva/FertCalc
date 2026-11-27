import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import {
  getPropostaPublica,
  responderProposta,
  type PropostaPublica,
} from '../../services/propostaService';
import { createComprovantePdf, moedaProposta } from '../../utils/propostaDocumento';
import { diasParaVencer, formatDataBr, formatNumeroProposta } from '../../utils/propostaModel';
import { documentoValido, formatarDocumento } from '../../utils/documento';
import { getCompanyDisplayName } from '../../utils/companyBranding';
import { saveOrSharePdf } from '../../utils/pdfDelivery';
import { qrDaVerificacao } from './propostaQr';

const parseQtd = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0;

/**
 * Página que o cliente abre pelo link (sem login): escolhe produtos e
 * quantidades e aceita, ou recusa. Responde uma única vez.
 */
export default function PropostaPublicaPage({ token }: { token: string }) {
  const [dados, setDados] = useState<PropostaPublica | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [documento, setDocumento] = useState('');
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await getPropostaPublica(token);
      setDados(resultado);
      const itens = resultado.itens || [];
      setMarcados(Object.fromEntries(itens.map((item) => [item.id, true])));
      setQuantidades(
        Object.fromEntries(
          itens.map((item) => [
            item.id,
            item.quantidadeSugerida ? String(item.quantidadeSugerida).replace('.', ',') : '',
          ])
        )
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível abrir a proposta.');
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const proposta = dados?.proposta;
  const itens = useMemo(() => dados?.itens || [], [dados]);
  const moeda = proposta?.moeda || 'BRL';
  const escolhidos = itens.filter(
    (item) => marcados[item.id] && parseQtd(quantidades[item.id] || '') > 0
  );
  const totalToneladas = escolhidos.reduce(
    (total, item) => total + parseQtd(quantidades[item.id]),
    0
  );
  const totalValor = escolhidos.reduce(
    (total, item) => total + parseQtd(quantidades[item.id]) * item.precoTonelada,
    0
  );
  const empresaNome = getCompanyDisplayName({
    companyName: dados?.empresa?.nome || '',
    companyLogo: dados?.empresa?.logo || '',
    showCompanyName: dados?.empresa?.mostrarNome,
  });

  const enviar = async (tipo: 'aceite' | 'recusa') => {
    setProblema(null);
    if (!documentoValido(documento)) {
      setProblema('Informe um CPF ou CNPJ válido.');
      return;
    }
    if (tipo === 'aceite' && escolhidos.length === 0) {
      setProblema('Marque ao menos um produto e informe a quantidade.');
      return;
    }
    setEnviando(true);
    try {
      await responderProposta({
        token,
        tipo,
        documento,
        itens: escolhidos.map((item) => ({
          id: item.id,
          quantidade: parseQtd(quantidades[item.id]),
        })),
        motivo: tipo === 'recusa' ? motivo : undefined,
      });
      await carregar();
    } catch (error) {
      setProblema(error instanceof Error ? error.message : 'Não foi possível enviar a resposta.');
    } finally {
      setEnviando(false);
    }
  };

  const baixarComprovante = async () => {
    if (!proposta || !dados?.resposta) return;
    const doc = createComprovantePdf({
      numero: proposta.numero,
      clienteNome: proposta.clienteNome,
      vendedor: proposta.vendedor,
      moeda,
      resposta: dados.resposta,
      settings: {
        companyName: dados.empresa?.nome || '',
        companyLogo: dados.empresa?.logo || '',
        showCompanyName: dados.empresa?.mostrarNome,
      },
      ...(await qrDaVerificacao(dados.resposta)),
    });
    await saveOrSharePdf(
      doc,
      `comprovante-${formatNumeroProposta(proposta.numero)}.pdf`,
      'Comprovante'
    );
  };

  const cabecalho = (titulo: string, subtitulo: string) => (
    <header className="bg-emerald-800 px-4 pb-5 pt-4 text-white">
      {(dados?.empresa?.logo || empresaNome) && (
        <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 font-black text-emerald-800">
          {dados?.empresa?.logo && (
            <img src={dados.empresa.logo} alt="" className="h-7 max-w-[140px] object-contain" />
          )}
          {empresaNome}
        </span>
      )}
      <h1 className="mt-3 text-xl font-black">{titulo}</h1>
      <p className="text-sm text-emerald-100">{subtitulo}</p>
    </header>
  );

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Abrindo a proposta…
      </main>
    );
  }

  if (erro || !dados?.encontrada || !proposta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 p-6">
        <div className="max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <XCircle className="mx-auto h-10 w-10 text-stone-400" />
          <p className="mt-3 font-bold text-stone-800">Proposta não encontrada</p>
          <p className="mt-1 text-sm text-stone-500">
            {erro || 'Confira o link recebido ou fale com seu vendedor.'}
          </p>
        </div>
      </main>
    );
  }

  const numero = formatNumeroProposta(proposta.numero);
  const resposta = dados.resposta;

  // Já respondida (ou vencida / cancelada).
  if (!proposta.podeResponder) {
    return (
      <main className="min-h-screen bg-stone-100">
        <div className="mx-auto max-w-lg">
          {resposta
            ? cabecalho(
                resposta.tipo === 'aceite' ? 'Proposta aceita' : 'Proposta recusada',
                `${numero} · ${new Date(resposta.respondidoEm).toLocaleString('pt-BR')}`
              )
            : cabecalho(`Proposta ${numero}`, `Válida até ${formatDataBr(proposta.validaAte)}`)}
          <div className="space-y-3 p-3">
            {resposta ? (
              <>
                <section className="rounded-2xl border border-stone-200 bg-white p-4">
                  <p className="flex items-center gap-2 font-black text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    {resposta.tipo === 'aceite'
                      ? 'Obrigado! Seu aceite foi registrado.'
                      : 'Sua resposta foi registrada.'}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {proposta.vendedor
                      ? `${proposta.vendedor} foi avisado(a).`
                      : 'O vendedor foi avisado.'}
                  </p>
                  {resposta.codigoVerificacao && (
                    <p className="mt-2 text-xs text-stone-500">
                      Assinado eletronicamente · código de verificação{' '}
                      <span className="font-mono font-bold text-stone-700">
                        {resposta.codigoVerificacao}
                      </span>
                    </p>
                  )}
                </section>
                {resposta.tipo === 'aceite' && (
                  <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
                    <p className="text-xs font-bold uppercase text-stone-500">Produtos aceitos</p>
                    {resposta.itens.map((item) => (
                      <p key={item.id} className="mt-1 flex justify-between">
                        <span>{item.nome}</span>
                        <b>{item.quantidade.toLocaleString('pt-BR')} t</b>
                      </p>
                    ))}
                    <p className="mt-2 flex justify-between border-t border-stone-100 pt-2 font-bold">
                      <span>Total</span>
                      <span>{moedaProposta(resposta.valorTotal, moeda)}</span>
                    </p>
                  </section>
                )}
                <button
                  type="button"
                  onClick={() => void baixarComprovante()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                >
                  <Download className="h-5 w-5" /> Baixar comprovante (PDF)
                </button>
              </>
            ) : (
              <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
                Esta proposta não aceita mais respostas. Fale com seu vendedor.
              </section>
            )}
          </div>
        </div>
      </main>
    );
  }

  const dias = diasParaVencer(proposta.validaAte);
  return (
    <main className="min-h-screen bg-stone-100 pb-8">
      <div className="mx-auto max-w-lg">
        {cabecalho(
          `Proposta de preços ${numero}`,
          `${proposta.vendedor ? `${proposta.vendedor} · ` : ''}válida até ${formatDataBr(proposta.validaAte)} (${dias === 0 ? 'vence hoje' : `${dias} dia${dias === 1 ? '' : 's'}`})`
        )}
        <div className="space-y-3 p-3">
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs text-stone-500">Para</p>
            <p className="font-black text-stone-900">{proposta.clienteNome}</p>
            <p className="text-xs text-stone-500">
              {proposta.localNome ? `Local: ${proposta.localNome} · ` : ''}Preços por tonelada
            </p>
            {proposta.observacoes && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {proposta.observacoes}
              </p>
            )}
          </section>

          <p className="px-1 text-sm font-black text-stone-800">
            Escolha os produtos e a quantidade
          </p>
          {itens.map((item) => {
            const ativo = Boolean(marcados[item.id]);
            const qtd = parseQtd(quantidades[item.id] || '');
            return (
              <section
                key={item.id}
                className={`rounded-2xl border bg-white p-4 ${ativo ? 'border-emerald-200' : 'border-stone-200 opacity-70'}`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(event) =>
                      setMarcados((current) => ({ ...current, [item.id]: event.target.checked }))
                    }
                    className="mt-1 h-5 w-5 accent-emerald-600"
                  />
                  <span className="flex-1">
                    <span className="block font-black text-stone-900">{item.nome}</span>
                    {item.embalagem && (
                      <span className="block text-xs text-stone-500">{item.embalagem}</span>
                    )}
                    <span className="block font-black text-emerald-700">
                      {moedaProposta(item.precoTonelada, moeda)} / t
                    </span>
                  </span>
                </label>
                {ativo && (
                  <div className="mt-3 flex items-center gap-2 pl-8">
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Quantidade em toneladas de ${item.nome}`}
                      value={quantidades[item.id] || ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (!/^\d*(?:[.,]\d{0,3})?$/.test(raw)) return;
                        setQuantidades((current) => ({ ...current, [item.id]: raw }));
                      }}
                      placeholder="0"
                      className="h-11 w-24 rounded-xl border border-stone-300 px-3 text-right text-lg font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-stone-500">toneladas</span>
                    <span className="ml-auto font-bold tabular-nums text-stone-800">
                      {qtd > 0 ? moedaProposta(qtd * item.precoTonelada, moeda) : '—'}
                    </span>
                  </div>
                )}
              </section>
            );
          })}

          <section className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 font-black">
            <span>Total escolhido</span>
            <span className="tabular-nums">
              {totalToneladas.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} t ·{' '}
              {moedaProposta(totalValor, moeda)}
            </span>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <label
              htmlFor="documento-aceite"
              className="text-xs font-bold uppercase text-stone-500"
            >
              CPF/CNPJ de quem responde
            </label>
            <input
              id="documento-aceite"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={documento}
              onChange={(event) =>
                setDocumento(event.target.value.replace(/[^\d./-]/g, '').slice(0, 18))
              }
              onBlur={() => setDocumento((current) => formatarDocumento(current))}
              placeholder="000.000.000-00"
              className="mt-1 h-12 w-full rounded-xl border border-stone-300 px-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-2 text-xs text-stone-500">
              Ao confirmar, registramos data, hora e o aparelho como comprovante da resposta.
            </p>
          </section>

          {recusando && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <label htmlFor="motivo-recusa" className="text-xs font-bold uppercase text-red-800">
                Motivo da recusa (opcional)
              </label>
              <textarea
                id="motivo-recusa"
                value={motivo}
                maxLength={500}
                rows={3}
                onChange={(event) => setMotivo(event.target.value)}
                className="mt-1 w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
              />
            </section>
          )}

          {problema && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              {problema}
            </p>
          )}

          <div className="grid gap-2">
            {!recusando ? (
              <>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void enviar('aceite')}
                  className="h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {enviando ? 'Enviando…' : 'Aceitar proposta'}
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => setRecusando(true)}
                  className="h-12 rounded-xl border border-red-200 bg-white font-black text-red-700 hover:bg-red-50"
                >
                  Recusar proposta
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void enviar('recusa')}
                  className="h-12 rounded-xl bg-red-600 font-black text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {enviando ? 'Enviando…' : 'Confirmar recusa'}
                </button>
                <button
                  type="button"
                  onClick={() => setRecusando(false)}
                  className="h-12 rounded-xl border border-stone-300 bg-white font-bold text-stone-700"
                >
                  Voltar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
