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

function companySignals(c) {
  const out = []; let delta = 0;
  const add = (pts, type, label, detail) => { delta += pts; out.push({ type, label, detail }); };
  if (c.situacao === 'ATIVA') add(30, 'good', 'Empresa ativa na Receita Federal', `${c.nome}.`);
  else add(-40, 'bad', 'CNPJ não está ativo', `Situação cadastral: ${c.situacao || 'desconhecida'}.`);
  const y = years(c);
  if (isNaN(y)) return { delta, out };
  if (y < 0.5) add(-25, 'bad', 'Empresa muito nova', `Aberta há ${Math.max(0, Math.round(y * 365))} dias.`);
  else if (y < 2) add(-5, 'warn', 'Empresa recente', `Aberta há ${Math.round(y * 12)} meses.`);
  else add(y >= 5 ? 25 : 10, 'good', `Aberta há ${Math.floor(y)} anos`, 'Empresas com histórico são mais confiáveis.');
  return { delta, out };
}

export async function checkCNPJ(raw, fetcher = fetch) {
  const cnpj = raw.replace(/\D/g, '');
  const res = (host, score, signals, company = null, unavailable = false) =>
    ({ host, score: Math.max(0, Math.min(100, score)), level: levelOf(score), signals, company, unavailable });
  if (!validCNPJ(cnpj)) return res(cnpj, 0, [{ type: 'bad', label: 'CNPJ inválido', detail: 'O número não passa na validação dos dígitos verificadores.' }]);
  const l = await lookupCNPJ(cnpj, fetcher);
  if (l.status === 'notfound') return res(cnpj, 5, [{ type: 'bad', label: 'CNPJ não existe na Receita', detail: 'Os dígitos são válidos, mas não há empresa com esse número.' }]);
  if (l.status === 'error') return res(cnpj, 0, [{ type: 'warn', label: 'Consulta à Receita indisponível', detail: 'Os serviços de consulta não responderam. Tente novamente em instantes.' }], null, true);
  const { delta, out } = companySignals(l.company);
  return res(l.company.fantasia || l.company.nome, 50 + delta, out, l.company);
}

/* ---------- Análise de um site ---------- */
export async function analyze(url, markdown, links = [], fetcher = fetch) {
  const signals = []; let score = 50;
  const add = (pts, type, label, detail) => { score += pts; signals.push({ type, label, detail }); };
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const text = markdown.toLowerCase();
  const nav = links.join(' ').toLowerCase();
  const tld = host.split('.').pop();

  if (u.protocol === 'https:') add(0, 'good', 'Conexão segura (HTTPS)', 'Os dados trafegam criptografados.');
  else add(-20, 'bad', 'Sem HTTPS', 'O site não usa conexão segura.');
  if (SUSPECT_TLDS.includes(tld)) add(-8, 'warn', `Domínio .${tld}`, 'Extensão muito usada em lojas descartáveis.');
  if ((host.match(/-/g) || []).length >= 3 || host.startsWith('xn--')) add(-8, 'warn', 'Endereço estranho', 'Muitos hífens ou caracteres disfarçados.');
  for (const [k, official] of Object.entries(BRANDS)) {
    if (!host.replace(/[-.]/g, '').includes(k)) continue;
    if (host === official || host.endsWith(`.${official}`)) add(10, 'good', 'Endereço oficial da marca', `${official} é o site oficial.`);
    else add(-35, 'bad', 'Imita marca conhecida', `O endereço lembra "${k}", mas o site oficial é ${official}.`);
    break;
  }

  let company = null, trusted = false;
  const cnpjs = findCNPJs(markdown);
  if (!cnpjs.length) add(-15, 'warn', 'CNPJ não encontrado no site', 'Lojas legítimas costumam exibir o CNPJ no rodapé ou em "Institucional".');
  else {
    const l = await lookupCNPJ(cnpjs[0], fetcher);
    if (l.status === 'ok') {
      company = l.company;
      const { delta, out } = companySignals(company);
      score += delta; signals.push(...out);
      trusted = company.situacao === 'ATIVA' && years(company) >= 2;
    } else if (l.status === 'notfound') add(-35, 'bad', 'CNPJ do site não existe na Receita', `${cnpjs[0]} não foi encontrado.`);
    else signals.push({ type: 'warn', label: 'Consulta à Receita indisponível', detail: 'Não foi possível confirmar o CNPJ agora; tente de novo.' });
  }

  if (!trusted) { // sinais de texto só pesam quando a empresa não está comprovada
    if (/(últimas unidades|só hoje|acaba hoje|oferta relâmpago|restam apenas)/.test(text)) add(-4, 'warn', 'Pressão de urgência', 'Linguagem de "corra" para você não pensar.');
    if (/(\b[7-9]\d\s?%\s?(off|de desconto)|-\s?[7-9]\d\s?%)/.test(text)) add(-6, 'warn', 'Descontos muito altos', 'Descontos acima de 70% merecem atenção.');
  }
  if (!/(contato|fale-conosco|atendimento|sac|ajuda)|@[a-z0-9-]+\.[a-z]{2,}|whatsapp/.test(`${nav} ${text}`)) add(-5, 'warn', 'Sem canal de contato', 'Nenhum contato ou atendimento visível.');
  if (!/(troca|devolu|arrependimento|privacidade|termos)/.test(`${nav} ${text}`)) add(-5, 'warn', 'Sem política de troca ou privacidade', 'Não achamos esses documentos no site.');

  score = Math.max(0, Math.min(100, score));
  return { host, score, level: levelOf(score), signals, company };
}
