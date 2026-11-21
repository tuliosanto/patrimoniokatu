import { describe, expect, it } from 'vitest';
import { aporteNecessario, composicaoPorMes, duracao, projetar, responder, resumoPeriodo, somaClasses } from './analise';
import { linhas } from './historico';
import { mesesAte } from './historico';
import type { Ativo, Fechamento } from './tipos';

const ls = linhas([
  { id: '2026-01', data: '2026-01-31', total: 1000, aporte: 0, retirada: 0, dividendos: 0 },
  { id: '2026-02', data: '2026-02-28', total: 1200, aporte: 100, retirada: 0, dividendos: 5 },
  { id: '2026-03', data: '2026-03-31', total: 1150, aporte: 0, retirada: 0, dividendos: 12 },
  { id: '2026-04', data: '2026-04-30', total: 1500, aporte: 300, retirada: 0, dividendos: 0 },
]);

describe('consultas do histórico', () => {
  it('resume um trecho sem contar o fluxo do primeiro mês', () => {
    const r = resumoPeriodo(ls)!;
    expect(r.variacao).toBe(500);
    expect(r.fluxo).toBe(400);
    expect(r.rendimento).toBe(100); // +100, −50, +50
    expect(r.dividendos).toBe(17);
    expect(r.melhor!.mes.id).toBe('2026-02');
    expect(r.pior!.mes.id).toBe('2026-03');
  });
  it('responde perguntas rápidas com o mês', () => {
    expect(responder(ls, 'melhor')).toBe('2026-02');
    expect(responder(ls, 'pior')).toBe('2026-03');
    expect(responder(ls, 'aporte')).toBe('2026-04');
    expect(responder(ls, 'dividendo')).toBe('2026-03');
    expect(responder(ls, 'passou', 1180)).toBe('2026-02');
    expect(responder(ls, 'passou', 9999)).toBeNull();
  });
  it('compõe classes e grupos por mês e soma as classes escolhidas', () => {
    const ativos: Ativo[] = [
      { id: 'a', classe: 'acoes', nome: 'A', criadoEm: 0 },
      { id: 'c', classe: 'cdb', nome: 'C', criadoEm: 0 },
    ];
    const f: Fechamento = { id: '2026-01', data: '2026-01-31', cotacoes: {}, posicoes: { a: { v: 300 }, c: { v: 700 } }, banco: {}, aporte: 0, retirada: 0, dividendos: 0 };
    const m = composicaoPorMes([f], ativos).get('2026-01')!;
    expect(m.grupos.rv).toBe(300);
    expect(m.grupos.rf).toBe(700);
    expect(somaClasses(m.classes, ['acoes'])).toBe(300);
    expect(somaClasses(m.classes, [])).toBe(1000);
  });
});

describe('simulação', () => {
  it('projeta mês a mês e concorda com mesesAte', () => {
    const p = projetar(1000, 0.01, 100, 24);
    const m = mesesAte(1000, 3000, 0.01, 100)!;
    expect(p[m - 1]).toBeLessThan(3000);
    expect(projetar(1000, 0.01, 100, m)[m]).toBeGreaterThanOrEqual(3000);
  });
  it('calcula o aporte que leva ao alvo no prazo', () => {
    const a = aporteNecessario(1000, 3000, 0.01, 24)!;
    expect(projetar(1000, 0.01, a, 24)[24]).toBeCloseTo(3000, 0);
    expect(aporteNecessario(1000, 900, 0.01, 12)).toBe(0);
    expect(aporteNecessario(0, 1200, 0, 12)).toBe(100);
  });
  it('escreve durações', () => {
    expect(duracao(28)).toBe('2 anos e 4 meses');
    expect(duracao(1)).toBe('1 mês');
    expect(duracao(12)).toBe('1 ano');
  });
});
