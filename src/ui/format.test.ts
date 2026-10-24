import { describe, expect, it } from 'vitest';
import { lerNum } from './format';

describe('lerNum', () => {
  it('entende números digitados em pt-BR', () => {
    expect(lerNum('1.234,56')).toBe(1234.56);
    expect(lerNum('R$ 2.529')).toBe(2529);
    expect(lerNum('1.234.567')).toBe(1234567);
    expect(lerNum('1234,5')).toBe(1234.5);
    expect(lerNum('12.5')).toBe(12.5);
    expect(lerNum('0,00012')).toBe(0.00012);
    expect(lerNum('')).toBe(0);
    expect(lerNum('abc')).toBe(0);
  });
});
