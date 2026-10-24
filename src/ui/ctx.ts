import type { Linha } from '../calc';
import type { Snapshot } from '../store';

/** O que toda tela recebe para se desenhar. */
export interface Ctx {
  s: Snapshot;
  ls: Linha[];
  /** Partes da rota após '#/': ['fechar', '2026-06']. */
  rota: string[];
  ir: (rota: string) => void;
  redesenhar: () => void;
}

/** Preferência local deste navegador (não vai para a nuvem). */
export function pref<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem('np:' + chave);
    return v == null ? padrao : (JSON.parse(v) as T);
  } catch {
    return padrao;
  }
}
export function setPref(chave: string, v: unknown) {
  try { localStorage.setItem('np:' + chave, JSON.stringify(v)); } catch { /* modo privado: tudo bem */ }
}
