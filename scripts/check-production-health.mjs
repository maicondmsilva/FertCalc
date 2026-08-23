import { pathToFileURL } from 'node:url';

const EXPECTED_MARKER = '<title>FertCalc Pro</title>';
const DEFAULT_TIMEOUT_MS = 30_000;

export async function checkProductionHealth({
  targetUrl,
  bypassSecret = '',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!targetUrl) return { status: 'not-configured' };

  const requestUrl = new URL(targetUrl);
  if (bypassSecret) {
    requestUrl.searchParams.set('x-vercel-protection-bypass', bypassSecret);
    requestUrl.searchParams.set('x-vercel-set-bypass-cookie', 'true');
  }

  const startedAt = performance.now();
  const response = await fetchImpl(requestUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'FertCalc-Production-Monitor/1.0' },
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  const body = await response.text();
  const protectedBySso = response.url ? new URL(response.url).hostname === 'vercel.com' : false;

  if (protectedBySso && !bypassSecret) {
    return { status: 'protected', latencyMs, httpStatus: response.status };
  }
  if (!response.ok) {
    throw new Error(`Aplicação respondeu HTTP ${response.status} após ${latencyMs} ms.`);
  }
  if (!body.includes(EXPECTED_MARKER)) {
    throw new Error('A resposta não contém a identificação esperada do FertCalc.');
  }

  return { status: 'healthy', latencyMs, httpStatus: response.status };
}

async function main() {
  const result = await checkProductionHealth({
    targetUrl: process.env.TARGET_URL,
    bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  });

  if (result.status === 'not-configured') {
    console.log(
      '::notice::Monitor não executado: configure a variável PRODUCTION_HEALTH_URL no GitHub.'
    );
    return;
  }
  if (result.status === 'protected') {
    console.log(
      '::warning::Deploy acessível somente via Vercel SSO. Configure VERCEL_AUTOMATION_BYPASS_SECRET para ativar a validação completa.'
    );
    return;
  }

  console.log(`FertCalc operacional: HTTP ${result.httpStatus} em ${result.latencyMs} ms.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`::error::Monitoramento falhou: ${error.message}`);
    process.exitCode = 1;
  });
}
