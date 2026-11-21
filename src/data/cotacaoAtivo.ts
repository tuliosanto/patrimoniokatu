import type { Ativo } from '@/domain/tipos';
import { b3, cripto, motivo, ptax, type Cotacao } from './cotacoes';

/** Cotação do ativo na data: B3 pelo brapi, cripto pelo CoinGecko, dólar pela PTAX. */
export async function cotacaoDoAtivo(a: Ativo, data: string, token?: string): Promise<Cotacao> {
  let c: Cotacao | null = null;
  if (a.classe === 'dolar') c = await ptax(data);
  else if (a.classe === 'cripto') c = await cripto(a.ticker ?? a.nome, data);
  else if (a.classe === 'acoes' || a.classe === 'fii' || a.classe === 'etf_bdr') {
    if (!token) throw new Error('falta o token do brapi (em Ajustes)');
    c = await b3(a.ticker ?? a.nome, data, token);
  } else throw new Error('este ativo não tem cotação de mercado');
  if (!c) throw new Error('cotação não encontrada para a data');
  return c;
}
export { motivo };
