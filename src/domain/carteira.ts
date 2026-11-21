import { CLASSES, classe, GRUPOS } from './classes';
import type { Ponto } from './historico';
import type { Ativo, CdbInfo, ClasseId, Dividendo, Estado, Fechamento, GrupoId, Lancamento, Reserva } from './tipos';

export const r2 = (v: number) => Math.round(v * 100) / 100;
const ordemLanc = (a: Lancamento, b: Lancamento) => a.data.localeCompare(b.data) || a.criadoEm - b.criadoEm;
/** Lançamentos em ordem cronológica; ordene uma vez e passe adiante. */
export const ordenarLancamentos = (ls: Lancamento[]) => [...ls].sort(ordemLanc);

/* ---------------- Posição de um ativo ---------------- */

export interface Posicao {
  /** Quantidade atual (ações, cripto, US$). */
  q: number;
  /** Preço médio de compra; null se ainda não foi informado. */
  pm: number | null;
  /** Custo total da quantidade atual (q × pm). */
  custo: number | null;
  /** Lucro já realizado em vendas. */
  realizado: number;
  /** Dinheiro que entrou menos o que saiu (CDB, caixa), desde a data-base. */
  fluxo: number;
}

/** Entradas e saídas de um ativo em um lançamento: + entra, − sai. */
export function efeito(l: Lancamento, ativoId: string): { q: number; valor: number } | null {
  const q = l.quantidade ?? 0;
  if (l.ativoId === ativoId) {
    switch (l.tipo) {
      case 'aporte': case 'compra': case 'transferencia': return { q, valor: l.valor };
      case 'venda': case 'resgate': case 'retirada': return { q: -q, valor: -l.valor };
    }
  }
  if (l.contraparteId === ativoId) {
    switch (l.tipo) {
      case 'compra': case 'transferencia': return { q: 0, valor: -l.valor };
      case 'venda': case 'resgate': return { q: 0, valor: l.valor };
      default: return null;
    }
  }
  return null;
}

/** Posição do ativo até a data `ate` (inclusive), a partir da data-base e dos lançamentos.
    `lancamentos` pode vir já ordenado (ordenarLancamentos) para evitar reordenar a cada ativo. */
export function posicao(a: Ativo, lancamentos: Lancamento[], ate = '9999-12-31', jaOrdenado = false): Posicao {
  let q = a.qBase ?? 0;
  let pm = a.pmBase ?? (q === 0 ? 0 : null);
  let custo: number | null = pm === null ? null : q * pm;
  let realizado = 0;
  let fluxo = 0;
  const base = a.dataBase ?? '0000-00-00';
  for (const l of jaOrdenado ? lancamentos : ordenarLancamentos(lancamentos)) {
    if (l.data <= base || l.data > ate) continue;
    const e = efeito(l, a.id);
    if (!e) continue;
    fluxo += e.valor;
    if (e.q > 0) {
      if (custo !== null) custo += e.valor;
      q += e.q;
      pm = custo !== null && q > 0 ? custo / q : null;
    } else if (e.q < 0) {
      const sai = -e.q;
      if (pm !== null) {
        realizado += -e.valor - pm * sai;
        if (custo !== null) custo -= pm * sai;
      }
      q -= sai;
      if (q <= 1e-12) { q = 0; custo = 0; pm = pm === null ? null : pm; }
    }
  }
  return { q: +q.toFixed(8), pm, custo: custo === null ? null : r2(custo), realizado: r2(realizado), fluxo: r2(fluxo) };
}

/** Posições de vários ativos de uma vez, ordenando os lançamentos uma só vez. */
export function posicoesAte(ativos: Ativo[], lancamentos: Lancamento[], ate = '9999-12-31'): Map<string, Posicao> {
  const ord = ordenarLancamentos(lancamentos);
  return new Map(ativos.map((a) => [a.id, posicao(a, ord, ate, true)]));
}

/** Prévia: como fica o preço médio se esta compra for lançada. */
export function previaPm(atual: Posicao, quantidade: number, valor: number): number | null {
  if (atual.custo === null || quantidade <= 0) return null;
  return (atual.custo + valor) / (atual.q + quantidade);
}

