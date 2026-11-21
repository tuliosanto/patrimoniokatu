import { describe, expect, it } from 'vitest';
import { brl, comSinal, fimDoMes, lerNumero, mesCurto, mesesDe, mesesEntre, mesExtenso, num, paraCampo, pct, somarMeses } from './formato';

describe('formato brasileiro', () => {
  it('moeda e números', () => {
    expect(brl(123456.78)).toBe('R$ 123.456,78');
    expect(comSinal(9876.54)).toBe('+R$ 9.876,54');
    expect(comSinal(-10)).toBe('−R$ 10,00');
    expect(num(0.0312345)).toBe('0,0312345');
    expect(pct(0.0459, 2, true)).toBe('+4,59%');
  });
  it('meses', () => {
    expect(mesExtenso('2026-10')).toBe('Outubro de 2026');
    expect(mesCurto('2021-08')).toBe('ago/21');
    expect(fimDoMes('2026-02')).toBe('2026-02-28');
  });
  it('lê o que a pessoa digita', () => {
    expect(lerNumero('1.234,56')).toBe(1234.56);
    expect(lerNumero('R$ 12,5')).toBe(12.5);
    expect(lerNumero('0.042')).toBe(0.042);
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('abc')).toBeNull();
  });
});

describe('campos editáveis', () => {
  it('o valor escrito no campo é lido de volta igual (sem ponto de milhar ambíguo)', () => {
    for (const v of [371250, 371250.55, 0.0312345, 1500, 5.4321, 12.5]) expect(lerNumero(paraCampo(v))).toBe(v);
    expect(paraCampo(371250)).toBe('371250');
  });
});

describe('meses', () => {
  it('soma e conta meses atravessando o ano', () => {
    expect(somarMeses('2026-11', 2)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(mesesEntre('2025-12', '2026-03')).toBe(3);
    expect(mesesDe('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
