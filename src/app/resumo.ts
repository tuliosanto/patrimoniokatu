import { useMemo } from 'react';
import { CLASSES } from '@/domain/classes';
import {
  cotacaoDolar, fluxosDoMes, ordenarFechamentos, pontos, resumoDividendos, totaisPorClasse, totaisPorGrupo, vencimentosProximos,
} from '@/domain/carteira';
import { linhas, mesesPendentes } from '@/domain/historico';
import type { ClasseId, Estado } from '@/domain/tipos';
import { hojeIso } from '@/lib/formato';
import { useEstado } from '@/data/store';

/* Tudo o que as telas derivam do estado, calculado uma vez por mudança. */
export function calcularResumo(e: Estado, hoje = hojeIso()) {
  const fechamentos = ordenarFechamentos(e.fechamentos);
  const ls = linhas(pontos({ ...e, fechamentos }));
  const ultimo = fechamentos[fechamentos.length - 1];
  const anterior = fechamentos[fechamentos.length - 2];
  const porClasse = ultimo ? totaisPorClasse(ultimo, e.ativos) : (Object.fromEntries(CLASSES.map((c) => [c.id, 0])) as Record<ClasseId, number>);
  const linhaAtual = ls[ls.length - 1];
  const ano = +(ultimo?.id ?? hoje).slice(0, 4);
  const ateMes = ultimo && +ultimo.id.slice(0, 4) === ano ? +ultimo.id.slice(5, 7) : +hoje.slice(5, 7);
  return {
    fechamentos, linhas: ls, ultimo, anterior, porClasse,
    porGrupo: totaisPorGrupo(porClasse),
    primeiro: ls[0],
    total: linhaAtual?.total ?? 0,
    variacao: linhaAtual?.varMes ?? null,
    variacaoPct: linhaAtual && ls.length > 1 ? (linhaAtual.varMes ?? 0) / ls[ls.length - 2].total : null,
    aportado: linhaAtual?.aportado ?? 0,
    ano,
    dividendos: resumoDividendos(e.dividendos, ano, ateMes),
    dividendosMes: ultimo ? fluxosDoMes(e, ultimo.id, ultimo).dividendos : 0,
    aporteMes: ultimo?.aporte ?? 0,
    /** PTAX do fechamento mais recente que a tem (para converter reservas em dólar). */
    dolar: cotacaoDolar(fechamentos),
    pendentes: mesesPendentes(fechamentos, new Date(hoje + 'T12:00:00')),
    vencimentos: vencimentosProximos(e.ativos, hoje),
    lancamentosAbertos: ultimo ? e.lancamentos.filter((l) => l.data > ultimo.data).length : e.lancamentos.length,
  };
}

export function useResumo() {
  const estado = useEstado();
  return useMemo(() => ({ estado, ...calcularResumo(estado) }), [estado]);
}
