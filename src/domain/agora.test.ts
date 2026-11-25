import { describe, expect, it } from 'vitest';
import { estimarAgora } from './agora';
import type { Ativo, Fechamento, Lancamento } from './tipos';

const ativos = [
  { id: 'a', classe: 'acoes', nome: 'PETR4', ticker: 'PETR4' },
  { id: 'c', classe: 'caixa', nome: 'Caixa' },
] as Ativo[];
const ultimo = { id: '2026-10', data: '2026-10-31', cotacoes: {}, banco: {}, aporte: 0, retirada: 0, dividendos: 0,
  posicoes: { a: { q: 10, v: 300 }, c: { v: 1000 } } } as Fechamento;

describe('estimarAgora', () => {
  it('sem cotação nova nem lançamentos, repete o fechamento', () => {
    expect(estimarAgora({ ativos, lancamentos: [] }, ultimo, {}).total).toBe(1300);
  });
  it('aplica a cotação nova e as compras desde o fechamento', () => {
    const l = [{ id: '1', data: '2026-11-05', tipo: 'compra', ativoId: 'a', contraparteId: 'c', quantidade: 2, valor: 64 }] as Lancamento[];
    const r = estimarAgora({ ativos, lancamentos: l }, ultimo, { a: 35 });
    expect(r.qtd.a).toBe(12);
    expect(r.total).toBe(12 * 35 + 1000 - 64);
  });
});
