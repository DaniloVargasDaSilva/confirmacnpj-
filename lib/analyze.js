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

export async function lookupCNPJ(cnpj) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
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
      company = await lookupCNPJ(valid);
      if (company) {
        const days = (Date.now() - new Date(company.data_inicio_atividade).getTime()) / 864e5;
        if (company.descricao_situacao_cadastral !== 'ATIVA') add(35, 'CNPJ não está ativo', `Situação: ${company.descricao_situacao_cadastral}.`);
        if (days < 180) add(25, 'Empresa muito nova', `Aberta há ${Math.max(0, Math.round(days))} dias.`);
      }
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
    company: company && { nome: company.razao_social, cnpj: company.cnpj, abertura: company.data_inicio_atividade, situacao: company.descricao_situacao_cadastral, municipio: company.municipio, uf: company.uf },
  };
}

export async function checkCNPJ(raw) {
  const cnpj = raw.replace(/\D/g, '');
  const signals = [];
  if (!validCNPJ(cnpj)) {
    signals.push({ pts: 100, label: 'CNPJ inválido', detail: 'O número não passa na validação dos dígitos verificadores.' });
    return { host: cnpj, score: 100, level: 'alto', signals, company: null };
  }
  const c = await lookupCNPJ(cnpj);
  if (!c) {
    signals.push({ pts: 60, label: 'CNPJ não encontrado', detail: 'Não existe na base da Receita (via BrasilAPI) ou ela está fora do ar.' });
    return { host: cnpj, score: 60, level: 'alto', signals, company: null };
  }
  if (c.descricao_situacao_cadastral !== 'ATIVA') signals.push({ pts: 35, label: 'CNPJ não está ativo', detail: `Situação: ${c.descricao_situacao_cadastral}.` });
  const days = (Date.now() - new Date(c.data_inicio_atividade).getTime()) / 864e5;
  if (days < 180) signals.push({ pts: 25, label: 'Empresa muito nova', detail: `Aberta há ${Math.max(0, Math.round(days))} dias.` });
  const score = signals.reduce((s, x) => s + x.pts, 0);
  return { host: c.nome_fantasia || c.razao_social, score, level: score < 25 ? 'baixo' : score < 55 ? 'medio' : 'alto', signals,
    company: { nome: c.razao_social, cnpj: c.cnpj, abertura: c.data_inicio_atividade, situacao: c.descricao_situacao_cadastral, municipio: c.municipio, uf: c.uf } };
}