/* ---------------- Fechamento ---------------- */

export function totaisPorClasse(f: Fechamento, ativos: Ativo[]): Record<ClasseId, number> {
  const calc = Object.fromEntries(CLASSES.map((c) => [c.id, 0])) as Record<ClasseId, number>;
  const porId = new Map(ativos.map((a) => [a.id, a]));
  for (const [id, p] of Object.entries(f.posicoes)) {
    const a = porId.get(id);
    if (a && p.v != null) calc[a.classe] = r2(calc[a.classe] + p.v);
  }
  for (const c of CLASSES) {
    const b = f.banco[c.id];
    if (b != null) calc[c.id] = r2(b);
  }
  return calc;
}

export const somar = (xs: number[]) => r2(xs.reduce((s, x) => s + x, 0));

export function totalFechamento(f: Fechamento, ativos: Ativo[]): number {
  return somar(Object.values(totaisPorClasse(f, ativos)));
}

export function totaisPorGrupo(porClasse: Record<ClasseId, number>): Record<GrupoId, number> {
  const g = Object.fromEntries(GRUPOS.map((x) => [x.id, 0])) as Record<GrupoId, number>;
  for (const c of CLASSES) g[c.grupo] = r2(g[c.grupo] + (porClasse[c.id] ?? 0));
  return g;
}

export const ordenarFechamentos = (fs: Fechamento[]) => [...fs].sort((a, b) => a.data.localeCompare(b.data));

/** Pontos para os cálculos de rentabilidade. */
export function pontos(e: Pick<Estado, 'fechamentos' | 'ativos'>): Ponto[] {
  return ordenarFechamentos(e.fechamentos).map((f) => ({
    id: f.id, data: f.data, total: totalFechamento(f, e.ativos),
    aporte: f.aporte ?? 0, retirada: f.retirada ?? 0, dividendos: f.dividendos ?? 0,
  }));
}

/** Quantidade de um ativo em cada fechamento (para o gráfico e a comparação com o mês anterior). */
export function quantidades(ativoId: string, fs: Fechamento[]): { id: string; data: string; q: number }[] {
  return ordenarFechamentos(fs)
    .filter((f) => f.posicoes[ativoId]?.q != null)
    .map((f) => ({ id: f.id, data: f.data, q: f.posicoes[ativoId].q! }));
}

/* ---------------- Movimento do mês ---------------- */

const doMes = (data: string, mes: string) => data.slice(0, 7) === mes;

/* ---------------- Dividendos ---------------- */

/** Total, total do ano e média mensal do ano (dividida pelos meses de janeiro até `ateMes`, inclusive). */
export function resumoDividendos(ds: Dividendo[], ano: number, ateMes: number) {
  const doAno = ds.filter((d) => +d.data.slice(0, 4) === ano);
  const total = somar(ds.map((d) => d.valor));
  const totalAno = somar(doAno.map((d) => d.valor));
  return { total, totalAno, mediaMensalAno: ateMes > 0 ? r2(totalAno / ateMes) : 0 };
}

export function dividendosPorAtivo(ds: Dividendo[]): { ativoId: string | null; total: number }[] {
  const m = new Map<string | null, number>();
  for (const d of ds) m.set(d.ativoId ?? null, (m.get(d.ativoId ?? null) ?? 0) + d.valor);
  return [...m].map(([ativoId, total]) => ({ ativoId, total: r2(total) })).sort((a, b) => b.total - a.total);
}

/* ---------------- Metas de alocação ---------------- */

/** Divide um aporte entre as classes que estão abaixo da meta, para aproximar a carteira do alvo. */
export function sugerirAporte(atual: Record<ClasseId, number>, metas: Partial<Record<ClasseId, number>>, aporte: number) {
  const total = somar(Object.values(atual));
  const futuro = total + aporte;
  const faltas = CLASSES
    .filter((c) => (metas[c.id] ?? 0) > 0)
    .map((c) => ({ classe: c.id, falta: Math.max(0, (metas[c.id] ?? 0) * futuro - (atual[c.id] ?? 0)) }))
    .filter((x) => x.falta > 0);
  const soma = faltas.reduce((s, x) => s + x.falta, 0);
  if (!soma) return [];
  return faltas.map((x) => ({ classe: x.classe, valor: r2((x.falta / soma) * aporte) }));
}

