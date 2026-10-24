import { describe, expect, it } from 'vitest';
import { fatorCdi, idCripto, precoBrapi, ultimoAte } from './cotacoes';

describe('Banco Central', () => {
  const serie = [
    { data: '30/07/2026', valor: '5.0739' },
    { data: '31/07/2026', valor: '5.0773' },
    { data: '03/08/2026', valor: '5.1000' },
  ];
  it('usa o último dia útil até a data pedida', () => {
    expect(ultimoAte(serie, '2026-08-01')).toEqual({ valor: 5.0773, data: '2026-07-31' });
    expect(ultimoAte(serie, '2026-07-29')).toBeNull();
  });
  it('acumula o CDI só nos dias após o início', () => {
    const cdi = [{ data: '30/07/2026', valor: '0.05' }, { data: '31/07/2026', valor: '0.05' }];
    expect(fatorCdi(cdi, '2026-07-30', '2026-07-31')).toBeCloseTo(1.0005, 8);
    expect(fatorCdi(cdi, '2026-07-29', '2026-07-31')).toBeCloseTo(1.0005 ** 2, 8);
  });
});

describe('brapi', () => {
  const ts = (iso: string) => Date.parse(iso + 'T13:00:00Z') / 1000;
  const r = { results: [{ symbol: 'ABCD3', regularMarketPrice: 12, historicalDataPrice: [
    { date: ts('2026-07-30'), close: 10 }, { date: ts('2026-07-31'), close: 10.5 }, { date: ts('2026-08-03'), close: 11 },
  ] }] };
  it('pega o fechamento do último pregão até a data', () => {
    expect(precoBrapi(r, '2026-08-01', '2026-10-24')).toMatchObject({ preco: 10.5, data: '2026-07-31' });
  });
  it('usa o preço atual quando a data é hoje', () => {
    expect(precoBrapi(r, '2026-10-24', '2026-10-24')).toMatchObject({ preco: 12 });
  });
  it('sem resultado devolve null', () => {
    expect(precoBrapi({ results: [] }, '2026-08-01')).toBeNull();
  });
});

describe('cripto', () => {
  it('traduz códigos comuns para o CoinGecko', () => {
    expect(idCripto('btc')).toBe('bitcoin');
    expect(idCripto('XRP')).toBe('ripple');
    expect(idCripto('pepe')).toBe('pepe');
  });
});
