import type { Reserva } from '@/domain/tipos';
import { brl, pct, usd } from '@/lib/formato';

/* Uma reserva fora do patrimônio, com o valor na moeda e, para dólar, o equivalente em reais pela última PTAX. */
export function LinhaReserva({ r, dolar }: { r: Reserva; dolar?: number }) {
  return <>
    {' '}{r.moeda === 'USD' ? usd(r.valor) : brl(r.valor)}
    {r.moeda === 'USD' && dolar ? <span className="text-rotulo"> ≈ {brl(r.valor * dolar)}</span> : null}
    {r.meta ? <span className="text-rotulo"> · {pct(r.valor / r.meta, 0)} da meta</span> : null}
  </>;
}
