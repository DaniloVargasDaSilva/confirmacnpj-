import { analyze, checkCNPJ, cleanUrl, findCNPJs, isGoogleAd } from '../../../lib/analyze';

export const maxDuration = 60;
const bad = (error, status = 400) => Response.json({ error }, { status });

async function scrape(url, key, formats) {
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats, onlyMainContent: false, mobile: false, waitFor: 2000 }),
    });
    return r.ok ? (await r.json()).data : null;
  } catch { return null; }
}

export async function POST(req) {
  const { url } = await req.json().catch(() => ({}));
  if (typeof url !== 'string' || url.length > 2000) return bad('Link inválido.');
  const input = url.trim();

  if (/^[\d.\/-]{14,18}$/.test(input)) return Response.json(await checkCNPJ(input));

  const parsed = cleanUrl(input);
  if (!parsed) return bad('Link inválido.');
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return bad('Serviço temporariamente indisponível.', 500);

  const data = await scrape(parsed.href, key, ['markdown', 'links']);
  if (!data) return bad('Não consegui abrir esse site. Ele pode estar fora do ar, o que também é um sinal.', 502);

  // Destino final depois de redirecionamentos (anúncios, encurtadores).
  let final = parsed;
  try { final = new URL(data.metadata?.url || data.metadata?.sourceURL || parsed.href); } catch { /* mantém */ }
  if (isGoogleAd(parsed) && /(^|\.)google\./.test(final.hostname))
    return bad('Esse é um link de anúncio do Google e não deu para descobrir o site de destino. Abra o anúncio, copie o endereço do site e cole aqui.', 422);

  let markdown = `${data.metadata?.title || ''}\n${data.markdown || ''}`;
  const links = data.links || [];

  // Sem CNPJ na página inicial? Procura em "Institucional", "Termos", "Contato"...
  if (!findCNPJs(markdown).length) {
    const extra = [...new Set(links.filter((l) => {
      try { const x = new URL(l); return x.hostname === final.hostname && /(institucional|sobre|quem-somos|termos|privacidade|politica|contato|fale-conosco)/i.test(x.pathname); }
      catch { return false; }
    }))].slice(0, 2);
    const pages = await Promise.all(extra.map((l) => scrape(l, key, ['markdown'])));
    markdown += pages.map((p) => p?.markdown || '').join('\n');
  }

  const result = await analyze(final.href, markdown, links);
  const from = parsed.hostname.replace(/^www\./, '');
  if (from !== result.host) result.notice = `Você colou um link de ${from}. Analisamos o destino final: ${result.host}.`;
  return Response.json(result);
}
