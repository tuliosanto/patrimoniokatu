import type { ClasseId, GrupoId } from './tipos';

export interface Classe {
  id: ClasseId;
  nome: string;
  grupo: GrupoId;
  /** Valor = quantidade × cotação. */
  cotada: boolean;
}

/* Na ordem do resumo da planilha. */
export const CLASSES: Classe[] = [
  { id: 'acoes', nome: 'Ações', grupo: 'rv', cotada: true },
  { id: 'cdb', nome: 'CDB', grupo: 'rf', cotada: false },
  { id: 'fii', nome: 'FII', grupo: 'rv', cotada: true },
  { id: 'caixa', nome: 'Valor em Caixa', grupo: 'rf', cotada: false },
  { id: 'dolar', nome: 'Dólar', grupo: 'ext', cotada: true },
  { id: 'cripto', nome: 'Criptos', grupo: 'cri', cotada: true },
  { id: 'etf_bdr', nome: 'ETF/BDR', grupo: 'rv', cotada: true },
];

export const GRUPOS: { id: GrupoId; nome: string }[] = [
  { id: 'rf', nome: 'Renda fixa' },
  { id: 'rv', nome: 'Renda variável' },
  { id: 'cri', nome: 'Criptos' },
  { id: 'ext', nome: 'Exterior' },
];

export const classe = (id: ClasseId) => CLASSES.find((c) => c.id === id)!;
