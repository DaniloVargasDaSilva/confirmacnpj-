import { takeCredit, clientIp } from '../../../lib/ratelimit';
import { analyze, checkCNPJ, cleanUrl, findCNPJs, isGoogleAd, rootDomain, brandOf } from '../../../lib/analyze';

export const maxDuration = 60;
const bad = (error, status = 400) => Response.json({ error }, { status });
const FC = 'https://api.firecrawl.dev/v1';

async function fc(path, key, body) {
  try {
    const r = await fetch(`${FC}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const scrape = async (url, key, formats) => (await fc('scrape', key, { url, formats, onlyMainContent: false, mobile: false, waitFor: 2000 }))?.data || null;
const search = async (query, key) => (await fc('search', key, { query, limit: 5, country: 'br', lang: 'pt' }))?.data || [];

// Registro.br (RDAP): CNPJ do titular de domínios .br
async function rdapCnpj(root) {
  if (!root.endsWith('.br')) return null;
  try {
    const r = await fetch(`https://rdap.registro.br/domain/${encodeURIComponent(root)}`, { headers: { Accept: 'application/rdap+json' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const ents = (await r.json()).entities || [];
    const reg = ents.filter((e) => (e.roles || []).includes('registrant'));
    return findCNPJs(JSON.stringify(reg.length ? reg : ents))[0] || null;
  } catch { return null; }
}

// Três pesquisas no Firecrawl + registro do domínio, em paralelo.
async function gather(root, key) {
  const label = brandOf(root);
  const [official, cnpjRes, reclame, rdap] = await Promise.all([
    search(`${label} site oficial`, key),
    search(`"${root}" CNPJ razão social`, key),
    search(`${label} reclame aqui`, key),
    rdapCnpj(root),
  ]);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return {
    rdapCnpj: rdap,
    searchHits: {
      official: official.slice(0, 3).some((r) => host(r.url) === root || host(r.url).endsWith(`.${root}`)),
      reclameAqui: reclame.some((r) => host(r.url) === 'reclameaqui.com.br' && /\/empresa\//.test(r.url) && (r.url + (r.title || '')).toLowerCase().replace(/[^a-z0-9]/g, '').includes(label.replace(/[^a-z0-9]/g, ''))),
      cnpjs: findCNPJs(cnpjRes.map((r) => `${r.title || ''} ${r.description || ''}`).join('\n')),
    },
  };
}

export async function POST(req) {
  const { url, lang: l0 } = await req.json().catch(() => ({}));
  const lang = l0 === 'en' ? 'en' : 'pt';
  const T = (pt, en) => (lang === 'en' ? en : pt);
  if (typeof url !== 'string' || url.length > 2000) return bad(T('Link inválido.', 'Invalid link.'));
  const input = url.trim();

  const isCnpj = /^[\d.\/-]{14,18}$/.test(input);
  const parsed = isCnpj ? null : cleanUrl(input);
  if (!isCnpj && !parsed) return bad(T('Link inválido.', 'Invalid link.'));

  // Limite: 10 créditos por hora por IP (1 consulta = 1 crédito).
  const credit = takeCredit(clientIp(req));
  const credits = { remaining: credit.remaining, limit: credit.limit, resetAt: credit.resetAt };
  if (!credit.ok) {
    const mins = Math.max(1, Math.ceil((credit.resetAt - Date.now()) / 60000));
    return Response.json({ code: 'LIMIT', error: T('Você usou seus créditos desta hora.', 'You have used your credits for this hour.'), credits },
      { status: 429, headers: { 'Retry-After': String(mins * 60) } });
  }
  const json = (obj, init) => Response.json({ ...obj, credits }, init);

  if (isCnpj) return json(await checkCNPJ(input, lang));

  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return bad(T('Serviço temporariamente indisponível.', 'Service temporarily unavailable.'), 500);

  const rootA = rootDomain(parsed.hostname);
  const [data, ctxA] = await Promise.all([
    scrape(parsed.href, key, ['markdown', 'links']),
    isGoogleAd(parsed) ? null : gather(rootA, key),
  ]);
  if (!data) return bad(T('Não consegui abrir esse site. Ele pode estar fora do ar, o que também é um sinal.', 'Could not open this site. It may be offline, which is also a signal.'), 502);

  let final = parsed;
  try { final = new URL(data.metadata?.url || data.metadata?.sourceURL || parsed.href); } catch { /* mantém */ }
  if (isGoogleAd(parsed) && /(^|\.)google\./.test(final.hostname))
    return bad(T('Esse é um link de anúncio do Google e não deu para descobrir o site de destino. Abra o anúncio, copie o endereço do site e cole aqui.', 'This is a Google ad link and the destination site could not be found. Open the ad, copy the site address and paste it here.'), 422);

  // Se o destino final é outro domínio (anúncio, encurtador), refaz as pesquisas para ele.
  const rootF = rootDomain(final.hostname);
  const ctx = ctxA && rootF === rootA ? ctxA : await gather(rootF, key);

  let markdown = `${data.metadata?.title || ''}\n${data.markdown || ''}`;
  const links = data.links || [];

  // Sem CNPJ no site nem no registro? Procura em "Institucional", "Termos", "Contato" do site e do domínio principal.
  if (!findCNPJs(markdown).length && !ctx.rdapCnpj) {
    const extra = [...new Set(links.filter((l) => {
      try { const x = new URL(l); return (x.hostname === rootF || x.hostname.endsWith(`.${rootF}`)) && /(institucional|sobre|quem-somos|termos|privacidade|politica|contato|fale-conosco)/i.test(x.pathname); }
      catch { return false; }
    }))];
    if (final.hostname !== rootF && final.hostname !== `www.${rootF}`) extra.unshift(`https://${rootF}/`);
    const pages = await Promise.all(extra.slice(0, 3).map((l) => scrape(l, key, ['markdown'])));
    markdown += pages.map((p) => p?.markdown || '').join('\n');
  }

  const result = await analyze(final.href, markdown, links, { ...ctx, lang });
  const from = parsed.hostname.replace(/^www\./, '');
  if (from !== result.host && !isGoogleAd(parsed) && rootDomain(from) !== rootDomain(result.host)) result.notice = T(`Você colou um link de ${from}. Analisamos o destino final: ${result.host}.`, `You pasted a link from ${from}. We analyzed the final destination: ${result.host}.`);
  return json(result);
}
