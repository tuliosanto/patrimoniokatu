import type { Ativo, Classe, ClasseId, Estado, GrupoId, Mes } from './types';

export const CLASSES: Classe[] = [
  { id: 'cdb', nome: 'CDB', grupo: 'rf', cotada: false },
  { id: 'caixa', nome: 'Caixa', grupo: 'rf', cotada: false },
  { id: 'acoes', nome: 'Ações', grupo: 'rv', cotada: true },
  { id: 'fii', nome: 'FII', grupo: 'rv', cotada: true },
  { id: 'etf_bdr', nome: 'ETF/BDR', grupo: 'rv', cotada: true },
  { id: 'dolar', nome: 'Dólar', grupo: 'ext', cotada: false },
  { id: 'cripto', nome: 'Cripto', grupo: 'cri', cotada: true },
];
export const GRUPOS: { id: GrupoId; nome: string }[] = [
  { id: 'rf', nome: 'Renda fixa' },
  { id: 'rv', nome: 'Renda variável' },
  { id: 'ext', nome: 'Exterior' },
  { id: 'cri', nome: 'Cripto' },
];
export const classe = (id: ClasseId) => CLASSES.find((c) => c.id === id)!;

/** Dias médios de um mês, para converter taxas entre períodos. */
const DIAS_MES = 365.25 / 12;
/** Intervalo entre fechamentos acima do qual há "meses sem registro"
    (15/jun → 31/jul são 46 dias e não pulam mês nenhum). */
export const LACUNA_DIAS = 50;

const r2 = (v: number) => Math.round(v * 100) / 100;
const dias = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export const totalMes = (m: Mes) => r2(Object.values(m.posicoes).reduce((s, p) => s + (+p.v || 0), 0));

export function totalPorClasse(m: Mes, ativos: Ativo[]): Record<ClasseId, number> {
  const out = Object.fromEntries(CLASSES.map((c) => [c.id, 0])) as Record<ClasseId, number>;
  const porId = new Map(ativos.map((a) => [a.id, a]));
  for (const [id, p] of Object.entries(m.posicoes)) {
    const a = porId.get(id);
    if (a) out[a.classe] = r2(out[a.classe] + (+p.v || 0));
  }
  return out;
}

export interface Linha {
  mes: Mes;
  total: number;
  /** Aporte − retirada. */
  fluxo: number;
  /** Variação do total contra o fechamento anterior. */
  varMes: number | null;
  /** Quanto a carteira rendeu sozinha: variação − fluxo. */
  rend: number | null;
  /** Retorno do período (Modified Dietz): rend ÷ (total anterior + fluxo/2). */
  retorno: number | null;
  /** Dias desde o fechamento anterior. */
  dias: number | null;
  /** Total aportado até aqui: o primeiro patrimônio + todos os fluxos seguintes. */
  aportado: number;
}

export function linhas(meses: Mes[]): Linha[] {
  const ord = [...meses].sort((a, b) => a.data.localeCompare(b.data));
  let aportado = 0;
  return ord.map((mes, i) => {
    const total = totalMes(mes);
    const fluxo = r2((+mes.aporte || 0) - (+mes.retirada || 0));
    if (i === 0) {
      aportado = total;
      return { mes, total, fluxo, varMes: null, rend: null, retorno: null, dias: null, aportado };
    }
    const ant = ord[i - 1];
    const totAnt = totalMes(ant);
    const varMes = r2(total - totAnt);
    const rend = r2(varMes - fluxo);
    const base = totAnt + fluxo / 2;
    aportado = r2(aportado + fluxo);
    return {
      mes, total, fluxo, varMes, rend,
      retorno: base > 0 ? rend / base : null,
      dias: dias(ant.data, mes.data),
      aportado,
    };
  });
}

/** Retorno encadeado no tempo (TWR) de um trecho de linhas, e o equivalente mensal. */
export function twr(ls: Linha[]): { total: number; mensal: number; dias: number } | null {
  const v = ls.filter((l) => l.retorno !== null && l.dias);
  if (!v.length) return null;
  const total = v.reduce((acc, l) => acc * (1 + l.retorno!), 1) - 1;
  const d = v.reduce((s, l) => s + l.dias!, 0);
  return { total, dias: d, mensal: Math.pow(1 + total, DIAS_MES / d) - 1 };
}

