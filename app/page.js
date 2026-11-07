'use client';
import { useEffect, useState } from 'react';

const REPO = 'https://github.com/DaniloVargasDaSilva/confirmacnpj-';
const EXAMPLES = ['casasbahia.com.br', 'magazineluiza.com.br', '13.347.016/0001-17'];

const I18N = {
  pt: {
    demo: '⚡ Projeto rápido de demonstração do hackathon Hack Brasil',
    h1a: 'Essa empresa ', h1b: 'existe de verdade?',
    sub: 'Cole o link do site ou o CNPJ e confirme na Receita Federal em segundos.',
    what: null,
    ph: 'Site ou CNPJ (00.000.000/0001-00)', go: 'Verificar', busy: 'Analisando…',
    loading: 'Lendo o site, pesquisando a marca e consultando a Receita…',
    test: 'Teste:', again: 'Nova consulta', wa: 'Compartilhar no WhatsApp', conn: 'Falha de conexão. Tente de novo.',
    titles: { alto: 'Empresa confirmada', medio: 'Confirmada, com ressalvas', baixo: 'Não conseguimos confirmar' },
    unavailable: 'Consulta indisponível', trust: 'confiança',
    f: { nome: 'Razão social', cnpj: 'CNPJ', sit: 'Situação', open: 'Abertura', loc: 'Local' },
    how: [['1. Cole', 'O link do site ou o CNPJ da empresa.'], ['2. Conferimos', 'Lemos o site, pesquisamos a marca e consultamos Receita e Registro.br.'], ['3. Decida', 'Veja se está ativa, há quanto tempo e os alertas.']],
    foot: 'Dados públicos da Receita Federal. É um apoio à decisão: em negócios de valor alto, confira outras fontes.',
    foot2: 'Projeto rápido de demonstração criado no hackathon Hack Brasil. Código aberto (MIT).',
    repo: 'Ver código', theme: 'Tema', status: {},
  },
  en: {
    demo: '⚡ Quick demo project built for the Hack Brasil hackathon',
    h1a: 'Does this company ', h1b: 'really exist?',
    sub: 'Paste a website or a CNPJ and verify it against Brazil’s Federal Revenue registry in seconds.',
    what: '<b>What is a CNPJ?</b> It is Brazil’s 14-digit company tax ID (<i>Cadastro Nacional da Pessoa Jurídica</i>), issued by the Federal Revenue Service (<i>Receita Federal</i>). Every legally registered business in Brazil has one, and the record is public: legal name, status (active or closed), opening date and location. Checking it is the fastest way to know if a Brazilian company is real.',
    ph: 'Website or CNPJ (00.000.000/0001-00)', go: 'Verify', busy: 'Analyzing…',
    loading: 'Reading the site, searching the brand and checking the registry…',
    test: 'Try:', again: 'New check', wa: 'Share on WhatsApp', conn: 'Connection failed. Please try again.',
    titles: { alto: 'Company confirmed', medio: 'Confirmed, with caveats', baixo: 'Could not confirm' },
    unavailable: 'Lookup unavailable', trust: 'trust',
    f: { nome: 'Legal name', cnpj: 'CNPJ', sit: 'Status', open: 'Opened', loc: 'Location' },
    how: [['1. Paste', 'The website link or the company’s CNPJ.'], ['2. We check', 'We read the site, search the brand and query the Federal Revenue and Registro.br.'], ['3. Decide', 'See if it is active, how old it is and any warnings.']],
    foot: 'Public data from Brazil’s Federal Revenue. A decision aid: for high-value deals, check other sources too.',
    foot2: 'Quick demo project created at the Hack Brasil hackathon. Open source (MIT).',
    repo: 'View code', theme: 'Theme',
    status: { ATIVA: 'ACTIVE', BAIXADA: 'CLOSED', SUSPENSA: 'SUSPENDED', INAPTA: 'INELIGIBLE', NULA: 'VOID' },
  },
};
const COLORS = { alto: 'var(--good)', medio: 'var(--warn)', baixo: 'var(--bad)' };
const ICON = { good: ['✓', 'var(--good)'], warn: ['!', 'var(--warn)'], bad: ['✕', 'var(--bad)'] };

const fmtCNPJ = (c = '') => c.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtDate = (d = '', lang) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? (lang === 'pt' ? d.slice(0, 10).split('-').reverse().join('/') : d.slice(0, 10)) : d);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
};

