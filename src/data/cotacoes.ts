/* Cotações automáticas, todas gratuitas e chamadas direto do navegador:
   - Banco Central (SGS): dólar PTAX (série 1) e CDI diário (série 12). Sem cadastro.
   - CoinGecko: preço de cripto em R$ numa data. Sem cadastro.
   - brapi.dev: ações, FIIs, ETFs e BDRs da B3. Token gratuito, guardado no
     Firestore (config/geral), nunca no código — o repositório é público.
   As funções de leitura de resposta são puras, para poderem ser testadas. */

import { dataBr, hojeIso } from '@/lib/formato';

const DIA = 86_400_000;
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const menos = (iso: string, dias: number) => isoDe(new Date(Date.parse(iso + 'T12:00:00Z') - dias * DIA));
/** "31/07/2026" → "2026-07-31" */
const deBr = (s: string) => `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}`;

export interface Cotacao {
  preco: number;
  /** Data do pregão/fixing efetivamente usado (pode ser anterior, se a data caiu num fim de semana). */
  data: string;
  fonte: string;
}

/* ---------------- Leitura das respostas (puras) ---------------- */

type SerieBCB = { data: string; valor: string }[];

/** Último valor da série com data ≤ `ate`. */
export function ultimoAte(serie: SerieBCB, ate: string): { valor: number; data: string } | null {
  let melhor: { valor: number; data: string } | null = null;
  for (const p of serie) {
    const d = deBr(p.data);
    if (d <= ate && (!melhor || d >= melhor.data)) melhor = { valor: parseFloat(p.valor), data: d };
  }
  return melhor;
}

/** Fator acumulado do CDI diário (em % ao dia) para os dias em (de, ate]. */
export function fatorCdi(serie: SerieBCB, de: string, ate: string): number {
  return serie.reduce((f, p) => {
    const d = deBr(p.data);
    return d > de && d <= ate ? f * (1 + parseFloat(p.valor) / 100) : f;
  }, 1);
}

interface RespBrapi {
  results?: { symbol: string; regularMarketPrice?: number; regularMarketTime?: string; historicalDataPrice?: { date: number; close: number | null }[] }[];
  error?: boolean;
  message?: string;
}
/** Fechamento do último pregão até `ate` (ou o preço atual, se `ate` é hoje ou depois). */
export function precoBrapi(r: RespBrapi, ate: string, hoje = hojeIso()): Cotacao | null {
  const x = r.results?.[0];
  if (!x) return null;
  let melhor: Cotacao | null = null;
  for (const h of x.historicalDataPrice ?? []) {
    if (h.close == null) continue;
    const d = isoDe(new Date(h.date * 1000));
    if (d <= ate && (!melhor || d >= melhor.data)) melhor = { preco: h.close, data: d, fonte: 'B3 (brapi)' };
  }
  if (ate >= hoje && x.regularMarketPrice) return { preco: x.regularMarketPrice, data: hoje, fonte: 'B3 (brapi)' };
  return melhor;
}

/** Códigos comuns → id no CoinGecko. Outros: use o próprio id do CoinGecko como código. */
export const CRIPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', XRP: 'ripple', SOL: 'solana', ADA: 'cardano',
  DOGE: 'dogecoin', DOT: 'polkadot', BNB: 'binancecoin', USDT: 'tether', USDC: 'usd-coin', MATIC: 'matic-network', LINK: 'chainlink',
};
export const idCripto = (codigo: string) => CRIPTO_IDS[codigo.trim().toUpperCase()] ?? codigo.trim().toLowerCase();

/* ---------------- Busca ---------------- */

const cache = new Map<string, Promise<unknown>>();
async function json<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(async (r) => {
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error((corpo as { message?: string }).message ?? `HTTP ${r.status}`), { status: r.status });
      return corpo;
    }).catch((e) => { cache.delete(url); throw e; }));
  }
  return cache.get(url) as Promise<T>;
}

