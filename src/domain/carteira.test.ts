import { describe, expect, it } from 'vitest';
import { estimarCdb, qtdLiquida, reservado, resumoDividendos, posicao, previaPm, sugerirAporte, totaisPorClasse, totaisPorGrupo, totalFechamento } from './carteira';
import type { Ativo, Fechamento, Lancamento } from './tipos';

const acao: Ativo = { id: 'bbas', classe: 'acoes', nome: 'BBAS3', ticker: 'BBAS3', qBase: 100, pmBase: 20, dataBase: '2026-10-31', criadoEm: 0 };
let n = 0;
const lanc = (p: Partial<Lancamento>): Lancamento => ({ id: `l${n++}`, data: '2026-11-10', tipo: 'compra', valor: 0, criadoEm: n, ...p });

describe('posição e preço médio', () => {
  it('compra recalcula o preço médio ponderado', () => {
    const p = posicao(acao, [lanc({ ativoId: 'bbas', quantidade: 100, preco: 30, valor: 3000 })]);
    expect(p.q).toBe(200);
    expect(p.pm).toBe(25);
    expect(p.custo).toBe(5000);
  });

  it('venda mantém o preço médio e apura o lucro', () => {
    const p = posicao(acao, [lanc({ tipo: 'venda', ativoId: 'bbas', quantidade: 40, preco: 26, valor: 1040 })]);
    expect(p.q).toBe(60);
    expect(p.pm).toBe(20);
    expect(p.realizado).toBe(240);
  });

  it('ignora lançamentos anteriores à data-base e depois do corte', () => {
    const ls = [lanc({ data: '2026-10-01', ativoId: 'bbas', quantidade: 10, valor: 200 }), lanc({ data: '2026-12-05', ativoId: 'bbas', quantidade: 10, valor: 200 })];
    expect(posicao(acao, ls, '2026-11-30').q).toBe(100);
  });

  it('sem preço médio informado, não inventa custo', () => {
    const p = posicao({ ...acao, pmBase: undefined }, [lanc({ ativoId: 'bbas', quantidade: 10, valor: 300 })]);
    expect(p.q).toBe(110);
    expect(p.pm).toBeNull();
  });

  it('compra saindo do caixa reduz o caixa', () => {
    const caixa: Ativo = { id: 'caixa', classe: 'caixa', nome: 'Caixa', criadoEm: 0 };
    const p = posicao(caixa, [lanc({ ativoId: 'bbas', contraparteId: 'caixa', quantidade: 10, valor: 300 }), lanc({ tipo: 'aporte', ativoId: 'caixa', valor: 1000 })]);
    expect(p.fluxo).toBe(700);
  });

  it('prévia do preço médio', () => {
    expect(previaPm({ q: 100, pm: 20, custo: 2000, realizado: 0, fluxo: 0 }, 100, 3000)).toBe(25);
    expect(previaPm({ q: 100, pm: null, custo: null, realizado: 0, fluxo: 0 }, 100, 3000)).toBeNull();
  });
});

describe('totais do fechamento', () => {
  const ativos: Ativo[] = [acao, { id: 'btc', classe: 'cripto', nome: 'Bitcoin', criadoEm: 0 }, { id: 'cx', classe: 'caixa', nome: 'Caixa', criadoEm: 0 }];
  const f: Fechamento = {
    id: '2026-11', data: '2026-11-30', cotacoes: {}, aporte: 0, retirada: 0, dividendos: 0,
    posicoes: { bbas: { q: 100, p: 25, v: 2500 }, btc: { q: 0.01, p: 400000, v: 4000 }, cx: { v: 1000 } },
    banco: { acoes: 2490.5 },
  };
  it('valor do banco prevalece sobre o calculado', () => {
    const t = totaisPorClasse(f, ativos);
    expect(t.acoes).toBe(2490.5);
    expect(t.cripto).toBe(4000);
    expect(totalFechamento(f, ativos)).toBe(7490.5);
  });
  it('agrupa em renda fixa, variável, criptos e exterior', () => {
    const g = totaisPorGrupo(totaisPorClasse(f, ativos));
    expect(g).toEqual({ rf: 1000, rv: 2490.5, cri: 4000, ext: 0 });
  });
});

describe('metas', () => {
  it('distribui o aporte entre as classes abaixo da meta', () => {
    const atual = { acoes: 300, cdb: 700, fii: 0, caixa: 0, dolar: 0, cripto: 0, etf_bdr: 0 };
    const s = sugerirAporte(atual, { acoes: 0.5, cdb: 0.5 }, 400);
    expect(s).toEqual([{ classe: 'acoes', valor: 400 }]);
  });
});

describe('CDB', () => {
  it('estima pelo % do CDI ou pela taxa prefixada', () => {
    const per = { de: '2026-01-01', ate: '2027-01-01', fatorCdi: 1.01 };
    expect(estimarCdb({ tipoTaxa: 'cdi', taxa: 110 }, 1000, per)).toBe(1011);
    expect(estimarCdb(undefined, 1000, per, 500)).toBe(1510);
    expect(estimarCdb({ tipoTaxa: 'pre', taxa: 12 }, 1000, per)).toBe(1120);
    expect(estimarCdb({ tipoTaxa: 'cdi', taxa: 110 }, 1000, { ...per, fatorCdi: null }, 50)).toBe(1050);
  });
});

describe('dividendos', () => {
  it('média do ano divide pelos meses decorridos, não só pelos que pagaram', () => {
    const ds = [{ id: 'a', data: '2026-02-10', valor: 300, criadoEm: 0 }, { id: 'b', data: '2026-05-10', valor: 300, criadoEm: 0 }, { id: 'c', data: '2025-12-10', valor: 99, criadoEm: 0 }];
    expect(resumoDividendos(ds, 2026, 10)).toEqual({ total: 699, totalAno: 600, mediaMensalAno: 60 });
  });
});

describe('reservas', () => {
  it('soma o que está guardado dentro de um ativo', () => {
    const rs = [{ id: 'v', nome: 'Viagem', moeda: 'USD' as const, valor: 500, dentroDe: 'dolar', criadoEm: 0 }, { id: 'x', nome: 'Outra', moeda: 'USD' as const, valor: 70, criadoEm: 0 }];
    expect(reservado('dolar', rs)).toBe(500);
    expect(reservado('caixa', rs)).toBe(0);
  });
});

describe('quantidade líquida', () => {
  it('não arredonda frações de cripto', () => {
    expect(qtdLiquida(0.042, 'btc', [])).toBe(0.042);
    expect(qtdLiquida(0.0312345, 'eth', [])).toBe(0.0312345);
    expect(qtdLiquida(2500.4, 'dolar', [{ id: 'v', nome: 'Viagem', moeda: 'USD', valor: 500, dentroDe: 'dolar', criadoEm: 0 }])).toBe(2000.4);
  });
});