export interface Ano {
  ano: number;
  fim: number;
  /** Data do último fechamento do ano. */
  ate: string;
  ganho: number | null;
  perc: number | null;
  aportes: number;
  retiradas: number;
  rendimento: number;
  dividendos: number;
  emAndamento: boolean;
}

export function anual(ls: Linha[], hoje = new Date()): Ano[] {
  const anos = new Map<number, Linha[]>();
  for (const l of ls) {
    const y = +l.mes.data.slice(0, 4);
    if (!anos.has(y)) anos.set(y, []);
    anos.get(y)!.push(l);
  }
  let fimAnt: number | null = null;
  return [...anos.keys()].sort().map((ano) => {
    const xs = anos.get(ano)!;
    const fim = xs[xs.length - 1].total;
    const ganho = fimAnt === null ? null : r2(fim - fimAnt);
    const perc = fimAnt ? (fim - fimAnt) / fimAnt : null;
    fimAnt = fim;
    return {
      ano, fim, ganho, perc,
      ate: xs[xs.length - 1].mes.data,
      aportes: r2(xs.reduce((s, l) => s + (+l.mes.aporte || 0), 0)),
      retiradas: r2(xs.reduce((s, l) => s + (+l.mes.retirada || 0), 0)),
      rendimento: r2(xs.reduce((s, l) => s + (l.rend ?? 0), 0)),
      dividendos: r2(xs.reduce((s, l) => s + (+l.mes.dividendos || 0), 0)),
      emAndamento: ano === hoje.getFullYear(),
    };
  });
}

/** Linhas cujo fechamento cai nos últimos `meses` meses do histórico (0 = tudo). */
export function janela(ls: Linha[], meses: number): Linha[] {
  if (!meses || !ls.length) return ls;
  const fim = new Date(ls[ls.length - 1].mes.data + 'T12:00:00');
  const ini = new Date(fim);
  ini.setMonth(ini.getMonth() - meses);
  const corte = ini.toISOString().slice(0, 10);
  return ls.filter((l) => l.mes.data > corte);
}

export interface BaseProjecao {
  aporteMensal: number;
  taxaMensal: number;
  total: number;
  data: string;
  dias: number;
}

/** Ritmo médio do período: fluxo por mês de calendário e retorno mensal equivalente. */
export function baseProjecao(ls: Linha[], meses: number): BaseProjecao | null {
  const j = janela(ls, meses);
  const t = twr(j);
  if (!t || t.dias < 2 * DIAS_MES) return null;
  const fluxo = j.filter((l) => l.dias).reduce((s, l) => s + l.fluxo, 0);
  const ult = ls[ls.length - 1];
  return { aporteMensal: fluxo / (t.dias / DIAS_MES), taxaMensal: t.mensal, total: ult.total, data: ult.mes.data, dias: t.dias };
}

/** Meses até o patrimônio atingir `alvo`, simulando mês a mês; null se nunca (em 100 anos). */
export function mesesAte(inicio: number, alvo: number, taxa: number, aporte: number): number | null {
  if (inicio >= alvo) return 0;
  let t = inicio;
  for (let m = 1; m <= 1200; m++) {
    t = t * (1 + taxa) + aporte;
    if (t >= alvo) return m;
  }
  return null;
}

/** Fechamentos que faltam entre o último registrado e o mês anterior ao atual. */
export function mesesPendentes(meses: Mes[], hoje = new Date()): string[] {
  if (!meses.length) return [];
  const ult = [...meses].map((m) => m.id).sort().pop()!;
  const out: string[] = [];
  const d = new Date(+ult.slice(0, 4), +ult.slice(5, 7), 1); // mês seguinte ao último
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), 1); // o mês corrente ainda não fechou
  while (d < limite) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export function ultimoMes(e: Estado): Mes | undefined {
  return [...e.meses].sort((a, b) => a.data.localeCompare(b.data)).pop();
}
