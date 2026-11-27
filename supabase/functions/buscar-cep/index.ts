const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Busca de CEP pelo servidor: o navegador do usuário só fala com o nosso
// backend, e daqui consultamos os serviços públicos com tempo limite e
// alternativas. Evita bloqueios de CORS, extensões e redes corporativas.

type Endereco = { street: string; neighborhood: string; city: string; state: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function getJson(url: string, timeoutMs = 4000): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      console.warn(`[buscar-cep] ${new URL(url).host} respondeu ${res.status}`);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (error) {
    console.warn(`[buscar-cep] ${new URL(url).host} falhou: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const providers: Array<(cep: string) => Promise<Endereco | null>> = [
  async (cep) => {
    const d = await getJson(`https://viacep.com.br/ws/${cep}/json/`);
    if (!d || d.erro) return null;
    return { street: str(d.logradouro), neighborhood: str(d.bairro), city: str(d.localidade), state: str(d.uf) };
  },
  async (cep) => {
    const d = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (!d || !d.city) return null;
    return { street: str(d.street), neighborhood: str(d.neighborhood), city: str(d.city), state: str(d.state) };
  },
  async (cep) => {
    const d = await getJson(`https://opencep.com/v1/${cep}`);
    if (!d || d.error || !d.localidade) return null;
    return { street: str(d.logradouro), neighborhood: str(d.bairro), city: str(d.localidade), state: str(d.uf) };
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let cep = '';
  try {
    const body = (await req.json()) as { cep?: string };
    cep = String(body.cep ?? '').replace(/\D/g, '');
  } catch {
    return json({ error: 'Corpo inválido' }, 400);
  }
  if (cep.length !== 8) return json({ error: 'CEP deve ter 8 dígitos' }, 422);

  for (const provider of providers) {
    const found = await provider(cep);
    if (found && found.city) return json({ endereco: found });
  }
  console.warn(`[buscar-cep] nenhum serviço encontrou ${cep}`);
  // 200 com endereço vazio: a tela diferencia "não encontrado" de falha.
  return json({ endereco: null });
});
