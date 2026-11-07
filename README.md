# ✅ ConfirmaCNPJ

Cole o link de um site (ou um CNPJ) e confirme se a empresa existe, está ativa e há quanto tempo foi aberta.

**Como funciona:** [Firecrawl](https://firecrawl.dev) lê a página → extrai CNPJ, urgência, descontos, contato e política de troca → valida o CNPJ e consulta a situação na [BrasilAPI](https://brasilapi.com.br) (grátis, sem chave) → devolve a nota.

**Stack:** Next.js (App Router), sem ORM, sem banco. Uma única env var: `FIRECRAWL_API_KEY`.

## Rodar
```bash
cp .env.example .env.local   # coloque sua chave
npm install && npm run dev
```

## Deploy (Vercel)
Importe o repo e adicione `FIRECRAWL_API_KEY`. Pronto.

## Modelo de negócio
- **B2C:** grátis com limite diário; plano Pro com alertas e extensão de navegador.
- **B2B:** API de risco para marketplaces, bancos (antifraude Pix), Procons e provedores de anúncios cobrada por consulta.
- **Impacto:** o Brasil perde bilhões por ano em golpes de e-commerce; confirmar a empresa antes de pagar protege consumidores e pequenos negócios.
