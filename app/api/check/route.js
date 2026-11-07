import { analyze, checkCNPJ } from '../../../lib/analyze';

export const maxDuration = 60;

export async function POST(req) {
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== 'string' || url.length > 2000) return Response.json({ error: 'Link inválido.' }, { status: 400 });
  if (/^[\d.\/-]{14,18}$/.test((url || '').trim())) return Response.json(await checkCNPJ(url));
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) throw 0;
  } catch { return Response.json({ error: 'Link inválido.' }, { status: 400 }); }

  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return Response.json({ error: 'Serviço temporariamente indisponível.' }, { status: 500 });

  const fc = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: parsed.href, formats: ['markdown'], onlyMainContent: false }),
  });
  if (!fc.ok) return Response.json({ error: 'Não consegui abrir esse site (pode estar fora do ar — também é um sinal).' }, { status: 502 });
  const { data } = await fc.json();
  const result = await analyze(parsed.href, `${data?.metadata?.title || ''}\n${data?.markdown || ''}`);
  return Response.json(result);
}