const sgs = (serie: number, de: string, ate: string) =>
  json<SerieBCB>(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${dataBr(de)}&dataFinal=${dataBr(ate)}`);

/** Dólar PTAX de venda na data (ou no último dia útil antes dela). */
export async function ptax(data: string): Promise<Cotacao | null> {
  const u = ultimoAte(await sgs(1, menos(data, 10), data), data);
  return u && { preco: u.valor, data: u.data, fonte: 'PTAX (Banco Central)' };
}

/** Quanto R$ 1 aplicado a 100% do CDI virou entre as duas datas. */
export async function cdi(de: string, ate: string): Promise<number> {
  if (ate <= de) return 1;
  return fatorCdi(await sgs(12, de, ate), de, ate);
}

/** Várias criptos de uma vez: uma consulta só para hoje; em datas passadas, uma por vez (limite do CoinGecko). */
export async function criptos(codigos: string[], data: string): Promise<Record<string, Cotacao | null>> {
  const out: Record<string, Cotacao | null> = {};
  if (data >= hojeIso()) {
    const ids = [...new Set(codigos.map(idCripto))].join(',');
    const r = await json<Record<string, { brl?: number }>>(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=brl`);
    for (const c of codigos) { const p = r[idCripto(c)]?.brl; out[c] = p ? { preco: p, data: hojeIso(), fonte: 'CoinGecko' } : null; }
    return out;
  }
  for (const c of codigos) out[c] = await cripto(c, data);
  return out;
}


export async function cripto(codigo: string, data: string): Promise<Cotacao | null> {
  if (data >= hojeIso()) return (await criptos([codigo], data))[codigo];
  const id = encodeURIComponent(idCripto(codigo));
  const r = await json<{ market_data?: { current_price?: { brl?: number } } }>(
    `https://api.coingecko.com/api/v3/coins/${id}/history?date=${data.slice(8, 10)}-${data.slice(5, 7)}-${data.slice(0, 4)}&localization=false`);
  const p = r.market_data?.current_price?.brl;
  return p ? { preco: p, data, fonte: 'CoinGecko' } : null;
}

/* O plano gratuito do brapi aceita uma consulta por vez: as buscas entram numa fila
   e, se o limite for atingido mesmo assim, esperam e tentam de novo (até 4 vezes). */
let filaB3: Promise<unknown> = Promise.resolve();
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function comRetentativa<T>(f: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await f(); } catch (e) {
      if ((e as { status?: number }).status !== 429 || i >= 3) throw e;
      await espera(1500 * 2 ** i);
    }
  }
}

export function b3(ticker: string, data: string, token: string): Promise<Cotacao | null> {
  const t = encodeURIComponent(ticker.trim().toUpperCase());
  const url = `https://brapi.dev/api/quote/${t}?range=3mo&interval=1d&token=${encodeURIComponent(token)}`;
  const vez = filaB3.then(() => comRetentativa(() => json<RespBrapi>(url)));
  filaB3 = vez.catch(() => undefined);
  return vez.then((r) => precoBrapi(r, data));
}

/** Mensagem legível para um erro de busca. */
export function motivo(e: unknown): string {
  const s = (e as { status?: number }).status;
  if (s === 401 || s === 403) return 'token do brapi inválido ou sem permissão';
  if (s === 404) return 'código não encontrado';
  if (s === 429) return 'limite de consultas atingido; tente mais tarde';
  if (e instanceof TypeError) return 'sem conexão';
  return (e as Error)?.message || 'erro desconhecido';
}

export interface PontoSerie { data: string; valor: number }
/** Último valor da série (datas ISO) com data ≤ `ate`. */
export function valorAte(serie: PontoSerie[], ate: string): number | null {
  let melhor: PontoSerie | null = null;
  for (const p of serie) if (p.data <= ate && (!melhor || p.data >= melhor.data)) melhor = p;
  return melhor?.valor ?? null;
}

/** Série mensal de fechamento (ex.: ^BVSP) para comparar rentabilidade. */
export async function serieMensal(ticker: string, token: string): Promise<PontoSerie[]> {
  const t = encodeURIComponent(ticker);
  const r = await json<RespBrapi>(`https://brapi.dev/api/quote/${t}?range=5y&interval=1mo&token=${encodeURIComponent(token)}`);
  return (r.results?.[0]?.historicalDataPrice ?? [])
    .filter((h) => h.close != null)
    .map((h) => ({ data: isoDe(new Date(h.date * 1000)), valor: h.close! }));
}

/** Série diária do CDI entre as datas (para comparar a carteira com o CDI). */
export async function serieCdi(de: string, ate: string) {
  return sgs(12, de, ate);
}
