// Créditos simulados: 10 consultas por hora por IP.
// Em memória: não precisa de banco nem de variável de ambiente. Na Vercel cada instância
// tem o próprio contador (melhor esforço); para produção, trocar por Upstash/Vercel KV.
export const LIMIT = 10;
const WINDOW = 60 * 60 * 1000;
const MAX_KEYS = 5000;
const hits = (globalThis.__confirmacnpjRL ||= new Map());

export function clientIp(req) {
  const h = req.headers;
  return (h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
}

export function takeCredit(ip) {
  const now = Date.now();
  if (hits.size >= MAX_KEYS) {
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    while (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value); // descarta os mais antigos
  }
  let e = hits.get(ip);
  if (!e || e.reset <= now) { e = { count: 0, reset: now + WINDOW }; hits.set(ip, e); }
  if (e.count >= LIMIT) return { ok: false, remaining: 0, limit: LIMIT, resetAt: e.reset };
  e.count++;
  return { ok: true, remaining: LIMIT - e.count, limit: LIMIT, resetAt: e.reset };
}
