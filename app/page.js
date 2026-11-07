'use client';
import { useEffect, useState } from 'react';

const REPO = 'https://github.com/DaniloVargasDaSilva/confirmacnpj-';
const EXAMPLES = ['casasbahia.com.br', 'magazineluiza.com.br', '13.347.016/0001-17'];

const I18N = {
  pt: {
    demo: 'Projeto rápido de demonstração do hackathon Hack Brasil',
    h1: 'Antes de pagar, confira se a empresa existe.',
    lede: 'Cole o endereço do site ou o CNPJ. Consultamos a Receita Federal, o registro do domínio e buscas na web, e devolvemos um comprovante.',
    explain: null,
    label: 'Site ou CNPJ da empresa',
    ph: 'loja.com.br ou 00.000.000/0001-00',
    go: 'Verificar', busy: 'Verificando…',
    examples: 'Exemplos',
    credits: (r, l) => <>Você tem <b>{r} de {l}</b> consultas nesta hora.</>,
    conn: 'Sem conexão com o servidor. Confira sua internet e tente de novo.',
    docTitle: 'Comprovante de verificação',
    docEmpty: 'Em branco até a primeira consulta',
    issued: (d) => `Emitido em ${d}`,
    emptyHint: 'Faça uma consulta para preencher este comprovante.',
    steps: { site: 'Lendo o site', web: 'Pesquisando a marca na web', rf: 'Consultando a Receita Federal', rdap: 'Consultando o Registro.br' },
    stamp: { alto: 'Confirmada', medio: 'Com ressalvas', baixo: 'Não confirmada', inc: 'Inconclusiva', off: 'Indisponível', idle: 'Aguardando' },
    verdict: { alto: 'A empresa existe, está ativa e as verificações batem.', medio: 'A empresa existe, mas há pontos de atenção.', baixo: 'Não conseguimos confirmar esta empresa.', off: 'A consulta à Receita não respondeu. Tente de novo em instantes.' },
    f: { nome: 'Razão social', cnpj: 'CNPJ', sit: 'Situação', open: 'Aberta em', loc: 'Município', site: 'Site analisado' },
    trust: 'Confiança', of: 'de',
    checks: 'Verificações',
    sources: 'Fontes: Receita Federal (via BrasilAPI), Registro.br, buscas na web (Firecrawl) e Reclame Aqui.',
    again: 'Nova consulta',
    foot: 'Dados públicos da Receita Federal e do Registro.br. Use como apoio à decisão: em negócios de valor alto, confira outras fontes.',
    foot2: 'Demonstração feita em poucas horas no hackathon Hack Brasil. Código aberto sob licença MIT.',
    repo: 'Código no GitHub',
    themeLight: 'Usar tema claro', themeDark: 'Usar tema escuro',
    buy: 'Compre créditos', wop: 'Work in process',
    limitMsg: (m) => `Você usou as 10 consultas desta hora. Novas consultas liberam em cerca de ${m} min.`,
    later: 'A compra de créditos será desenvolvida em outro momento: este é um projeto de demonstração de hackathon.',
    buyBtn: 'Comprar créditos', ok: 'Entendi',
    status: {},
  },
  en: {
    demo: 'Quick demo project built for the Hack Brasil hackathon',
    h1: 'Before you pay, check the company is real.',
    lede: 'Paste a website address or a CNPJ. We check Brazil’s Federal Revenue registry, the domain registration and web searches, and give you a verification slip.',
    explain: <><strong>What is a CNPJ?</strong> Brazil’s 14-digit company tax ID (<i>Cadastro Nacional da Pessoa Jurídica</i>), issued by the Federal Revenue Service. Every registered business has one, and its record is public: legal name, status, opening date and city.</>,
    label: 'Company website or CNPJ',
    ph: 'store.com.br or 00.000.000/0001-00',
    go: 'Verify', busy: 'Verifying…',
    examples: 'Examples',
    credits: (r, l) => <>You have <b>{r} of {l}</b> checks left this hour.</>,
    conn: 'Could not reach the server. Check your connection and try again.',
    docTitle: 'Verification slip',
    docEmpty: 'Blank until your first check',
    issued: (d) => `Issued ${d}`,
    emptyHint: 'Run a check to fill in this slip.',
    steps: { site: 'Reading the site', web: 'Searching the brand on the web', rf: 'Checking the Federal Revenue registry', rdap: 'Checking Registro.br' },
    stamp: { alto: 'Confirmed', medio: 'With caveats', baixo: 'Not confirmed', inc: 'Inconclusive', off: 'Unavailable', idle: 'Awaiting' },
    verdict: { alto: 'The company exists, is active and the checks agree.', medio: 'The company exists, but some points need attention.', baixo: 'We could not confirm this company.', off: 'The registry lookup did not respond. Try again shortly.' },
    f: { nome: 'Legal name', cnpj: 'CNPJ', sit: 'Status', open: 'Opened', loc: 'City', site: 'Site checked' },
    trust: 'Trust', of: 'of',
    checks: 'Checks',
    sources: 'Sources: Brazil’s Federal Revenue (via BrasilAPI), Registro.br, web searches (Firecrawl) and Reclame Aqui.',
    again: 'New check',
    foot: 'Public data from Brazil’s Federal Revenue and Registro.br. Use it as a decision aid: for high-value deals, check other sources too.',
    foot2: 'Demo built in a few hours at the Hack Brasil hackathon. Open source under the MIT license.',
    repo: 'Code on GitHub',
    themeLight: 'Switch to light theme', themeDark: 'Switch to dark theme',
    buy: 'Buy credits', wop: 'Work in process',
    limitMsg: (m) => `You have used your 10 checks for this hour. New checks unlock in about ${m} min.`,
    later: 'Buying credits will be developed at a later time: this is a hackathon demo project.',
    buyBtn: 'Buy credits', ok: 'Got it',
    status: { ATIVA: 'Active', BAIXADA: 'Closed', SUSPENSA: 'Suspended', INAPTA: 'Ineligible', NULA: 'Void' },
  },
};

