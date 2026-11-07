const SUSPECT_TLDS = ['shop', 'top', 'xyz', 'click', 'store', 'site', 'online', 'vip', 'icu', 'buzz', 'cyou'];
const BRANDS = {
  magalu: 'magazineluiza.com.br', magazineluiza: 'magazineluiza.com.br', americanas: 'americanas.com.br',
  shopee: 'shopee.com.br', mercadolivre: 'mercadolivre.com.br', casasbahia: 'casasbahia.com.br',
  nike: 'nike.com.br', netshoes: 'netshoes.com.br', amazon: 'amazon.com.br', aliexpress: 'aliexpress.com',
  carrefour: 'carrefour.com.br', samsung: 'samsung.com',
};

/* ---------- URL ---------- */
const TRACKING = /^(utm_|gclid|gad_|gbraid|wbraid|dclid|fbclid|msclkid|gclsrc)/i;
const isGoogle = (h) => /(^|\.)google\.[a-z.]+$/i.test(h);

export const isGoogleAd = (u) => isGoogle(u.hostname) && /^\/(aclk|url)/.test(u.pathname);

// Limpa o link: remove rastreadores e abre redirecionadores do Google quando há destino.
export function cleanUrl(input) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
  if (isGoogleAd(u)) {
    const dest = u.searchParams.get('adurl') || u.searchParams.get('q') || u.searchParams.get('url');
    try { const x = new URL(dest); if (/^https?:$/.test(x.protocol)) u = x; } catch { /* sem destino */ }
  }
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  return u;
}

/* ---------- CNPJ ---------- */
export function validCNPJ(raw) {
  const c = raw.replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len) => {
    let s = 0, p = len - 7;
    for (let i = 0; i < len; i++) { s += +c[i] * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === +c[12] && calc(13) === +c[13];
}

// CNPJs válidos do texto; os que aparecem logo depois da palavra "CNPJ" vêm primeiro.
export function findCNPJs(text) {
  const found = [];
  for (const m of text.matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)) {
    const n = m[0].replace(/\D/g, '');
    if (!validCNPJ(n) || found.some((f) => f.n === n)) continue;
    found.push({ n, near: /cnpj/i.test(text.slice(Math.max(0, m.index - 40), m.index)) ? 0 : 1 });
  }
  return found.sort((a, b) => a.near - b.near).map((f) => f.n);
}

const UA = { 'User-Agent': 'ConfirmaCNPJ/1.0 (hackathon)', Accept: 'application/json' };
const iso = (d) => (/^\d{2}\/\d{2}\/\d{4}$/.test(d || '') ? d.split('/').reverse().join('-') : d);

