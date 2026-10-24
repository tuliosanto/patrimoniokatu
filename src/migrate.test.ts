import { describe, expect, it } from 'vitest';
import { totalMes, totalPorClasse } from './calc';
import { aplicarSeed, idLegado, migrar, type LegadoEstado } from './migrate';

// Dados fictícios no formato antigo
const antigo: LegadoEstado = {
  months: [
    { date: '2023-12-29', acoes: 1000, cdb: 5000, fii: 0, caixa: 300.1, dolar: 800, cripto: 0, etf_bdr: 50, aporte: 100, dividendos: 10, precos: { dolar: 4.85, xrp: null }, det: {} },
    { date: '2024-01-30', acoes: 1100, cdb: 5100.55, fii: 0, caixa: 310, dolar: 820, cripto: 70, etf_bdr: 55, aporte: 120, dividendos: 0, obs: 'nota',
      det: { cdb: { s1: { v: 3000 }, _outros: 2100.55 } } },
  ],
  holdings: [{ t: 'ABCD3', q: 10 }],
  subativos: { acoes: [{ id: 'x1', nome: 'ABCD3', q: 10 }], cdb: [{ id: 's1', nome: 'CDB Banco Y' }] },
};

describe('migrar', () => {
  const e = migrar(antigo, [], 0);

  it('preserva o total de cada mês e de cada classe ao centavo', () => {
    for (const [i, m] of e.meses.entries()) {
      const velho = antigo.months[i];
      const porClasse = totalPorClasse(m, e.ativos);
      for (const c of ['acoes', 'cdb', 'fii', 'caixa', 'dolar', 'cripto', 'etf_bdr'] as const) {
        expect(porClasse[c]).toBeCloseTo(velho[c] ?? 0, 2);
      }
      const somaVelha = ['acoes', 'cdb', 'fii', 'caixa', 'dolar', 'cripto', 'etf_bdr'].reduce((s, k) => s + ((velho as any)[k] ?? 0), 0);
      expect(totalMes(m)).toBeCloseTo(somaVelha, 2);
    }
  });

  it('usa o detalhamento existente e põe o resto no ativo legado', () => {
    const jan = e.meses[1];
    expect(jan.posicoes.s1.v).toBe(3000);
    expect(jan.posicoes[idLegado('cdb')].v).toBe(2100.55);
  });

  it('mantém movimentação, observação e cotações', () => {
    expect(e.meses[0]).toMatchObject({ id: '2023-12', aporte: 100, dividendos: 10, retirada: 0, cotacoes: { dolar: 4.85 } });
    expect(e.meses[1].obs).toBe('nota');
  });

  it('cria ativos legados só para classes com valor', () => {
    const legados = e.ativos.filter((a) => a.legado).map((a) => a.classe).sort();
    expect(legados).toEqual(['acoes', 'caixa', 'cdb', 'cripto', 'etf_bdr']);
  });

  it('leva quantidades do histórico original quando fornecido', () => {
    const { estado, casados } = aplicarSeed(e, [{ date: '2024-01-30', stocks: [{ t: 'ABCD3', q: 12 }] }]);
    expect(casados).toBe(1);
    expect(estado.meses[1].quantidades).toEqual({ ABCD3: 12 });
  });
});
