const SUSPECT_TLDS = ['shop', 'top', 'xyz', 'click', 'store', 'site', 'online', 'vip', 'icu', 'buzz', 'cyou'];
const BRANDS = {
  magalu: 'magazineluiza.com.br', magazineluiza: 'magazineluiza.com.br', americanas: 'americanas.com.br',
  shopee: 'shopee.com.br', mercadolivre: 'mercadolivre.com.br', casasbahia: 'casasbahia.com.br',
  nike: 'nike.com.br', netshoes: 'netshoes.com.br', amazon: 'amazon.com.br', aliexpress: 'aliexpress.com',
  carrefour: 'carrefour.com.br', samsung: 'samsung.com',
};

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

export function findCNPJs(text) {
  return [...new Set((text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) || []).map((s) => s.replace(/\D/g, '')))];
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
      return { status: 'ok', company: { ...c, situacao: (c.situacao || '').toUpperCase() } };
    } catch { /* tenta o próximo */ }
  }
  return { status: notFound ? 'notfound' : 'error' };
}

export async function analyze(url, markdown) {
  const signals = []; // { pts, label, detail }
  const add = (pts, label, detail) => signals.push({ pts, label, detail });
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const text = markdown.toLowerCase();
  const tld = host.split('.').pop();

  if (u.protocol !== 'https:') add(25, 'Sem HTTPS', 'O site não usa conexão segura.');
  if (SUSPECT_TLDS.includes(tld)) add(10, `Domínio .${tld}`, 'Extensão muito usada em lojas descartáveis.');
  if ((host.match(/-/g) || []).length >= 3 || host.startsWith('xn--')) add(10, 'Domínio estranho', 'Muitos hífens ou caracteres disfarçados.');
  for (const [k, official] of Object.entries(BRANDS)) {
    if (host.replace(/[-.]/g, '').includes(k) && !host.endsWith(official)) {
      add(35, 'Imita marca conhecida', `O domínio lembra "${k}", mas o site oficial é ${official}.`); break;
    }
  }

  const cnpjs = findCNPJs(markdown);
  let company = null;
  if (!cnpjs.length) add(20, 'CNPJ não encontrado', 'Lojas legítimas exibem CNPJ no rodapé.');
  else {
    const valid = cnpjs.find(validCNPJ);
    if (!valid) add(25, 'CNPJ inválido', `O número ${cnpjs[0]} não passa na validação.`);
    else {
      const l = await lookupCNPJ(valid);
      if (l.status === 'ok') {
        company = l.company;
        const days = (Date.now() - new Date(company.abertura).getTime()) / 864e5;
        if (company.situacao !== 'ATIVA') add(35, 'CNPJ não está ativo', `Situação: ${company.situacao}.`);
        if (days < 180) add(25, 'Empresa muito nova', `Aberta há ${Math.max(0, Math.round(days))} dias.`);
      } else if (l.status === 'notfound') add(35, 'CNPJ não existe na Receita', `${valid} não foi encontrado.`);
      else add(0, 'Consulta à Receita indisponível', 'Não foi possível confirmar o CNPJ agora; tente de novo.');
    }
  }

  if (/(últimas unidades|só hoje|termina em|corra|oferta relâmpago|acaba hoje|restam apenas)/.test(text)) add(10, 'Pressão de urgência', 'Linguagem de "corra" para você não pensar.');
  if (/(\b[6-9]\d\s?%\s?(off|de desconto)|-\s?[6-9]\d\s?%)/.test(text)) add(15, 'Desconto absurdo', 'Descontos de 60% ou mais costumam ser isca.');
  if (/(apenas|somente|só)[^.]{0,30}pix/.test(text)) add(10, 'Só aceita Pix', 'Sem cartão, você perde a proteção de estorno.');
  if (!/(@[a-z0-9-]+\.[a-z]{2,}|whatsapp|\(\d{2}\)\s?\d{4,5}-?\d{4})/.test(text)) add(10, 'Sem contato claro', 'Nenhum e-mail ou telefone visível.');
  if (!/(troca|devolu|arrependimento|política de privacidade)/.test(text)) add(10, 'Sem política de troca', 'Não achamos troca, devolução ou privacidade.');

  const score = Math.min(100, signals.reduce((s, x) => s + x.pts, 0));
  const level = score < 25 ? 'baixo' : score < 55 ? 'medio' : 'alto';
  return {
    host, score, level, signals,
    company,
  };
}

export async function checkCNPJ(raw, fetcher = fetch) {
  const cnpj = raw.replace(/\D/g, '');
  const out = (host, score, signals, company = null, unavailable = false) =>
    ({ host, score, level: score < 25 ? 'baixo' : score < 55 ? 'medio' : 'alto', signals, company, unavailable });
  if (!validCNPJ(cnpj)) return out(cnpj, 100, [{ pts: 100, label: 'CNPJ inválido', detail: 'O número não passa na validação dos dígitos verificadores.' }]);
  const l = await lookupCNPJ(cnpj, fetcher);
  if (l.status === 'notfound') return out(cnpj, 80, [{ pts: 80, label: 'CNPJ não existe na Receita', detail: 'Os dígitos são válidos, mas não há empresa com esse número.' }]);
  if (l.status === 'error') return out(cnpj, 0, [{ pts: 0, label: 'Consulta à Receita indisponível', detail: 'Os serviços de consulta não responderam. Tente novamente em instantes.' }], null, true);
  const c = l.company, signals = [];
  if (c.situacao !== 'ATIVA') signals.push({ pts: 35, label: 'CNPJ não está ativo', detail: `Situação: ${c.situacao}.` });
  const days = (Date.now() - new Date(c.abertura).getTime()) / 864e5;
  if (days < 180) signals.push({ pts: 25, label: 'Empresa muito nova', detail: `Aberta há ${Math.max(0, Math.round(days))} dias.` });
  return out(c.fantasia || c.nome, signals.reduce((a, x) => a + x.pts, 0), signals, c);
}
