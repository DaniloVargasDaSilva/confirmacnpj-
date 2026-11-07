'use client';
import { useState } from 'react';

const COLORS = { baixo: '#22c55e', medio: '#f59e0b', alto: '#ef4444' };
const TITLES = { baixo: 'Empresa confirmada', medio: 'Confirmada, com alertas', alto: 'Não conseguimos confirmar' };

export default function Home() {
  const [url, setUrl] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function check(e) {
    e.preventDefault(); setLoading(true); setErr(''); setRes(null);
    try {
      const r = await fetch('/api/check', { method: 'POST', body: JSON.stringify({ url }) });
      const j = await r.json();
      r.ok ? setRes(j) : setErr(j.error);
    } catch { setErr('Falha de conexão.'); }
    setLoading(false);
  }

  const share = res && `✅ ConfirmaCNPJ: ${res.host} → ${TITLES[res.level]} (risco ${res.score}/100). Confira você também: confirmacnpj.vercel.app`;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 40, margin: 0 }}>✅ ConfirmaCNPJ</h1>
      <p style={{ color: '#aab', fontSize: 18 }}>Antes de comprar ou fechar negócio, confirme se a empresa existe. Cole o link do site ou o CNPJ.</p>
      <form onSubmit={check} style={{ display: 'flex', gap: 8 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="link do site ou CNPJ (00.000.000/0001-00)" required
          style={{ flex: 1, padding: 14, borderRadius: 10, border: '1px solid #334', background: '#141a33', color: '#fff', fontSize: 16 }} />
        <button disabled={loading} style={{ padding: '0 22px', borderRadius: 10, border: 0, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
          {loading ? 'Analisando…' : 'Verificar'}
        </button>
      </form>
      {err && <p style={{ color: '#f87171' }}>{err}</p>}
      {res && (
        <section style={{ marginTop: 28, background: '#141a33', borderRadius: 16, padding: 24, border: `2px solid ${COLORS[res.level]}` }}>
          {res.unavailable ? <h2>⚠️ Consulta indisponível</h2> : <><div style={{ fontSize: 56, fontWeight: 800, color: COLORS[res.level] }}>{res.score}<span style={{ fontSize: 20 }}>/100 de risco</span></div>
          <h2 style={{ margin: '0 0 4px' }}>{TITLES[res.level]}</h2></>}
          <p style={{ color: '#aab', marginTop: 0 }}>{res.host}</p>
          {res.company && <p style={{ background: '#0b1020', padding: 12, borderRadius: 8, fontSize: 14 }}>🏢 {res.company.nome} · CNPJ {res.company.cnpj} · {res.company.situacao} · aberta em {res.company.abertura} · {res.company.municipio}/{res.company.uf}</p>}
          {res.signals.length === 0 ? <p>Empresa ativa e sem sinais de alerta.</p> :
            <ul style={{ paddingLeft: 18 }}>{res.signals.map((s) => <li key={s.label} style={{ marginBottom: 8 }}><b>{s.label}</b> <span style={{ color: '#f87171' }}>+{s.pts}</span><br /><span style={{ color: '#aab' }}>{s.detail}</span></li>)}</ul>}
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, background: '#22c55e', color: '#052', padding: '10px 16px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>Avisar no WhatsApp</a>
        </section>
      )}
      <footer style={{ marginTop: 48, color: '#778', fontSize: 13 }}>Dados da Receita Federal via BrasilAPI e leitura do site via Firecrawl. Hack Brasil.</footer>
    </main>
  );
}
