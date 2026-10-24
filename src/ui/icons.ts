import { svg } from 'lit-html';

/* Ícones em traço (estilo Lucide), sempre decorativos: quem nomeia o botão é o texto ou o aria-label. */
const i = (body: ReturnType<typeof svg>, s = 18) =>
  svg`<svg aria-hidden="true" width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ic = {
  logo: () => i(svg`<path d="M3 17l5-5 4 3 8-9"/><path d="M15 6h5v5"/>`),
  inicio: () => i(svg`<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`),
  fechar: () => i(svg`<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4"/>`),
  carteira: () => i(svg`<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>`),
  relatorios: () => i(svg`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`),
  metas: () => i(svg`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>`),
  ajustes: () => i(svg`<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>`),
  mais: (s = 16) => i(svg`<path d="M12 5v14M5 12h14"/>`, s),
  relogio: () => i(svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
  alerta: () => i(svg`<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/>`),
  editar: () => i(svg`<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>`, 16),
  lixo: () => i(svg`<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>`, 16),
  nota: () => i(svg`<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6M9 17h4"/>`, 16),
  arquivar: () => i(svg`<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>`, 16),
};