const TONE = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', mute: 'var(--ink-3)' };
const GLYPH = { good: '✓', warn: '!', bad: '✕' };
const RANK = { bad: 0, warn: 1, good: 2 };
const STAMP = { alto: ['good', '✓'], medio: ['warn', '!'], baixo: ['bad', '✕'], inc: ['warn', '?'], off: ['mute', '–'] };

const digits = (v) => v.replace(/\D/g, '');
const isCnpjLike = (v) => /^[\d.\/\-\s]+$/.test(v) && digits(v).length > 0;
// Máscara progressiva: 13347016000117 -> 13.347.016/0001-17
function maskCNPJ(v) {
  const d = digits(v).slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '.' + d.slice(2, 5);
  if (d.length > 5) out += '.' + d.slice(5, 8);
  if (d.length > 8) out += '/' + d.slice(8, 12);
  if (d.length > 12) out += '-' + d.slice(12, 14);
  return out;
}
const fmtCNPJ = (c = '') => maskCNPJ(c);
const fmtDate = (d = '', lang) => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  const [y, m, day] = d.slice(0, 10).split('-');
  return lang === 'pt' ? `${day}/${m}/${y}` : new Date(`${y}-${m}-${day}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};

// Faixa de guilhoché, como em papel de segurança de certidões.
const GUILLOCHE = Array.from({ length: 12 }, (_, k) => {
  const pts = [];
  for (let x = 0; x <= 600; x += 5) {
    const y = 29 + 21 * Math.sin(x / 31 + k * 0.52) * Math.cos(x / 89 - k * 0.27);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
});

function Seal() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="var(--gov)" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="var(--sheet)" strokeWidth="2" strokeDasharray="2.6 3.2" opacity=".85" />
      <path d="M21.5 33l7 7L43 25.5" fill="none" stroke="var(--sheet)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Cone de obra: marca o que ainda está em construção.
function ConeIcon() {
  return (
    <svg className="stamp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.6 3h4.8l5.1 17H4.5z" />
      <path d="M7.7 10h8.6M6.3 15h11.4" />
      <path d="M2.5 20.5h19" />
    </svg>
  );
}

function Stamp({ kind, label, date, idle, small, icon, pressKey }) {
  const [tone, glyph] = STAMP[kind] || ['mute', ''];
  return (
    <div key={pressKey} className={`stamp${idle ? ' idle' : ' pressed'}${small ? ' small' : ''}`} style={{ '--tone': TONE[tone] }} role="img" aria-label={label}>
      <span className="stamp-main">{icon}{!idle && !small && !icon && <span className="stamp-glyph" aria-hidden="true">{glyph}</span>}{label}</span>
      {date && <span className="stamp-date">{date}</span>}
    </div>
  );
}

function ThemeIcon({ dark }) {
  return dark ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" /></svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState('pt');
  const [theme, setTheme] = useState('light');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [issued, setIssued] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [askedCnpj, setAskedCnpj] = useState(false);
  const [credits, setCredits] = useState(null);
  const [limit, setLimit] = useState(false);
  const t = I18N[lang];

  useEffect(() => {
    const saved = store.get('lang');
    setLang(saved === 'pt' || saved === 'en' ? saved : (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
    setTheme(document.documentElement.dataset.theme || 'light');
  }, []);
  useEffect(() => { document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'; }, [lang]);
  useEffect(() => {
    if (!limit) return;
    const esc = (e) => e.key === 'Escape' && setLimit(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [limit]);

  const pickLang = (l) => { setLang(l); store.set('lang', l); setRes(null); setErr(''); };
  const toggleTheme = () => {
    const n = theme === 'dark' ? 'light' : 'dark';
    setTheme(n); document.documentElement.dataset.theme = n; store.set('theme', n);
  };
  const onType = (v) => setQ(isCnpjLike(v) ? maskCNPJ(v) : v);

  async function check(value = q) {
    const v = value.trim();
    if (!v) return;
    setLoading(true); setErr(''); setRes(null); setAskedCnpj(isCnpjLike(v));
    try {
      const r = await fetch('/api/check', { method: 'POST', body: JSON.stringify({ url: v, lang }) });
      const j = await r.json();
      if (j.credits) setCredits(j.credits);
      if (r.status === 429) setLimit(true);
      else if (r.ok) {
        setRes(j);
        setIssued(new Date().toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }));
      } else setErr(j.error);
    } catch { setErr(t.conn); }
    setLoading(false);
  }

  const kind = res ? (res.unavailable ? 'off' : res.title ? 'inc' : res.level) : null;
  const verdict = res && (res.title ? res.title : t.verdict[kind] || '');
  const signals = res ? [...res.signals].sort((a, b) => RANK[a.type] - RANK[b.type]) : [];
  const stampDate = issued && issued.split(/,?\s/)[0];
  const meterTone = TONE[(STAMP[kind] || ['mute'])[0]];
  const steps = askedCnpj ? [t.steps.rf] : [t.steps.site, t.steps.web, t.steps.rdap, t.steps.rf];
  const minsLeft = Math.max(1, Math.ceil(((credits?.resetAt || Date.now()) - Date.now()) / 60000));

  return (
    <div className="page">
      <header className="bar">
        <a className="brand" href="/"><Seal /><span>ConfirmaCNPJ</span></a>
        <p className="bar-note">{t.demo}</p>
        <nav className="bar-tools" aria-label="Preferências">
          <div className="lang" role="group" aria-label="Idioma / Language">
            <button type="button" aria-pressed={lang === 'pt'} onClick={() => pickLang('pt')}>PT</button>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => pickLang('en')}>EN</button>
          </div>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t.themeLight : t.themeDark} title={theme === 'dark' ? t.themeLight : t.themeDark}>
            <ThemeIcon dark={theme === 'dark'} />
          </button>
          <a className="icon-btn" href={REPO} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
            <span className="gh-label">GitHub</span>
          </a>
        </nav>
      </header>

      <main className="main">
        <section className="intro">
          <h1>{t.h1}</h1>
          <p className="lede">{t.lede}</p>
          {t.explain && <p className="explain">{t.explain}</p>}

          <form className="query" onSubmit={(e) => { e.preventDefault(); check(); }}>
            <label htmlFor="q">{t.label}</label>
            <div className="query-row">
              <input id="q" value={q} onChange={(e) => onType(e.target.value)} placeholder={t.ph} required autoComplete="off" spellCheck="false" inputMode="url" />
              <button disabled={loading}>{loading ? t.busy : t.go}</button>
            </div>
          </form>

          <p className="examples">
            <span>{t.examples}</span>
            {EXAMPLES.map((e) => <button key={e} type="button" onClick={() => { setQ(e); check(e); }}>{e}</button>)}
          </p>

          {credits && <p className="credits">{t.credits(credits.remaining, credits.limit)}</p>}
          {err && <p className="error" role="alert">{err}</p>}
        </section>

        <section className="doc-wrap" aria-live="polite" aria-busy={loading}>
          <article className="doc">
            <svg className="guilloche" viewBox="0 0 600 58" preserveAspectRatio="none" aria-hidden="true">
              {GUILLOCHE.map((d, i) => <path key={i} d={d} />)}
            </svg>
            <header className="doc-head">
              <div>
                <h2>{t.docTitle}</h2>
                <p>{res && issued ? t.issued(issued) : t.docEmpty}</p>
              </div>
              {res
                ? <Stamp pressKey={issued} kind={kind} label={t.stamp[kind]} date={stampDate} />
                : <Stamp idle kind="off" label={loading ? '…' : t.stamp.idle} />}
            </header>

            {!res && !loading && (
              <>
                <dl className="fields">
                  <div className="wide"><dt>{t.f.nome}</dt><dd><span className="blank" /></dd></div>
                  <div className="c1"><dt>{t.f.cnpj}</dt><dd><span className="blank" /></dd></div>
                  <div className="c2"><dt>{t.f.sit}</dt><dd><span className="blank" /></dd></div>
                  <div className="c1"><dt>{t.f.open}</dt><dd><span className="blank" /></dd></div>
                  <div className="c2"><dt>{t.f.loc}</dt><dd><span className="blank" /></dd></div>
                </dl>
                <p className="empty-hint">{t.emptyHint}</p>
              </>
            )}

            {loading && (
              <ul className="steps">
                {steps.map((s, i) => <li key={s} style={{ '--i': i }}>{s}</li>)}
              </ul>
            )}

            {res && (
              <>
                <div className="subject">
                  <h3>{res.company?.fantasia || res.company?.nome || res.host}</h3>
                  <p>{verdict}</p>
                </div>
                {res.notice && <p className="notice">{res.notice}</p>}

                <dl className="fields">
                  {res.company ? (
                    <>
                      <div className="wide"><dt>{t.f.nome}</dt><dd>{res.company.nome}</dd></div>
                      <div className="c1"><dt>{t.f.cnpj}</dt><dd>{fmtCNPJ(res.company.cnpj)}</dd></div>
                      <div className="c2"><dt>{t.f.sit}</dt><dd style={{ color: res.company.situacao === 'ATIVA' ? 'var(--good)' : 'var(--bad)' }}>{res.company.situacao === 'ATIVA' ? '✓ ' : '✕ '}{t.status[res.company.situacao] || res.company.situacao.charAt(0) + res.company.situacao.slice(1).toLowerCase()}</dd></div>
                      <div className="c1"><dt>{t.f.open}</dt><dd>{fmtDate(res.company.abertura, lang)}</dd></div>
                      <div className="c2"><dt>{t.f.loc}</dt><dd>{res.company.municipio}/{res.company.uf}</dd></div>
                    </>
                  ) : (
                    <div className="wide"><dt>{askedCnpj ? t.f.cnpj : t.f.site}</dt><dd>{askedCnpj ? fmtCNPJ(res.host) : res.host}</dd></div>
                  )}
                  {res.company && !askedCnpj && <div className="wide"><dt>{t.f.site}</dt><dd>{res.host}</dd></div>}
                </dl>

                {!res.unavailable && (
                  <div className="meter" style={{ '--tone': meterTone }}>
                    <div className="meter-top"><span>{t.trust}</span><b>{res.score} {t.of} 100</b></div>
                    <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={res.score} aria-label={t.trust}>
                      <div className="meter-fill" style={{ width: `${Math.max(2, res.score)}%` }} />
                    </div>
                  </div>
                )}

                <div className="checks">
                  <h4>{t.checks}</h4>
                  <ul>
                    {signals.map((s) => (
                      <li key={s.label}>
                        <span className="glyph" style={{ '--tone': TONE[s.type] }} aria-hidden="true">{GLYPH[s.type]}</span>
                        <div><b>{s.label}</b><small>{s.detail}</small></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <p className="sources">{t.sources}</p>
          </article>

          {res && (
            <div className="actions">
              <button type="button" className="btn btn-quiet" onClick={() => { setRes(null); setQ(''); document.getElementById('q')?.focus(); }}>{t.again}</button>
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        <p>{t.foot}</p>
        <p>{t.foot2} <a href={REPO} target="_blank" rel="noreferrer">{t.repo}</a></p>
      </footer>

      {limit && (
        <div className="overlay" onClick={() => setLimit(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={(e) => e.stopPropagation()}>
            <Stamp kind="medio" small icon={<ConeIcon />} label={t.wop} />
            <h2 id="buy-title">{t.buy}</h2>
            <p>{t.limitMsg(minsLeft)}</p>
            <p className="sheet-note">{t.later}</p>
            <div className="sheet-actions">
              <button type="button" className="btn btn-primary" disabled title={t.wop}>{t.buyBtn}</button>
              <button type="button" className="btn btn-quiet" onClick={() => setLimit(false)} autoFocus>{t.ok}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
