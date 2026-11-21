import { fimDoMes } from '@/lib/formato';
import { r2 } from './carteira';
import type { Ativo, ClasseId, Dividendo, Estado, Fechamento } from './tipos';

/* Importa o arquivo historico-consolidado.json (gerado a partir das planilhas da família).
   O arquivo fica fora do repositório; o app o lê pelo seletor de arquivos em Ajustes. */

export interface MesHistorico {
  ref: string;
  data: string;
  classes: Partial<Record<ClasseId, number>>;
  aporte?: number | null;
  dividendos?: number | null;
  retirada?: number | null;
  obs?: string;
  acoes_qtd?: Record<string, number>;
  cripto_qtd?: Record<string, number>;
  cotacoes?: Record<string, number>;
  cdb_aplicacoes?: number[];
  dolar_usd?: number;
  dolar_formula?: string;
}
export interface ArquivoHistorico {
  gerado_em?: string;
  observacoes?: string[];
  pendencias?: string[];
  meses: MesHistorico[];
}

export const CRIPTO_TICKER: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', litecoin: 'LTC', xrp: 'XRP', solana: 'SOL', cardano: 'ADA',
};
const nomeCripto = (k: string) => (k === 'xrp' ? 'XRP' : k.charAt(0).toUpperCase() + k.slice(1));
/* Na planilha, a "cotação" do dólar guardava o valor total da conta em R$, não a taxa; por isso só as criptos viram cotação. */
const COTACAO: Record<string, string> = { ...CRIPTO_TICKER };

export function ehArquivoHistorico(x: unknown): x is ArquivoHistorico {
  const m = (x as ArquivoHistorico)?.meses;
  return Array.isArray(m) && m.length > 0 && typeof m[0]?.ref === 'string' && typeof m[0]?.classes === 'object';
}


export function importarHistorico(arq: ArquivoHistorico, agora = Date.now()): Omit<Estado, 'config' | 'reservas' | 'lancamentos'> & { avisos: string[] } {
  const meses = [...arq.meses].sort((a, b) => a.ref.localeCompare(b.ref));
  const ult = meses[meses.length - 1];
  const dataBase = ult.data;
  const ativos: Ativo[] = [];
  const novo = (a: Omit<Ativo, 'criadoEm'>) => { ativos.push({ ...a, criadoEm: agora }); return a.id; };

  // Ações: um ativo por código que já apareceu; os que não estão no último mês ficam arquivados.
  const tickers = [...new Set(meses.flatMap((m) => Object.keys(m.acoes_qtd ?? {})))].sort();
  for (const t of tickers) {
    const q = ult.acoes_qtd?.[t];
    novo({ id: `acao-${t}`, classe: 'acoes', nome: t, ticker: t, qBase: q ?? 0, dataBase, arquivado: q == null || q === 0 });
  }
  // Criptos
  const criptos = [...new Set(meses.flatMap((m) => Object.keys(m.cripto_qtd ?? {})))];
  for (const k of criptos) {
    const q = ult.cripto_qtd?.[k];
    novo({ id: `cripto-${k}`, classe: 'cripto', nome: nomeCripto(k), ticker: CRIPTO_TICKER[k] ?? k.toUpperCase(), qBase: q ?? 0, dataBase, arquivado: !q });
  }
  // CDBs: as aplicações do último mês, para completar banco, taxa e vencimento depois.
  (ult.cdb_aplicacoes ?? []).forEach((_, i) => novo({ id: `cdb-${i + 1}`, classe: 'cdb', nome: `CDB ${i + 1}`, cdb: {} }));
  novo({ id: 'dolar', classe: 'dolar', nome: 'Conta global', ticker: 'USD', qBase: ult.dolar_usd ?? 0, dataBase });
  novo({ id: 'caixa', classe: 'caixa', nome: 'Valor em Caixa' });
  novo({ id: 'fii', classe: 'fii', nome: 'FII', agregado: true });
  novo({ id: 'etf_bdr', classe: 'etf_bdr', nome: 'ETF/BDR', agregado: true });

  const fechamentos: Fechamento[] = meses.map((m) => {
    const posicoes: Fechamento['posicoes'] = {};
    for (const [t, q] of Object.entries(m.acoes_qtd ?? {})) posicoes[`acao-${t}`] = { q };
    for (const [k, q] of Object.entries(m.cripto_qtd ?? {})) {
      const p = m.cotacoes?.[k];
      posicoes[`cripto-${k}`] = p != null ? { q, p, v: r2(q * p) } : { q };
    }
    // Classes com um só ativo: o valor do ativo é o da classe (mesmo formato dos meses fechados no app).
    for (const [id, c] of [['caixa', 'caixa'], ['fii', 'fii'], ['etf_bdr', 'etf_bdr']] as const) if (m.classes[c] != null) posicoes[id] = { v: r2(m.classes[c]!) };
    if (m.dolar_usd != null || m.classes.dolar != null) posicoes.dolar = { ...(m.dolar_usd != null ? { q: m.dolar_usd } : {}), ...(m.classes.dolar != null ? { v: r2(m.classes.dolar) } : {}) };
    if (m === ult) (m.cdb_aplicacoes ?? []).forEach((v, i) => { posicoes[`cdb-${i + 1}`] = { v }; });
    const cotacoes: Record<string, number> = {};
    for (const [k, v] of Object.entries(m.cotacoes ?? {})) if (COTACAO[k]) cotacoes[COTACAO[k]] = v;
    const banco: Fechamento['banco'] = {};
    for (const [c, v] of Object.entries(m.classes)) if (v != null) banco[c as ClasseId] = r2(v);
    return {
      id: m.ref, data: m.data, cotacoes, posicoes, banco,
      aporte: r2(m.aporte ?? 0), retirada: r2(m.retirada ?? 0), dividendos: r2(m.dividendos ?? 0),
      obs: m.obs || undefined, importado: true,
    };
  });

  const dividendos: Dividendo[] = meses
    .filter((m) => (m.dividendos ?? 0) > 0)
    .map((m) => ({ id: `imp-${m.ref}`, data: fimDoMes(m.ref), valor: r2(m.dividendos!), obs: 'Total do mês (planilha)', criadoEm: agora }));

  const avisos = [...(arq.pendencias ?? [])];
  if (ult.dolar_formula?.includes('-'))
    avisos.push(`Dólar: a planilha descontava um valor da conta em dólar (${ult.dolar_formula}). Se for a reserva da viagem, cadastre-a em Carteira › Fora do patrimônio, guardada dentro da Conta global.`);
  return { ativos, fechamentos, dividendos, avisos };
}
