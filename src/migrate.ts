import { CLASSES } from './calc';
import type { Ativo, ClasseId, Estado, Mes, Posicao } from './types';

/* Converte o formato antigo (um documento único com totais por classe) para o
   modelo por ativo. Regra de ouro: o total de cada classe em cada mês é
   preservado ao centavo. O que não estava detalhado vai para um ativo
   "legado" da classe, que aparece no fechamento como "Não detalhado". */

export interface LegadoMes {
  date: string;
  acoes?: number; cdb?: number; fii?: number; caixa?: number; dolar?: number; cripto?: number; etf_bdr?: number;
  aporte?: number | string;
  dividendos?: number | string;
  obs?: string;
  precos?: Record<string, number | null>;
  det?: Record<string, Record<string, { v?: number; q?: number; p?: number } | number>>;
}
export interface LegadoEstado {
  months: LegadoMes[];
  holdings?: { t: string; q: number }[];
  subativos?: Partial<Record<ClasseId, { id: string; nome: string; q?: number }[]>>;
}
/** Linha do histórico original das planilhas (traz as quantidades por mês). */
export interface LegadoSeed {
  date: string;
  stocks?: { t: string; q: number }[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : +String(v ?? '').replace(',', '.') || 0);
export const idLegado = (c: ClasseId) => `legado-${c}`;
export const ID_DOLAR = 'dolar';

export function ehLegado(x: unknown): x is LegadoEstado {
  return !!x && typeof x === 'object' && Array.isArray((x as LegadoEstado).months);
}

export function migrar(antigo: LegadoEstado, seed: LegadoSeed[] = [], agora = Date.now()): Estado {
  const ativos: Ativo[] = [];
  const subs = antigo.subativos ?? {};

  // Cadastro: sub-ativos viram ativos (mesmo id, para casar com m.det)
  for (const c of CLASSES) {
    for (const s of subs[c.id] ?? []) {
      if (c.id === 'dolar') continue;
      ativos.push({
        id: s.id, nome: s.nome || 'Sem nome', classe: c.id, criadoEm: agora,
        ...(c.cotada ? { ticker: c.id === 'acoes' ? s.nome : undefined, q: num(s.q) } : {}),
      });
    }
  }
  // Carteira de ações antiga, se nunca virou sub-ativo
  if (!(subs.acoes ?? []).length) {
    for (const h of antigo.holdings ?? []) {
      ativos.push({ id: `acao-${h.t}`, nome: h.t, ticker: h.t, classe: 'acoes', q: num(h.q), criadoEm: agora });
    }
  }
  ativos.push({ id: ID_DOLAR, nome: 'Dólar', classe: 'dolar', criadoEm: agora });

  const usados = new Set<ClasseId>();
  const qtdPorData = new Map(seed.filter((s) => s.stocks?.length).map((s) => [s.date, s.stocks!]));

  const meses: Mes[] = antigo.months.map((m) => {
    const posicoes: Record<string, Posicao> = {};
    for (const c of CLASSES) {
      const tot = r2(num(m[c.id]));
      if (c.id === 'dolar') {
        if (tot) posicoes[ID_DOLAR] = { v: tot };
        continue;
      }
      const det = m.det?.[c.id] ?? {};
      let detalhado = 0;
      for (const [sid, it] of Object.entries(det)) {
        if (sid === '_outros' || typeof it !== 'object' || !ativos.some((a) => a.id === sid)) continue;
        const v = r2(num(it.v));
        if (!v && !it.q) continue;
        posicoes[sid] = { v, ...(it.q != null ? { q: num(it.q) } : {}), ...(it.p != null ? { p: num(it.p) } : {}) };
        detalhado = r2(detalhado + v);
      }
      // o que sobra (inclui o antigo _outros) fica no ativo legado: o total da classe não muda
      const resto = r2(tot - detalhado);
      if (resto) {
        posicoes[idLegado(c.id)] = { v: resto };
        usados.add(c.id);
      }
    }
    const cotacoes: Record<string, number> = {};
    for (const [k, v] of Object.entries(m.precos ?? {})) if (v != null && num(v)) cotacoes[k] = num(v);
    const qs = qtdPorData.get(m.date);
    return {
      id: m.date.slice(0, 7),
      data: m.date,
      posicoes,
      aporte: r2(num(m.aporte)),
      retirada: 0,
      dividendos: r2(num(m.dividendos)),
      obs: m.obs ?? '',
      cotacoes,
      ...(qs ? { quantidades: Object.fromEntries(qs.map((s) => [s.t, num(s.q)])) } : {}),
    };
  });

  for (const c of CLASSES) {
    if (usados.has(c.id)) {
      ativos.push({ id: idLegado(c.id), nome: `${c.nome} — não detalhado`, classe: c.id, legado: true, criadoEm: agora });
    }
  }

  return { ativos, meses, config: { metas: {}, versao: 2, migradoEm: agora } };
}

/** Acrescenta quantidades por mês vindas do histórico original, casando pela data. */
export function aplicarSeed(e: Estado, seed: LegadoSeed[]): { estado: Estado; casados: number } {
  const porData = new Map(seed.filter((s) => s.stocks?.length).map((s) => [s.date, s.stocks!]));
  let casados = 0;
  const meses = e.meses.map((m) => {
    const qs = porData.get(m.data);
    if (!qs) return m;
    casados++;
    return { ...m, quantidades: Object.fromEntries(qs.map((s) => [s.t, num(s.q)])) };
  });
  return { estado: { ...e, meses }, casados };
}

export function ehSeed(x: unknown): x is LegadoSeed[] {
  return Array.isArray(x) && x.length > 0 && typeof x[0]?.date === 'string' && 'acoes' in x[0];
}
