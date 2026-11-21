import { describe, expect, it } from 'vitest';
import { montarFechamento, quantidadesNaData } from './fechar';
import { estadoVazio, type Estado } from './tipos';

const base = (): Estado => ({
  ...estadoVazio(),
  ativos: [
    { id: 'btc', classe: 'cripto', nome: 'Bitcoin', ticker: 'BTC', qBase: 0.042, dataBase: '2026-11-01', criadoEm: 0 },
    { id: 'cdb1', classe: 'cdb', nome: 'CDB 1', cdb: { tipoTaxa: 'cdi', taxa: 110 }, criadoEm: 0 },
    { id: 'caixa', classe: 'caixa', nome: 'Caixa', criadoEm: 0 },
    { id: 'fii', classe: 'fii', nome: 'FII', agregado: true, criadoEm: 0 },
    { id: 'dolar', classe: 'dolar', nome: 'Conta global', ticker: 'USD', qBase: 1000, dataBase: '2026-11-01', criadoEm: 0 },
  ],
  fechamentos: [{
    id: '2026-10', data: '2026-11-01', cotacoes: {}, aporte: 5, retirada: 0, dividendos: 0, importado: true,
    banco: { cripto: 16800, cdb: 10000, caixa: 2000, fii: 49, dolar: 5000 },
    posicoes: { btc: { q: 0.042, p: 400000, v: 16800 }, cdb1: { v: 10000 }, caixa: { v: 2000 }, fii: { v: 49 }, dolar: { q: 1000, v: 5000 } },
  }],
});
const entrada = { ref: '2026-11', data: '2026-11-30', precos: { btc: 420000, dolar: 5.5 }, extratos: {}, banco: {}, fatorCdi: 1.01 };

describe('montar o fechamento', () => {
  it('cota, corrige o CDB pelo CDI e soma o caixa com os lançamentos', () => {
    const e = base();
    e.lancamentos = [{ id: 'l', data: '2026-11-10', tipo: 'aporte', ativoId: 'caixa', valor: 300, criadoEm: 1 }];
    const r = montarFechamento(e, entrada);
    expect(r.fechamento.posicoes.btc).toEqual({ q: 0.042, p: 420000, v: 17640 });
    expect(r.fechamento.posicoes.cdb1).toEqual({ v: 10110 });           // 110% de 1% de CDI
    expect(r.fechamento.posicoes.caixa).toEqual({ v: 2300 });
    expect(r.fechamento.posicoes.fii).toEqual({ v: 49 });              // sem detalhe: repete
    expect(r.repetidas.has('fii')).toBe(true);
    expect(r.fechamento.aporte).toBe(300);
    expect(r.total).toBe(17640 + 10110 + 2300 + 49 + 5500);
    expect(r.incompletas).toEqual([]);
  });

  it('cotação faltando deixa a classe incompleta até o banco ser informado', () => {
    const r = montarFechamento(base(), { ...entrada, precos: { dolar: 5.5 } });
    expect(r.incompletas).toEqual(['cripto']);
    expect(montarFechamento(base(), { ...entrada, precos: { dolar: 5.5 }, banco: { cripto: 27000 } }).incompletas).toEqual([]);
  });

  it('o extrato prevalece sobre a estimativa do CDB; um CDB novo parte de zero', () => {
    const e = base();
    e.ativos.push({ id: 'cdb2', classe: 'cdb', nome: 'CDB 2', criadoEm: 2 });
    e.lancamentos = [{ id: 't', data: '2026-11-05', tipo: 'transferencia', ativoId: 'cdb2', contraparteId: 'caixa', valor: 1000, criadoEm: 1 }];
    const r = montarFechamento(e, { ...entrada, extratos: { cdb1: 10050 } });
    expect(r.fechamento.posicoes.cdb1).toEqual({ v: 10050 });
    expect(r.fechamento.posicoes.cdb2).toEqual({ v: 1000 });
    expect(r.fechamento.posicoes.caixa).toEqual({ v: 1000 });
  });

  it('a reserva guardada na conta em dólar sai do patrimônio', () => {
    const e = base();
    e.reservas = [{ id: 'v', nome: 'Viagem', moeda: 'USD', valor: 200, dentroDe: 'dolar', criadoEm: 0 }];
    expect(montarFechamento(e, entrada).fechamento.posicoes.dolar).toEqual({ q: 800, p: 5.5, v: 4400 });
  });

  it('mantém os fluxos de um mês importado ao refazê-lo e usa as quantidades daquele mês', () => {
    const e = base();
    expect(quantidadesNaData(e, '2026-10', '2026-10-31').btc).toBe(0.042);
    const r = montarFechamento(e, { ...entrada, ref: '2026-10', data: '2026-10-31' });
    expect(r.fechamento.aporte).toBe(5);
  });
});
