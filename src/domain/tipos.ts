/* Modelo de dados do Nosso Patrimônio 3.0.

   Firestore (coleções novas; as do 2.0 ficam intocadas como cópia):
     v3_ativos/{id}        um investimento: um papel, uma cripto, um CDB, a conta global, o caixa
     v3_lancamentos/{id}   aporte, compra, venda, resgate, transferência, retirada
     v3_dividendos/{id}    um pagamento, por ativo e data
     v3_fechamentos/{AAAA-MM}  a foto do mês: cotações, posições, valor do banco por classe
     v3_reservas/{id}      dinheiro guardado fora do patrimônio (viagem aos EUA)
     v3_config/geral       metas, token do brapi
     v3_snapshots/{data}   cópias completas, só criadas, nunca alteradas */

export type ClasseId = 'acoes' | 'cdb' | 'fii' | 'caixa' | 'dolar' | 'cripto' | 'etf_bdr';
export type GrupoId = 'rf' | 'rv' | 'cri' | 'ext';

export interface CdbInfo {
  banco?: string;
  /** Valor aplicado originalmente, em R$. */
  aplicado?: number;
  /** Data da aplicação, AAAA-MM-DD. */
  dataAplicacao?: string;
  tipoTaxa?: 'cdi' | 'pre';
  /** 110 = 110% do CDI; ou 12,5 = 12,5% ao ano prefixado. */
  taxa?: number;
  vencimento?: string;
  liquidez?: 'diaria' | 'vencimento';
}

export interface Ativo {
  id: string;
  classe: ClasseId;
  nome: string;
  /** Código na B3 (BBAS3), da cripto (BTC) ou moeda (USD). */
  ticker?: string;
  corretora?: string;
  /** Quantidade na data-base (importação ou cadastro). Lançamentos posteriores somam a ela. */
  qBase?: number;
  /** Data-base da quantidade, AAAA-MM-DD. */
  dataBase?: string;
  /** Preço médio na data-base, digitado da corretora/B3. */
  pmBase?: number;
  cdb?: CdbInfo;
  /** Ativo agregado que guarda o valor de uma classe ainda não detalhada (ex.: FII importado). */
  agregado?: boolean;
  arquivado?: boolean;
  criadoEm: number;
}

export type TipoLancamento = 'aporte' | 'compra' | 'venda' | 'resgate' | 'transferencia' | 'retirada';

export interface Lancamento {
  id: string;
  data: string;
  tipo: TipoLancamento;
  /** Ativo que recebe (aporte, compra, transferência) ou que sai (venda, resgate, retirada). */
  ativoId?: string;
  /** Outra ponta: de onde sai o dinheiro (compra, transferência) ou para onde vai (venda, resgate). */
  contraparteId?: string;
  quantidade?: number;
  /** Preço unitário da operação (em R$; no Dólar, R$ por US$). */
  preco?: number;
  /** Valor total em R$. */
  valor: number;
  corretora?: string;
  obs?: string;
  criadoPor?: string;
  criadoEm: number;
}

export interface Dividendo {
  id: string;
  data: string;
  /** Ausente nos meses importados, quando só havia o total. */
  ativoId?: string;
  valor: number;
  obs?: string;
  criadoEm: number;
}

export interface PosicaoFechamento {
  /** Quantidade (ações, cripto, US$). */
  q?: number;
  /** Preço unitário usado (R$). */
  p?: number;
  /** Valor em R$ (calculado ou digitado do extrato). */
  v?: number;
}

export interface Fechamento {
  /** AAAA-MM */
  id: string;
  /** Data de referência do fechamento, AAAA-MM-DD. */
  data: string;
  cotacoes: Record<string, number>;
  posicoes: Record<string, PosicaoFechamento>;
  /** Valor de cada classe conforme o banco/corretora. Quando presente, é o valor oficial da classe. */
  banco: Partial<Record<ClasseId, number>>;
  /** Totais do mês, guardados para o histórico. */
  aporte: number;
  retirada: number;
  dividendos: number;
  obs?: string;
  importado?: boolean;
  confirmadoPor?: string;
  confirmadoEm?: number;
}

export interface Reserva {
  id: string;
  nome: string;
  moeda: 'USD' | 'BRL';
  valor: number;
  meta?: number;
  /** Ativo onde o dinheiro está guardado (ex.: a conta global em dólar). O valor é descontado dele no patrimônio. */
  dentroDe?: string;
  criadoEm: number;
}

export interface Objetivo {
  id: string;
  nome: string;
  valor: number;
  /** Mês desejado, AAAA-MM (opcional). */
  data?: string;
}

export interface Config {
  /** Meta de alocação por classe, em fração (0,25 = 25%). */
  metas: Partial<Record<ClasseId, number>>;
  /** Antiga meta única (2026-11); continua lida como o primeiro objetivo. */
  metaPatrimonio?: { valor: number; data?: string };
  /** Objetivos de patrimônio para a simulação em Metas. */
  objetivos?: Objetivo[];
  brapiToken?: string;
  /** Pendências a conferir (ex.: vindas da importação). */
  avisos?: string[];
  versao: 3;
}

export interface Estado {
  ativos: Ativo[];
  lancamentos: Lancamento[];
  dividendos: Dividendo[];
  fechamentos: Fechamento[];
  reservas: Reserva[];
  config: Config;
}

export const estadoVazio = (): Estado => ({
  ativos: [], lancamentos: [], dividendos: [], fechamentos: [], reservas: [], config: { metas: {}, versao: 3 },
});
