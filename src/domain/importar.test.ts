import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { r2, totalFechamento } from './carteira';
import { importarHistorico, type ArquivoHistorico } from './importar';

const exemplo: ArquivoHistorico = {
  pendencias: ['conferir setembro'],
  meses: [
    { ref: '2026-09', data: '2026-09-30', classes: { acoes: 100, cdb: 200, cripto: 50 }, aporte: 10, dividendos: 5,
      acoes_qtd: { BBAS3: 10, VALE3: 5 }, cripto_qtd: { bitcoin: 0.001 }, cotacoes: { bitcoin: 50000, 'dólar': 900 } },
    { ref: '2026-10', data: '2026-11-01', classes: { acoes: 120, cdb: 210, cripto: 60, dolar: 900 }, dividendos: 0,
      acoes_qtd: { BBAS3: 12 }, cripto_qtd: { bitcoin: 0.0012 }, cotacoes: { bitcoin: 50000 }, cdb_aplicacoes: [110, 100], dolar_usd: 170, dolar_formula: '(170*H30)-H26' },
  ],
};

describe('importação do histórico', () => {
  const r = importarHistorico(exemplo, 1);
  it('o total de cada mês é a soma das classes do arquivo', () => {
    expect(r.fechamentos.map((f) => totalFechamento(f, r.ativos))).toEqual([350, 1290]);
  });
  it('cria ativos com a quantidade do último mês e arquiva os que saíram', () => {
    const bbas = r.ativos.find((a) => a.id === 'acao-BBAS3')!;
    expect(bbas.qBase).toBe(12);
    expect(r.ativos.find((a) => a.id === 'acao-VALE3')!.arquivado).toBe(true);
    expect(r.ativos.filter((a) => a.classe === 'cdb')).toHaveLength(2);
    expect(r.ativos.find((a) => a.id === 'dolar')!.qBase).toBe(170);
  });
  it('meses importados têm o mesmo formato dos fechados no app: o ativo único da classe leva o valor', () => {
    expect(r.fechamentos[1].posicoes.dolar).toEqual({ q: 170, v: 900 });
    for (const f of r.fechamentos) for (const c of ['caixa', 'fii', 'etf_bdr', 'dolar'] as const)
      if (f.banco[c] != null) expect(f.posicoes[c === 'dolar' ? 'dolar' : c]?.v).toBe(f.banco[c]);
  });
  it('guarda quantidades por mês e cotações com códigos', () => {
    expect(r.fechamentos[0].posicoes['acao-VALE3']).toEqual({ q: 5 });
    expect(r.fechamentos[0].cotacoes).toEqual({ BTC: 50000 });
  });
  it('dividendos do mês viram um lançamento sem ativo, no fim do mês', () => {
    expect(r.dividendos).toEqual([{ id: 'imp-2026-09', data: '2026-09-30', valor: 5, obs: 'Total do mês (planilha)', criadoEm: 1 }]);
    expect(r.avisos[0]).toBe('conferir setembro');
    expect(r.avisos[1]).toMatch(/descontava um valor da conta em dólar/);
  });
});

/* Conferência com o arquivo real da família, quando ele está neste computador (nunca vai para o repositório). */
const real = join(homedir(), 'Documents/KatuInvest-backups/historico-consolidado.json');
describe.skipIf(!existsSync(real))('arquivo real', () => {
  it('os 48 totais batem centavo a centavo', () => {
    const arq = JSON.parse(readFileSync(real, 'utf8')) as ArquivoHistorico;
    const r = importarHistorico(arq);
    const esperado = [...arq.meses].sort((a, b) => a.ref.localeCompare(b.ref))
      .map((m) => r2(Object.values(m.classes).reduce((s, v) => s + (v ?? 0), 0)));
    expect(r.fechamentos.map((f) => totalFechamento(f, r.ativos))).toEqual(esperado);
    expect(r.fechamentos).toHaveLength(arq.meses.length);
  });
});
