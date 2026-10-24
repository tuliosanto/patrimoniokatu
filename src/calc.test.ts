import { describe, expect, it } from 'vitest';
import { anual, baseProjecao, linhas, mesesAte, mesesPendentes, twr } from './calc';
import type { Mes } from './types';

const mes = (data: string, v: number, aporte = 0, retirada = 0): Mes => ({
  id: data.slice(0, 7), data, posicoes: { a: { v } }, aporte, retirada, dividendos: 0, obs: '', cotacoes: {},
});

describe('linhas', () => {
  it('separa rendimento de aporte e retirada', () => {
    const [, b, c] = linhas([mes('2025-01-31', 1000), mes('2025-02-28', 1150, 100), mes('2025-03-31', 1100, 0, 80)]);
    expect(b.varMes).toBe(150);
    expect(b.rend).toBe(50);
    // retirada não é prejuízo: caiu 50, mas 80 saíram, então rendeu 30
    expect(c.rend).toBe(30);
    expect(c.aportado).toBe(1020);
  });

  it('ordena por data e mede o intervalo real entre fechamentos', () => {
    const ls = linhas([mes('2025-05-10', 1200), mes('2025-01-10', 1000)]);
    expect(ls[0].mes.data).toBe('2025-01-10');
    expect(ls[1].dias).toBe(120);
  });
});

describe('twr', () => {
  it('encadeia retornos e converte para taxa mensal pelo tempo decorrido', () => {
    const ls = linhas([mes('2025-01-01', 1000), mes('2025-03-02', 1100), mes('2025-05-01', 1210)]);
    const t = twr(ls)!;
    expect(t.total).toBeCloseTo(0.21, 6);
    // 120 dias ≈ 3,94 meses: um intervalo longo não conta como "um mês"
    expect(t.mensal).toBeCloseTo(Math.pow(1.21, 30.4375 / 120) - 1, 6);
  });
});

describe('anual', () => {
  it('ganho do ano = fim do ano − fim do ano anterior', () => {
    const ls = linhas([mes('2024-12-20', 1000), mes('2025-06-20', 1100, 50), mes('2025-12-20', 1300, 50)]);
    const [a24, a25] = anual(ls, new Date('2026-01-10'));
    expect(a24.ganho).toBeNull();
    expect(a25.ganho).toBe(300);
    expect(a25.aportes).toBe(100);
    expect(a25.rendimento).toBe(200);
  });
});

describe('projeção', () => {
  it('aporte médio é por mês de calendário, não por registro', () => {
    // 2 registros com 6 meses de distância e R$ 600 de aporte => R$ 100/mês
    const ls = linhas([mes('2025-01-01', 1000), mes('2025-07-02', 1600, 600)]);
    const b = baseProjecao(ls, 0)!;
    expect(b.aporteMensal).toBeCloseTo(600 / (182 / 30.4375), 6);
    expect(b.taxaMensal).toBeCloseTo(0, 6);
  });

  it('mesesAte simula juros + aporte', () => {
    expect(mesesAte(1000, 1000, 0.01, 0)).toBe(0);
    expect(mesesAte(1000, 1300, 0, 100)).toBe(3);
    expect(mesesAte(1000, 2000, 0, 0)).toBeNull();
  });
});

describe('mesesPendentes', () => {
  it('lista os meses entre o último fechamento e o mês atual', () => {
    expect(mesesPendentes([mes('2026-06-15', 1)], new Date(2026, 9, 24))).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(mesesPendentes([mes('2026-09-30', 1)], new Date(2026, 9, 24))).toEqual([]);
  });
});
