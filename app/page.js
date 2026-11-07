'use client';
import { useState } from 'react';

const L = {
  alto: { color: '#22c55e', title: 'Empresa confirmada', bg: '#0f2e1c' },
  medio: { color: '#f59e0b', title: 'Confirmada, com ressalvas', bg: '#33260a' },
  baixo: { color: '#ef4444', title: 'Não conseguimos confirmar', bg: '#33121a' },
};
const ICON = { good: ['✓', '#22c55e'], warn: ['!', '#f59e0b'], bad: ['✕', '#ef4444'] };
const EXAMPLES = ['casasbahia.com.br', 'magazineluiza.com.br', '08.170.849/0001-15'];

const fmtCNPJ = (c = '') => c.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtDate = (d = '') => (/^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split('-').reverse().join('/') : d);

export default function Home() {
  const [url, setUrl] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function check(value = url) {
    setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/check', { method: 'POST', body: JSON.stringify({ url: value }) });
      const j = await r.json();
      r.ok ? setRes(j) : setErr(j.error);
    } catch { setErr('Falha de conexão. Tente de novo.'); }
    setLoading(false);
  }

  const lv = res && L[res.level];
  const share = res && `✅ ConfirmaCNPJ: ${res.host} → ${res.title || lv.title} (confiança ${res.score}/100). Confira você também: https://confirmacnpj.vercel.app`;

  return (
    <main className="wrap">
      <div className="brand"><i>✓</i> ConfirmaCNPJ</div>
      <h1>Essa empresa <span>existe de verdade?</span></h1>
      <p className="sub">Cole o link do site ou o CNPJ e confirme na Receita Federal em segundos.</p>

      <form className="search" onSubmit={(e) => { e.preventDefault(); check(); }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Site ou CNPJ (00.000.000/0001-00)" required aria-label="Site ou CNPJ" />
        <button disabled={loading}>{loading ? 'Analisando…' : 'Verificar'}</button>
      </form>
      <div className="chips">Teste:
        {EXAMPLES.map((e) => <button key={e} type="button" className="chip" onClick={() => { setUrl(e); check(e); }}>{e}</button>)}
      </div>

      {loading && <div className="spin">Lendo o site e consultando a Receita…</div>}
      {err && <div className="err">{err}</div>}

      {res && (
        <section className="card" aria-live="polite">
          <div className="head">
            <div className="ring">
              <svg width="112" height="112" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="48" fill="none" stroke="#242c4a" strokeWidth="10" />
                <circle cx="56" cy="56" r="48" fill="none" stroke={res.unavailable ? '#98a2c8' : lv.color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(res.unavailable ? 0 : res.score) * 3.016} 302`} />
              </svg>
              <b>{res.unavailable ? '—' : res.score}</b>
            </div>
            <div>
              <span className="badge" style={{ background: res.unavailable ? '#242c4a' : lv.bg, color: res.unavailable ? '#98a2c8' : lv.color }}>
                {res.unavailable ? 'Consulta indisponível' : res.title || lv.title}
              </span>
              <h2>{res.company?.fantasia || res.company?.nome || res.host}</h2>
              <p>{res.host}</p>
            </div>
          </div>

          {res.notice && <div className="notice">{res.notice}</div>}

          {res.company && (
            <div className="company">
              <div className="full"><small>Razão social</small><span>{res.company.nome}</span></div>
              <div><small>CNPJ</small><span>{fmtCNPJ(res.company.cnpj)}</span></div>
              <div><small>Situação</small><span style={{ color: res.company.situacao === 'ATIVA' ? '#22c55e' : '#ef4444' }}>{res.company.situacao}</span></div>
              <div><small>Abertura</small><span>{fmtDate(res.company.abertura)}</span></div>
              <div><small>Local</small><span>{res.company.municipio}/{res.company.uf}</span></div>
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
            <a className="btn wa" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(share)}`}>Compartilhar no WhatsApp</a>
            <button className="btn ghost" onClick={() => { setRes(null); setUrl(''); }}>Nova consulta</button>
          </div>
        </section>
      )}

      <div className="how">
        <div><b>1. Cole</b><span>O link do site ou o CNPJ da empresa.</span></div>
        <div><b>2. Conferimos</b><span>Lemos o site, pesquisamos a marca e consultamos Receita e Registro.br.</span></div>
        <div><b>3. Decida</b><span>Veja se está ativa, há quanto tempo e os alertas.</span></div>
      </div>
      <footer>Dados públicos da Receita Federal. É um apoio à decisão: em negócios de valor alto, confira outras fontes. Hack Brasil.</footer>
    </main>
  );
}
