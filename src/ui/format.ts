const nf = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0), NF2 = nf(2);

export const num = (v: number | null | undefined, d = 2) => (v == null || !isFinite(v) ? '—' : (d === 0 ? NF0 : d === 2 ? NF2 : nf(d)).format(v));
export const brl = (v: number | null | undefined, d = 0) => (v == null || !isFinite(v) ? '—' : `R$ ${num(v, d)}`);
/** Com sinal: +R$ 1.200 / −R$ 300. */
export const brlS = (v: number | null | undefined, d = 0) => (v == null || !isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}R$ ${num(Math.abs(v), d)}`);
export const pct = (v: number | null | undefined, d = 1) => (v == null || !isFinite(v) ? '—' : `${num(v * 100, d)}%`);
export const pctS = (v: number | null | undefined, d = 1) => (v == null || !isFinite(v) ? '—' : `${v >= 0 ? '+' : '−'}${num(Math.abs(v) * 100, d)}%`);
export const sinal = (v: number | null | undefined) => (v == null ? '' : v >= 0 ? 'pos' : 'neg');
/** "1.234 mil" para eixos. */
export const mil = (v: number) => `${num(v / 1000, 0)} mil`;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = MESES.map((m) => m.slice(0, 3));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "2026-06" ou "2026-06-15" → "Junho de 2026". */
export const mesLongo = (d: string) => `${cap(MESES[+d.slice(5, 7) - 1])} de ${d.slice(0, 4)}`;
/** → "jun/26". */
export const mesCurto = (d: string) => `${MES3[+d.slice(5, 7) - 1]}/${d.slice(2, 4)}`;
/** → "jun". */
export const mesSigla = (d: string) => MES3[+d.slice(5, 7) - 1];
export const nomeMes = (d: string) => MESES[+d.slice(5, 7) - 1];
export const dataBr = (d: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));

/** Lê número digitado em pt-BR: "1.234,56", "1234,5", "1234.56". */
export function lerNum(s: string | null | undefined): number {
  if (s == null) return 0;
  let t = String(s).trim().replace(/[R$\s ]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  // sem vírgula, "2.529" e "1.234.567" são milhares (pt-BR); "12.5" é decimal
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}
/** Número para preencher um campo (sem "R$"). */
export const paraCampo = (v: number | null | undefined, d = 2) => (v == null || v === 0 ? '' : num(v, d));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
