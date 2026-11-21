import { CLASSES } from './classes';
import {
  efeito, ehCotada, estimarCdb, fluxosDoMes, ordenarFechamentos, ordenarLancamentos, posicao, qtdLiquida, r2, totaisPorClasse, totalFechamento,
} from './carteira';
import type { Ativo, ClasseId, Estado, Fechamento } from './tipos';

/* Montagem do fechamento de um mês: função pura, testada, usada pela tela "Fechar mês". */

export interface EntradaFechamento {
  /** AAAA-MM */
  ref: string;
  /** Data das cotações, AAAA-MM-DD. */
  data: string;
  /** Preço por ativo cotado (buscado ou digitado). */
  precos: Record<string, number | null | undefined>;
  /** Valor do extrato por CDB. */
  extratos: Record<string, number | null | undefined>;
  /** Valor de cada classe conforme o banco (oficial quando informado). */
  banco: Partial<Record<ClasseId, number>>;
  /** Fator do CDI entre o fechamento anterior e a data (1,01 = +1%). */
  fatorCdi: number | null;
  obs?: string;
}

export function fechamentoAnterior(fechamentos: Fechamento[], ref: string, data: string) {
  return ordenarFechamentos(fechamentos).filter((f) => f.data < data && f.id !== ref).pop();
}

/** Quantidade de cada ativo cotado na data: antes da data-base, a registrada no próprio mês; depois, a dos lançamentos menos as reservas. */
export function quantidadesNaData(e: Pick<Estado, 'ativos' | 'lancamentos' | 'reservas' | 'fechamentos'>, ref: string, data: string) {
  const existente = e.fechamentos.find((f) => f.id === ref);
  const ord = ordenarLancamentos(e.lancamentos);
  const out: Record<string, number> = {};
  for (const a of e.ativos) {
    if (a.arquivado || !ehCotada(a)) continue;
    out[a.id] = a.dataBase && data < a.dataBase ? existente?.posicoes[a.id]?.q ?? 0 : qtdLiquida(posicao(a, ord, data, true).q, a.id, e.reservas);
  }
  return out;
}

export function montarFechamento(e: Estado, x: EntradaFechamento) {
  const existente = e.fechamentos.find((f) => f.id === x.ref);
  const anterior = fechamentoAnterior(e.fechamentos, x.ref, x.data);
  const ativos = e.ativos.filter((a) => !a.arquivado);
  const qtd = quantidadesNaData(e, x.ref, x.data);

  // Entradas e saídas de cada ativo desde o fechamento anterior, numa passada só.
  const fluxo = new Map<string, number>();
  for (const l of e.lancamentos) {
    if ((anterior && l.data <= anterior.data) || l.data > x.data) continue;
    for (const id of [l.ativoId, l.contraparteId]) {
      const ef = id && efeito(l, id);
      if (ef) fluxo.set(id!, (fluxo.get(id!) ?? 0) + ef.valor);
    }
  }
  const fl = (a: Ativo) => r2(fluxo.get(a.id) ?? 0);
  // Sem valor no fechamento anterior, o ativo não existia nele: parte de zero.
  const ultimoValor = (a: Ativo) => anterior?.posicoes[a.id]?.v ?? (anterior ? 0 : null);

  const posicoes: Fechamento['posicoes'] = {};
  const estimativas: Record<string, number | null> = {};
  const repetidas = new Set<ClasseId>();
  for (const a of ativos) {
    if (ehCotada(a)) {
      const q = qtd[a.id];
      const p = x.precos[a.id] ?? null;
      if (q > 0 || p != null) posicoes[a.id] = { q, ...(p != null ? { p, v: r2(q * p) } : {}) };
    } else if (a.classe === 'cdb') {
      const v0 = ultimoValor(a);
      estimativas[a.id] = v0 == null ? null : estimarCdb(a.cdb, v0, { de: anterior!.data, ate: x.data, fatorCdi: x.fatorCdi }, fl(a));
      const v = x.extratos[a.id] ?? estimativas[a.id];
      if (v != null) posicoes[a.id] = { v };
    } else if (a.agregado) {
      // Classe sem detalhe (FII, ETF/BDR importados): repete o mês anterior se o banco não for informado.
      const v0 = anterior?.posicoes[a.id]?.v;
      if (v0 != null) { posicoes[a.id] = { v: v0 }; if (x.banco[a.classe] == null) repetidas.add(a.classe); }
    } else {
      const v0 = ultimoValor(a);
      if (v0 != null) posicoes[a.id] = { v: r2(v0 + fl(a)) };
    }
  }

  const calculado = totaisPorClasse({ id: x.ref, data: x.data, cotacoes: {}, posicoes, banco: {}, aporte: 0, retirada: 0, dividendos: 0 }, e.ativos);
  const semPreco = Object.fromEntries(CLASSES.map((c) => [c.id, ativos.filter((a) => a.classe === c.id && ehCotada(a) && qtd[a.id] > 0 && posicoes[a.id]?.p == null)])) as Record<ClasseId, Ativo[]>;
  const semValor = ativos.filter((a) => (a.classe === 'cdb' || a.classe === 'caixa') && posicoes[a.id]?.v == null);
  const incompletas = CLASSES.filter((c) => (semPreco[c.id].length > 0 || semValor.some((a) => a.classe === c.id)) && x.banco[c.id] == null).map((c) => c.id);

  const cotacoes: Record<string, number> = {};
  for (const a of ativos) { const p = posicoes[a.id]?.p; if (p != null && a.ticker) cotacoes[a.ticker] = p; }
  const fechamento: Fechamento = {
    id: x.ref, data: x.data, cotacoes, posicoes, banco: x.banco,
    ...fluxosDoMes(e, x.ref, existente), obs: x.obs?.trim() || undefined,
  };
  return {
    fechamento, existente, anterior, qtd, estimativas, calculado, semPreco, semValor, incompletas, repetidas,
    porClasse: totaisPorClasse(fechamento, e.ativos),
    anteriorPorClasse: anterior ? totaisPorClasse(anterior, e.ativos) : null,
    total: totalFechamento(fechamento, e.ativos),
    totalAnterior: anterior ? totalFechamento(anterior, e.ativos) : null,
  };
}
