/* Formato brasileiro: R$ 1.234,56 · 4,59% · Outubro de 2026 */

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dolares = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

/** "R$ 1.234,56" com espaço normal (o Intl usa espaço inseparável). */
export const brl = (v: number) => reais.format(v).replace(/ /g, ' ');
export const usd = (v: number) => dolares.format(v).replace(/ /g, ' ').replace('US$', 'US$');
export const comSinal = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + brl(Math.abs(v));

/* Criar um Intl.NumberFormat custa caro; guardamos um por configuração. */
const formatadores = new Map<string, Intl.NumberFormat>();
function fmt(chave: string, o: Intl.NumberFormatOptions) {
  let f = formatadores.get(chave);
  if (!f) { f = new Intl.NumberFormat('pt-BR', o); formatadores.set(chave, f); }
  return f;
}

export const num = (v: number, casasMax = 8) => fmt(`n${casasMax}`, { maximumFractionDigits: casasMax }).format(v);
export function pct(v: number, casas = 1, sinal = false) {
  const s = fmt(`p${casas}`, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(Math.abs(v) * 100) + '%';
  if (!sinal) return v < 0 ? '−' + s : s;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + s;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-10" → "Outubro de 2026" */
export function mesExtenso(ref: string, maiuscula = true) {
  const m = MESES[+ref.slice(5, 7) - 1];
  return `${maiuscula ? m[0].toUpperCase() + m.slice(1) : m} de ${ref.slice(0, 4)}`;
}
/** "2026-10" → "out/26" */
export const mesCurto = (ref: string) => `${MESES[+ref.slice(5, 7) - 1].slice(0, 3)}/${ref.slice(2, 4)}`;
/** "2026-11-01" → "01/11/2026" */
export const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const hojeIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
/** Último dia do mês AAAA-MM. */
export const fimDoMes = (ref: string) => new Date(Date.UTC(+ref.slice(0, 4), +ref.slice(5, 7), 0)).toISOString().slice(0, 10);

/** Lê "1.234,56", "1234.56" ou "1234,5" como número. Vazio → null. */
export function lerNumero(s: string): number | null {
  const t = s.trim().replace(/\s|R\$|US\$/g, '');
  if (!t) return null;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Número para preencher um campo editável: vírgula decimal e SEM ponto de milhar,
    para que lerNumero() o leia de volta exatamente (368051,5 e não 368.051,5). */
export const paraCampo = (v: number, casasMax = 8) => fmt(`c${casasMax}`, { maximumFractionDigits: casasMax, useGrouping: false }).format(v);

/* ---------------- Meses (AAAA-MM), sem fuso horário ---------------- */

/** "2026-11" + 2 → "2027-01" */
export function somarMeses(ref: string, n: number) {
  const t = +ref.slice(0, 4) * 12 + (+ref.slice(5, 7) - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
/** Meses de `de` até `ate` ("2026-01" → "2026-03" = 2). */
export const mesesEntre = (de: string, ate: string) => (+ate.slice(0, 4) - +de.slice(0, 4)) * 12 + (+ate.slice(5, 7) - +de.slice(5, 7));
/** Todos os meses de `ini` a `fim`, inclusive. */
export const mesesDe = (ini: string, fim: string) => Array.from({ length: Math.max(0, mesesEntre(ini, fim) + 1) }, (_, i) => somarMeses(ini, i));
export const mesAtual = () => hojeIso().slice(0, 7);
