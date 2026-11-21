import { CLASSES, GRUPOS } from './classes';
import { ordenarFechamentos, r2, somar, totaisPorClasse, totaisPorGrupo } from './carteira';
import { twr, type Linha } from './historico';
import type { Ativo, ClasseId, Fechamento, GrupoId } from './tipos';

/* Consultas sobre o histórico: o que o explorador de Análises, o Mês a mês e o simulador de Metas perguntam. */

/** Valor de cada classe e de cada grupo em cada fechamento, por mês (AAAA-MM). */
export function composicaoPorMes(fechamentos: Fechamento[], ativos: Ativo[]) {
  const m = new Map<string, { classes: Record<ClasseId, number>; grupos: Record<GrupoId, number> }>();
  for (const f of ordenarFechamentos(fechamentos)) {
    const classes = totaisPorClasse(f, ativos);
    m.set(f.id, { classes, grupos: totaisPorGrupo(classes) });
  }
  return m;
}

/** Soma só as classes escolhidas (vazio = todas). */
export const somaClasses = (porClasse: Record<ClasseId, number>, escolhidas: ClasseId[]) =>
  somar((escolhidas.length ? escolhidas : CLASSES.map((c) => c.id)).map((c) => porClasse[c] ?? 0));

export const GRUPO_IDS = GRUPOS.map((g) => g.id);

/** Resumo de um trecho do histórico, do primeiro ao último mês do trecho. */
export function resumoPeriodo(ls: Linha[]) {
  if (!ls.length) return null;
  const ini = ls[0], fim = ls[ls.length - 1];
  const dentro = ls.slice(1); // o fluxo e o rendimento do primeiro mês aconteceram antes do trecho
  const comRend = dentro.filter((l) => l.rend != null);
  const porRend = [...comRend].sort((a, b) => a.rend! - b.rend!);
  return {
    ini, fim,
    variacao: r2(fim.total - ini.total),
    variacaoPct: ini.total ? fim.total / ini.total - 1 : null,
    fluxo: somar(dentro.map((l) => l.fluxo)),
    rendimento: somar(comRend.map((l) => l.rend!)),
    dividendos: somar(dentro.map((l) => l.mes.dividendos ?? 0)),
    rentabilidade: twr(ls),
    pior: porRend[0] ?? null,
    melhor: porRend[porRend.length - 1] ?? null,
  };
}

export type Pergunta = 'melhor' | 'pior' | 'aporte' | 'dividendo' | 'passou';

/** Responde uma pergunta rápida com o mês (AAAA-MM) que a satisfaz, ou null. */
export function responder(ls: Linha[], p: Pergunta, valor?: number): string | null {
  const max = (f: (l: Linha) => number | null) => {
    let melhor: Linha | null = null;
    for (const l of ls) { const v = f(l); if (v != null && (melhor === null || v > f(melhor)!)) melhor = l; }
    return melhor?.mes.id ?? null;
  };
  switch (p) {
    case 'melhor': return max((l) => l.rend);
    case 'pior': return max((l) => (l.rend == null ? null : -l.rend));
    case 'aporte': return max((l) => (l.fluxo > 0 ? l.fluxo : null));
    case 'dividendo': return max((l) => (l.mes.dividendos > 0 ? l.mes.dividendos : null));
    case 'passou': return valor == null ? null : ls.find((l) => l.total >= valor)?.mes.id ?? null;
  }
}

/* ---------------- Simulação de objetivos ---------------- */

/** Patrimônio mês a mês, começando em `inicio`, por `meses` meses (o índice 0 é hoje). */
export function projetar(inicio: number, taxa: number, aporte: number, meses: number): number[] {
  const out = [inicio];
  let t = inicio;
  for (let m = 1; m <= meses; m++) { t = t * (1 + taxa) + aporte; out.push(r2(t)); }
  return out;
}

/** Aporte mensal que leva `inicio` a `alvo` em `meses`, à taxa mensal `taxa` (0 se já chega sem aporte). */
export function aporteNecessario(inicio: number, alvo: number, taxa: number, meses: number): number | null {
  if (meses <= 0) return null;
  const f = Math.pow(1 + taxa, meses);
  const falta = alvo - inicio * f;
  if (falta <= 0) return 0;
  return r2(taxa === 0 ? falta / meses : (falta * taxa) / (f - 1));
}

/** "2 anos e 4 meses" */
export function duracao(meses: number) {
  const a = Math.floor(meses / 12), m = meses % 12;
  const pa = a ? `${a} ano${a > 1 ? 's' : ''}` : '', pm = m ? `${m} ${m > 1 ? 'meses' : 'mês'}` : '';
  return [pa, pm].filter(Boolean).join(' e ') || 'este mês';
}
