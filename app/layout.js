import './globals.css';

const TITLE = 'ConfirmaCNPJ — Confirme se a empresa existe | Verify Brazilian companies';
const DESC = 'Cole o link do site ou o CNPJ e confirme na Receita Federal se a empresa existe, está ativa e é o site oficial. Paste a website or CNPJ to verify a Brazilian company.';

export const metadata = {
  title: TITLE,
  description: DESC,
  applicationName: 'ConfirmaCNPJ',
  openGraph: { title: 'ConfirmaCNPJ — Essa empresa existe de verdade?', description: DESC, type: 'website', locale: 'pt_BR' },
};
export const viewport = { width: 'device-width', initialScale: 1 };

// Define o tema antes da primeira pintura para não piscar.
const themeScript = `try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function Layout({ children }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
