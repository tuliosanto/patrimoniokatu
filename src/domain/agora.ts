import { efeito, ehCotada, r2, totalFechamento } from './carteira';
import type { Estado, Fechamento } from './tipos';

/** Preço do ativo no fechamento: o registrado, ou valor ÷ quantidade (históricos importados guardam só o valor). */
export function precoNoFechamento(f: Fechamento, id: string) {
  const x = f.posicoes[id];
  return x?.p ?? (x?.v != null && x.q ? x.v / x.q : undefined);
}

/**
 * Patrimônio de agora, estimado a partir do último fechamento (já conferido com o banco):
 * cada ativo cotado muda pela nova cotação e pela quantidade comprada ou vendida desde então;
 * os demais somam os lançamentos desde o fechamento. Sem cotação nova, vale a do fechamento.
 */
export function estimarAgora(e: Pick<Estado, 'ativos' | 'lancamentos'>, ultimo: Fechamento, precos: Record<string, number | undefined>) {
  const depois = e.lancamentos.filter((l) => l.data > ultimo.data);
  const qtd: Record<string, number> = {};
  let total = totalFechamento(ultimo, e.ativos);
  for (const a of e.ativos) {
    let dq = 0, dv = 0;
    for (const l of depois) { const ef = efeito(l, a.id); if (ef) { dq += ef.q; dv += ef.valor; } }
    if (ehCotada(a)) {
      const q0 = ultimo.posicoes[a.id]?.q ?? 0;
      const p0 = precoNoFechamento(ultimo, a.id);
      const p = precos[a.id] ?? p0;
      qtd[a.id] = q0 + dq;
      if (p != null) total += (q0 + dq) * p - (ultimo.posicoes[a.id]?.v ?? q0 * (p0 ?? 0));
      else total += dv;
    } else total += dv;
  }
  return { total: r2(total), qtd };
}
