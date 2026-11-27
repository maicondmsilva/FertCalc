import type { Proposta, PropostaResposta } from '../../types/proposta';
import {
  linkProposta,
  urlPropostaCliente,
  urlVerificacaoAssinatura,
} from '../../services/propostaService';
import { qrDataUrl } from '../../utils/qrCode';
import { situacaoProposta } from '../../utils/propostaModel';

/** QR code do link de aceite (só proposta vigente; sem permissão ou erro, sem QR). */
export async function qrDoAceite(proposta: Proposta): Promise<string | undefined> {
  if (situacaoProposta(proposta) !== 'vigente') return undefined;
  try {
    return await qrDataUrl(urlPropostaCliente(await linkProposta(proposta.id)));
  } catch {
    return undefined;
  }
}

/** QR code e endereço da verificação da assinatura do comprovante. */
export async function qrDaVerificacao(
  resposta: PropostaResposta
): Promise<{ qrVerificacao?: string; urlVerificacao?: string }> {
  if (!resposta.codigoVerificacao) return {};
  const urlVerificacao = urlVerificacaoAssinatura(resposta.codigoVerificacao);
  try {
    return { urlVerificacao, qrVerificacao: await qrDataUrl(urlVerificacao) };
  } catch {
    return { urlVerificacao };
  }
}
