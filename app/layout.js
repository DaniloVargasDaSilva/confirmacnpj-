import '@fontsource-variable/archivo/wdth.css';
import './globals.css';

const TITLE = 'ConfirmaCNPJ — Confirme se a empresa existe | Verify Brazilian companies';
const DESC = 'Cole o link do site ou o CNPJ e confirme na Receita Federal se a empresa existe, está ativa e é dona do site. Paste a website or CNPJ to verify a Brazilian company.';

export const metadata = {
  title: TITLE,
  description: DESC,
  applicationName: 'ConfirmaCNPJ',
  openGraph: { title: 'ConfirmaCNPJ — Antes de pagar, confira se a empresa existe', description: DESC, type: 'website', locale: 'pt_BR' },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#EEF1EC' }, { media: '(prefers-color-scheme: dark)', color: '#0E1626' }],
};

// Define o tema antes da primeira pintura para não piscar.
const themeScript = `try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default function Layout({ children }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