/* ---------------- CDB ---------------- */

/** Valor estimado de um CDB desde o último valor conhecido: pelo % do CDI ou pela taxa prefixada (ano de 365 dias).
    Sem a taxa, ou sem o CDI do período, só soma o que entrou e saiu. */
export function estimarCdb(cdb: CdbInfo | undefined, valorAnterior: number, periodo: { de: string; ate: string; fatorCdi: number | null }, fluxo = 0): number {
  let fator = 1;
  if (cdb?.tipoTaxa === 'pre' && cdb.taxa) {
    const dias = (Date.parse(periodo.ate) - Date.parse(periodo.de)) / 86_400_000;
    fator = Math.pow(1 + cdb.taxa / 100, dias / 365);
  } else if (periodo.fatorCdi) {
    fator = 1 + (periodo.fatorCdi - 1) * ((cdb?.taxa ?? 100) / 100);
  }
  return r2(valorAnterior * fator + fluxo);
}

export function vencimentosProximos(ativos: Ativo[], hoje: string, dias = 60) {
  const limite = new Date(Date.parse(hoje) + dias * 86_400_000).toISOString().slice(0, 10);
  return ativos
    .filter((a) => !a.arquivado && a.classe === 'cdb' && a.cdb?.vencimento && a.cdb.vencimento >= hoje && a.cdb.vencimento <= limite)
    .sort((a, b) => a.cdb!.vencimento!.localeCompare(b.cdb!.vencimento!));
}

export const ehCotada = (a: Ativo) => classe(a.classe).cotada && !a.agregado;

/** Quanto de um ativo está separado em reservas (na moeda do ativo: US$ na conta em dólar). */
export function reservado(ativoId: string, reservas: Reserva[]): number {
  return r2(reservas.filter((x) => x.dentroDe === ativoId).reduce((s, x) => s + x.valor, 0));
}

/** Quantidade que conta no patrimônio: a posição menos o que está separado em reservas.
    Mantém 8 casas (cripto tem frações como 0,0312345). */
export const qtdLiquida = (q: number, ativoId: string, reservas: Reserva[]) => +(q - reservado(ativoId, reservas)).toFixed(8);

/** Cotação do dólar (PTAX) do fechamento mais recente que a tem. Meses importados da planilha não guardavam a taxa. */
export function cotacaoDolar(fechamentos: Fechamento[]): number | undefined {
  return ordenarFechamentos(fechamentos).reverse().find((f) => f.cotacoes.USD != null)?.cotacoes.USD;
}

/** Aporte, retirada e dividendos de um mês: os lançamentos do mês; se não houver nenhum de um tipo,
    vale o total guardado no fechamento (meses importados da planilha não têm lançamentos). */
export function fluxosDoMes(e: Pick<Estado, 'lancamentos' | 'dividendos'>, mes: string, guardado?: Pick<Fechamento, 'aporte' | 'retirada' | 'dividendos'>) {
  const ls = e.lancamentos.filter((l) => doMes(l.data, mes));
  const ds = e.dividendos.filter((d) => doMes(d.data, mes));
  const tem = (t: Lancamento['tipo']) => ls.some((l) => l.tipo === t);
  return {
    aporte: tem('aporte') ? somar(ls.filter((l) => l.tipo === 'aporte').map((l) => l.valor)) : guardado?.aporte ?? 0,
    retirada: tem('retirada') ? somar(ls.filter((l) => l.tipo === 'retirada').map((l) => l.valor)) : guardado?.retirada ?? 0,
    dividendos: ds.length ? somar(ds.map((d) => d.valor)) : guardado?.dividendos ?? 0,
  };
}