function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d6bff" /><stop offset="1" stopColor="#22d3ee" /></linearGradient></defs>
      <rect width="64" height="64" rx="16" fill="url(#lg)" />
      <path d="M32 11l17 6.5V31c0 10.5-7.2 18.5-17 22.5C22.2 49.5 15 41.5 15 31V17.5z" fill="#fff" fillOpacity=".96" />
      <path d="M23.5 31.5l6 6 11.5-13.5" fill="none" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [lang, setLang] = useState('pt');
  const [theme, setTheme] = useState('dark');
  const [url, setUrl] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const t = I18N[lang];

  useEffect(() => {
    const saved = store.get('lang');
    setLang(saved === 'pt' || saved === 'en' ? saved : (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en');
    setTheme(document.documentElement.dataset.theme || 'dark');
  }, []);
  useEffect(() => { document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'; }, [lang]);

  const pickLang = (l) => { setLang(l); store.set('lang', l); setRes(null); setErr(''); };
  const toggleTheme = () => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); document.documentElement.dataset.theme = n; store.set('theme', n); };

  async function check(value = url) {
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/check', { method: 'POST', body: JSON.stringify({ url: value, lang }) });
      const j = await r.json();
      r.ok ? setRes(j) : setErr(j.error);
    } catch { setErr(t.conn); }
    setLoading(false);
  }

  const color = res && COLORS[res.level];
  const title = res && (res.title || t.titles[res.level]);
  const share = res && `✅ ConfirmaCNPJ: ${res.host} → ${title} (${t.trust} ${res.score}/100). https://confirmacnpj.vercel.app`;

  return (
    <main className="wrap">
      <div className="top">
        <div className="brand"><Logo /> ConfirmaCNPJ</div>
        <div className="tools">
          <div className="seg" role="group" aria-label="Idioma / Language">
            <button aria-pressed={lang === 'pt'} onClick={() => pickLang('pt')}>PT</button>
            <button aria-pressed={lang === 'en'} onClick={() => pickLang('en')}>EN</button>
          </div>
          <button className="tool" onClick={toggleTheme} aria-label={t.theme} title={t.theme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <a className="tool" href={REPO} target="_blank" rel="noreferrer">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
            GitHub
          </a>
        </div>
      </div>

      <span className="demo">{t.demo}</span>
      <h1>{t.h1a}<span>{t.h1b}</span></h1>
      <p className="sub">{t.sub}</p>
      {t.what && <p className="what" dangerouslySetInnerHTML={{ __html: t.what }} />}

      <form className="search" onSubmit={(e) => { e.preventDefault(); check(); }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.ph} required aria-label={t.ph} />
        <button disabled={loading}>{loading ? t.busy : t.go}</button>
      </form>
      <div className="chips">{t.test}
        {EXAMPLES.map((e) => <button key={e} type="button" className="chip" onClick={() => { setUrl(e); check(e); }}>{e}</button>)}
      </div>

      {loading && <div className="spin">{t.loading}</div>}
      {err && <div className="err">{err}</div>}

      {res && (
        <section className="card" aria-live="polite">
          <div className="head">
            <div className="ring">
              <svg width="112" height="112" viewBox="0 0 112 112">
                <circle className="track" cx="56" cy="56" r="48" fill="none" strokeWidth="10" />
                <circle cx="56" cy="56" r="48" fill="none" stroke={res.unavailable ? 'var(--mut)' : color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(res.unavailable ? 0 : res.score) * 3.016} 302`} />
              </svg>
              <b>{res.unavailable ? '—' : res.score}</b>
            </div>
            <div>
              <span className="badge" style={{ color: res.unavailable ? 'var(--mut)' : color, background: `color-mix(in srgb, ${res.unavailable ? 'var(--mut)' : color} 16%, transparent)` }}>
                {res.unavailable ? t.unavailable : title}
              </span>
              <h2>{res.company?.fantasia || res.company?.nome || res.host}</h2>
              <p>{res.host}</p>
            </div>
          </div>

          {res.notice && <div className="notice">{res.notice}</div>}

          {res.company && (
            <div className="company">
              <div className="full"><small>{t.f.nome}</small><span>{res.company.nome}</span></div>
              <div><small>{t.f.cnpj}</small><span>{fmtCNPJ(res.company.cnpj)}</span></div>
              <div><small>{t.f.sit}</small><span style={{ color: res.company.situacao === 'ATIVA' ? 'var(--good)' : 'var(--bad)' }}>{t.status[res.company.situacao] || res.company.situacao}</span></div>
              <div><small>{t.f.open}</small><span>{fmtDate(res.company.abertura, lang)}</span></div>
              <div><small>{t.f.loc}</small><span>{res.company.municipio}/{res.company.uf}</span></div>
            </div>
          )}

          <ul className="list">
            {res.signals.map((s) => (
              <li key={s.label} style={{ borderColor: ICON[s.type][1] }}>
                <em style={{ color: ICON[s.type][1] }}>{ICON[s.type][0]}</em>
                <div><b>{s.label}</b><small>{s.detail}</small></div>
              </li>
            ))}
          </ul>

          <div className="actions">
            <a className="btn wa" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(share)}`}>{t.wa}</a>
            <button className="btn ghost" onClick={() => { setRes(null); setUrl(''); }}>{t.again}</button>
          </div>
        </section>
      )}

      <div className="how">{t.how.map(([b, s]) => <div key={b}><b>{b}</b><span>{s}</span></div>)}</div>
      <footer>
        <span>{t.foot}</span>
        <span>{t.foot2} <a href={REPO} target="_blank" rel="noreferrer">{t.repo} →</a></span>
      </footer>
    </main>
  );
}