// Tenta 3 provedores. Retorna { status: 'ok'|'notfound'|'error', company }
export async function lookupCNPJ(cnpj, fetcher = fetch) {
  const providers = [
    [`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, (d) => ({ nome: d.razao_social, fantasia: d.nome_fantasia, cnpj: d.cnpj, abertura: d.data_inicio_atividade, situacao: d.descricao_situacao_cadastral, municipio: d.municipio, uf: d.uf })],
    [`https://publica.cnpj.ws/cnpj/${cnpj}`, (d) => ({ nome: d.razao_social, fantasia: d.estabelecimento?.nome_fantasia, cnpj: d.estabelecimento?.cnpj, abertura: d.estabelecimento?.data_inicio_atividade, situacao: d.estabelecimento?.situacao_cadastral, municipio: d.estabelecimento?.cidade?.nome, uf: d.estabelecimento?.estado?.sigla })],
    [`https://receitaws.com.br/v1/cnpj/${cnpj}`, (d) => ({ nome: d.nome, fantasia: d.fantasia, cnpj: d.cnpj, abertura: iso(d.abertura), situacao: d.situacao, municipio: d.municipio, uf: d.uf, erro: d.status === 'ERROR' })],
  ];
  let notFound = false;
  for (const [url, map] of providers) {
    try {
      const r = await fetcher(url, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (r.status === 404) { notFound = true; continue; }
      if (!r.ok) continue;
      const c = map(await r.json());
      if (c.erro || !c.nome) continue;
      return { status: 'ok', company: { ...c, cnpj: cnpj, situacao: (c.situacao || '').toUpperCase() } };
    } catch { /* tenta o próximo */ }
  }
  return { status: notFound ? 'notfound' : 'error' };
}

/* ---------- Pontuação (0–100, maior = mais confiável) ---------- */
export const levelOf = (score) => (score >= 75 ? 'alto' : score >= 45 ? 'medio' : 'baixo');
const years = (c) => (Date.now() - new Date(c.abertura).getTime()) / (365.25 * 864e5);
const mkT = (lang) => (pt, en) => (lang === 'en' ? en : pt);

function companySignals(c, T) {
  const out = []; let delta = 0;
  const add = (pts, type, label, detail) => { delta += pts; out.push({ type, label, detail }); };
  if (c.situacao === 'ATIVA') add(30, 'good', T('Empresa ativa na Receita Federal', 'Active in the Federal Revenue registry'), `${c.nome}.`);
  else add(-40, 'bad', T('CNPJ não está ativo', 'CNPJ is not active'), T(`Situação cadastral: ${c.situacao || 'desconhecida'}.`, `Registry status: ${c.situacao || 'unknown'}.`));
  const y = years(c);
  if (isNaN(y)) return { delta, out };
  if (y < 0.5) { const d = Math.max(0, Math.round(y * 365)); add(-25, 'bad', T('Empresa muito nova', 'Very new company'), T(`Aberta há ${d} dias.`, `Opened ${d} days ago.`)); }
  else if (y < 2) { const m = Math.round(y * 12); add(-5, 'warn', T('Empresa recente', 'Recent company'), T(`Aberta há ${m} meses.`, `Opened ${m} months ago.`)); }
  else { const n = Math.floor(y); add(y >= 5 ? 25 : 10, 'good', T(`Aberta há ${n} anos`, `Open for ${n} years`), T('Empresas com histórico são mais confiáveis.', 'Companies with a track record are more trustworthy.')); }
  return { delta, out };
}

export async function checkCNPJ(raw, lang = 'pt', fetcher = fetch) {
  const T = mkT(lang);
  const cnpj = raw.replace(/\D/g, '');
  const res = (host, score, signals, company = null, unavailable = false) =>
    ({ host, score: Math.max(0, Math.min(100, score)), level: levelOf(score), signals, company, unavailable });
  if (!validCNPJ(cnpj)) return res(cnpj, 0, [{ type: 'bad', label: T('CNPJ inválido', 'Invalid CNPJ'), detail: T('O número não passa na validação dos dígitos verificadores.', 'The number fails the check-digit validation.') }]);
  const l = await lookupCNPJ(cnpj, fetcher);
  if (l.status === 'notfound') return res(cnpj, 5, [{ type: 'bad', label: T('CNPJ não existe na Receita', 'CNPJ not found in the registry'), detail: T('Os dígitos são válidos, mas não há empresa com esse número.', 'The digits are valid, but no company has this number.') }]);
  if (l.status === 'error') return res(cnpj, 0, [{ type: 'warn', label: T('Consulta à Receita indisponível', 'Registry lookup unavailable'), detail: T('Os serviços de consulta não responderam. Tente novamente em instantes.', 'The lookup services did not respond. Please try again shortly.') }], null, true);
  const { delta, out } = companySignals(l.company, T);
  return res(l.company.fantasia || l.company.nome, 50 + delta, out, l.company);
}

/* ---------- Domínio e nomes ---------- */
export function rootDomain(host) {
  const p = host.replace(/^www\./, '').toLowerCase().split('.');
  return p.length >= 3 && /^(com|org|net|gov|edu|ind|eco)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.');
}
const norm = (t = '') => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const brandOf = (root) => root.split('.')[0];
export const nameMatch = (c, root) => {
  const t = norm(brandOf(root));
  return t.length >= 4 && (norm(c.nome).includes(t) || norm(c.fantasia).includes(t));
};

/* ---------- Análise de um site ----------
   ctx: { lang, rdapCnpj, searchHits: { official, reclameAqui, cnpjs[] } } */
export async function analyze(url, markdown, links = [], ctx = {}, fetcher = fetch) {
  const T = mkT(ctx.lang);
  const signals = []; let score = 50;
  const add = (pts, type, label, detail) => { score += pts; signals.push({ type, label, detail }); };
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const root = rootDomain(host);
  const text = markdown.toLowerCase();
  const nav = links.join(' ').toLowerCase();
  const tld = host.split('.').pop();

  if (u.protocol === 'https:') add(0, 'good', T('Conexão segura (HTTPS)', 'Secure connection (HTTPS)'), T('Os dados trafegam criptografados.', 'Data is encrypted in transit.'));
  else add(-20, 'bad', T('Sem HTTPS', 'No HTTPS'), T('O site não usa conexão segura.', 'The site does not use a secure connection.'));
  if (SUSPECT_TLDS.includes(tld)) add(-8, 'warn', T(`Domínio .${tld}`, `.${tld} domain`), T('Extensão muito usada em lojas descartáveis.', 'Extension commonly used by throwaway shops.'));
  if ((host.match(/-/g) || []).length >= 3 || host.startsWith('xn--')) add(-8, 'warn', T('Endereço estranho', 'Odd web address'), T('Muitos hífens ou caracteres disfarçados.', 'Many hyphens or disguised characters.'));
  for (const [k, official] of Object.entries(BRANDS)) {
    if (!host.replace(/[-.]/g, '').includes(k)) continue;
    if (host === official || host.endsWith(`.${official}`)) add(10, 'good', T('Endereço oficial da marca', 'Official brand address'), T(`${official} é o site oficial.`, `${official} is the official site.`));
    else add(-35, 'bad', T('Imita marca conhecida', 'Imitates a known brand'), T(`O endereço lembra "${k}", mas o site oficial é ${official}.`, `The address resembles "${k}", but the official site is ${official}.`));
    break;
  }

  const cands = [];
  for (const n of findCNPJs(markdown)) cands.push({ n, src: 'site' });
  if (ctx.rdapCnpj) cands.push({ n: ctx.rdapCnpj, src: 'registro' });
  for (const n of ctx.searchHits?.cnpjs || []) cands.push({ n, src: 'busca' });

  let company = null, src = null, lookupFailed = false, notFoundReal = null;
  const tried = new Set();
  for (const c of cands) {
    if (tried.has(c.n) || tried.size >= 3) continue;
    tried.add(c.n);
    const l = await lookupCNPJ(c.n, fetcher);
    if (l.status === 'error') { lookupFailed = true; continue; }
    if (l.status === 'notfound') { if (c.src !== 'busca') notFoundReal = notFoundReal || c.n; continue; }
    if (c.src === 'busca' && !nameMatch(l.company, root)) continue;
    company = l.company; src = c.src; break;
  }

  let trusted = false;
  if (company) {
    const cs = companySignals(company, T);
    score += cs.delta; signals.push(...cs.out);
    trusted = company.situacao === 'ATIVA' && years(company) >= 2;
    if (src === 'registro') add(0, 'good', T('CNPJ obtido do registro do domínio', 'CNPJ taken from the domain registration'), T('O Registro.br informa esse CNPJ como titular do endereço.', 'Registro.br lists this CNPJ as the address owner.'));
    if (src === 'busca') add(-10, 'warn', T('CNPJ achado só por pesquisa', 'CNPJ found only through search'), T('Não estava no site, mas o nome da empresa combina com o endereço.', 'It was not on the site, but the company name matches the address.'));
    if (nameMatch(company, root)) add(8, 'good', T('Nome da empresa combina com o site', 'Company name matches the site'), `"${company.fantasia || company.nome}" ↔ ${root}.`);
    if (ctx.rdapCnpj) {
      if (ctx.rdapCnpj === company.cnpj || ctx.rdapCnpj.slice(0, 8) === company.cnpj.slice(0, 8)) add(20, 'good', T('Domínio registrado no CNPJ da empresa', 'Domain registered to the company CNPJ'), T('O titular do endereço no Registro.br é a própria empresa.', 'The address owner on Registro.br is the company itself.'));
      else add(-5, 'warn', T('Titular do domínio é outro CNPJ', 'Domain owner is a different CNPJ'), T('O registro do endereço está em nome de outra empresa.', 'The address is registered to another company.'));
    }
  } else if (lookupFailed) signals.push({ type: 'warn', label: T('Consulta à Receita indisponível', 'Registry lookup unavailable'), detail: T('Não foi possível confirmar o CNPJ agora; tente de novo.', 'Could not confirm the CNPJ right now; please try again.') });
  else if (notFoundReal) add(-30, 'bad', T('CNPJ do site não existe na Receita', 'Site CNPJ not found in the registry'), T(`${notFoundReal} não foi encontrado.`, `${notFoundReal} was not found.`));
  else add(-5, 'warn', T('CNPJ não encontrado', 'CNPJ not found'), T('Procuramos no site, no registro do domínio e em buscas, sem sucesso.', 'We looked on the site, in the domain registry and in searches, without success.'));

  const h = ctx.searchHits;
  if (h) {
    if (h.official) add(10, 'good', T('Aparece como site oficial nas buscas', 'Shows up as the official site in searches'), T(`${root} está entre os primeiros resultados da marca.`, `${root} is among the top results for the brand.`));
    else add(-5, 'warn', T('Não apareceu como site oficial nas buscas', 'Did not show up as the official site in searches'), T('O endereço não está entre os primeiros resultados da marca.', 'The address is not among the top results for the brand.'));
    if (h.reclameAqui) add(5, 'good', T('Empresa com página no Reclame Aqui', 'Company has a Reclame Aqui page'), T('Há histórico público de atendimento.', 'There is a public customer-service record.'));
  }

  if (!trusted) {
    if (/(últimas unidades|só hoje|acaba hoje|oferta relâmpago|restam apenas)/.test(text)) add(-4, 'warn', T('Pressão de urgência', 'Urgency pressure'), T('Linguagem de "corra" para você não pensar.', '"Hurry up" language to keep you from thinking.'));
    if (/(\b[7-9]\d\s?%\s?(off|de desconto)|-\s?[7-9]\d\s?%)/.test(text)) add(-6, 'warn', T('Descontos muito altos', 'Very high discounts'), T('Descontos acima de 70% merecem atenção.', 'Discounts above 70% deserve attention.'));
  }
  if (!/(contato|fale-conosco|atendimento|sac|ajuda)|@[a-z0-9-]+\.[a-z]{2,}|whatsapp/.test(`${nav} ${text}`)) add(-5, 'warn', T('Sem canal de contato', 'No contact channel'), T('Nenhum contato ou atendimento visível.', 'No visible contact or support.'));
  if (!/(troca|devolu|arrependimento|privacidade|termos)/.test(`${nav} ${text}`)) add(-5, 'warn', T('Sem política de troca ou privacidade', 'No returns or privacy policy'), T('Não achamos esses documentos no site.', 'We could not find these documents on the site.'));

  score = Math.max(0, Math.min(100, score));
  let level = levelOf(score), title;
  if (!company && !signals.some((x) => x.type === 'bad')) { level = 'medio'; title = T('Não deu para confirmar o CNPJ', "Couldn't confirm the CNPJ"); }
  return { host, score, level, title, signals, company };
}
