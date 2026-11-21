import type { Ativo } from '@/domain/tipos';
import { dataBr, num } from '@/lib/formato';

/* Como um ativo aparece nas telas, num lugar só. */

/** Curto, para listas e gráficos: o código (BBAS3, BTC) ou o nome (CDB 1, Valor em Caixa). */
export const rotuloAtivo = (a: Ativo) => a.ticker ?? a.nome;
/** Completo, para escolher num seletor: "BBAS3 · Banco do Brasil". */
export const nomeCompleto = (a: Ativo) => (a.ticker && a.ticker !== a.nome ? `${a.ticker} · ${a.nome}` : a.nome);

export function taxaCdb(a: Ativo) {
  return a.cdb?.taxa ? `${num(a.cdb.taxa)}${a.cdb.tipoTaxa === 'pre' ? '% a.a.' : '% do CDI'}` : null;
}
/** "Inter · 110% do CDI · vence 10/03/2027 · liquidez diária" */
export function descreverCdb(a: Ativo) {
  return [a.cdb?.banco, taxaCdb(a), a.cdb?.vencimento ? `vence ${dataBr(a.cdb.vencimento)}` : null, a.cdb?.liquidez === 'diaria' ? 'liquidez diária' : null]
    .filter(Boolean).join(' · ');
}

export const corretorasDe = (ativos: Ativo[]) => [...new Set(ativos.map((a) => a.corretora).filter(Boolean) as string[])].sort();

