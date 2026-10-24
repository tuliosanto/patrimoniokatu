/* Modelo de dados.

   Firestore:
     ativos/{id}        um investimento (um CDB, um papel, uma conta…)
     meses/{AAAA-MM}    o fechamento de um mês: posição de cada ativo + movimentação
     config/geral       preferências da família (metas de alocação…)
     snapshots/{data}   cópias completas, para backup automático

   O total de um mês é sempre a soma das posições — não existe "total da
   classe" guardado à parte, então não há como os dois divergirem. */

export type ClasseId = 'acoes' | 'cdb' | 'fii' | 'caixa' | 'dolar' | 'cripto' | 'etf_bdr';
export type GrupoId = 'rf' | 'rv' | 'cri' | 'ext';

export interface Classe {
  id: ClasseId;
  nome: string;
  grupo: GrupoId;
  /** Classe cujos ativos têm quantidade × preço (ações, FIIs, ETFs). */
  cotada: boolean;
}

export interface Ativo {
  id: string;
  nome: string;
  classe: ClasseId;
  /** Código na bolsa ou da cripto, quando houver (PETR4, BTC). */
  ticker?: string;
  /** Quantidade atual (para classes cotadas; no Dólar, em US$). */
  q?: number;
  /** Quanto do CDI o ativo rende (110 = 110% do CDI), para a sugestão de valor no fechamento. */
  taxaCdi?: number;
  /** Ativo criado na migração para guardar o valor agregado dos meses antigos. */
  legado?: boolean;
  /** Fora da carteira: não aparece no fechamento, mas o histórico fica. */
  arquivado?: boolean;
  criadoEm: number;
}

export interface Posicao {
  /** Valor total em R$. */
  v: number;
  /** Quantidade, para ativos cotados. */
  q?: number;
  /** Preço unitário usado no fechamento. */
  p?: number;
}

export interface Mes {
  /** Chave AAAA-MM. */
  id: string;
  /** Data do fechamento, AAAA-MM-DD. */
  data: string;
  posicoes: Record<string, Posicao>;
  /** Dinheiro novo investido no mês. */
  aporte: number;
  /** Dinheiro tirado da carteira no mês (uma viagem, uma despesa grande…). */
  retirada: number;
  dividendos: number;
  obs: string;
  /** Cotações de referência do mês (dólar, btc…). */
  cotacoes: Record<string, number>;
  /** Quantidades por papel em meses antigos, guardadas só como histórico. */
  quantidades?: Record<string, number>;
  atualizadoEm?: number;
  atualizadoPor?: string;
}

export interface Config {
  /** Meta de alocação por classe, em fração (0.25 = 25%). */
  metas: Partial<Record<ClasseId, number>>;
  /** Token gratuito do brapi.dev, para cotações da B3. Fica só na nuvem, protegido pelas regras. */
  brapiToken?: string;
  /** Versão do esquema; 2 = modelo por ativo. */
  versao: number;
  migradoEm?: number;
}

export interface Estado {
  ativos: Ativo[];
  meses: Mes[];
  config: Config;
}
