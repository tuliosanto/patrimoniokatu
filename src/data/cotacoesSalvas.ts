import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { ehCotada } from '@/domain/carteira';
import { quantidadesNaData } from '@/domain/fechar';
import type { Estado } from '@/domain/tipos';
import { hojeIso } from '@/lib/formato';
import { cotacaoDoAtivo, motivo } from './cotacaoAtivo';
import { criptos } from './cotacoes';
import { auth, db } from './firebase';

/* Última cotação conhecida de cada ativo, guardada na nuvem da família (v3_config/cotacoes).
   Os dois aparelhos aproveitam a mesma busca, e só se busca de novo o que está velho ou faltou. */
export interface CotacaoSalva {
  /** Preço. */ p: number;
  /** Data do pregão/fixing do preço. */ d: string;
  /** Data pedida na busca (hoje, ou a data de um fechamento). */ para: string;
  /** Quando foi buscada (ms). */ em: number;
  fonte: string;
}
export type Salvas = Record<string, CotacaoSalva>;

/** Cotações do dia valem por 30 min (o brapi gratuito também atualiza a cada 30 min); as de datas passadas, para sempre. */
export const VALIDADE_HOJE = 30 * 60_000;
export const fresca = (c: CotacaoSalva | undefined, data: string, agora = Date.now()) =>
  !!c && c.para === data && (data < hojeIso() || agora - c.em < VALIDADE_HOJE);

const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
const ref = () => doc(db, 'v3_config', 'cotacoes');
let atual: Salvas = {};
const ouvintes = new Set<() => void>();
const emitir = (s: Salvas) => { atual = s; ouvintes.forEach((f) => f()); };
export const cotacoesSalvas = () => atual;
export const useCotacoesSalvas = () => useSyncExternalStore((f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => atual);

if (!DEMO) {
  let parar: (() => void) | null = null;
  onAuthStateChanged(auth, (u) => {
    parar?.(); parar = null;
    if (u) parar = onSnapshot(ref(), (s) => emitir((s.data() as Salvas) ?? {}), (e) => console.error(e));
    else emitir({});
  });
}

/** Quantas buscas estão em andamento (para não disparar duas ao mesmo tempo). */
let emAndamento: Promise<Record<string, string>> | null = null;

/**
 * Busca as cotações que faltam ou estão velhas para a data e guarda na nuvem.
 * `ids` escolhe os ativos (senão, os que têm quantidade na data).
 * Devolve o motivo de cada ativo que não veio (id → texto).
 */
export function atualizarCotacoes(e: Estado, data = hojeIso(), ref_ = data.slice(0, 7), ids?: string[]): Promise<Record<string, string>> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    const qtd = quantidadesNaData(e, ref_, data);
    const quer = (id: string) => (ids ? ids.includes(id) : qtd[id] > 0);
    const faltam = e.ativos.filter((a) => !a.arquivado && ehCotada(a) && quer(a.id) && !fresca(atual[a.id], data));
    const novas: Salvas = {}, falhas: Record<string, string> = {};
    const ok = (id: string, p: number, d: string, fonte: string) => { novas[id] = { p, d, para: data, em: Date.now(), fonte }; };
    const cri = faltam.filter((a) => a.classe === 'cripto');
    const outros = faltam.filter((a) => a.classe !== 'cripto');
    await Promise.all([
      cri.length ? criptos(cri.map((a) => a.ticker ?? a.nome), data).then((r) => {
        for (const a of cri) { const c = r[a.ticker ?? a.nome]; if (c) ok(a.id, c.preco, c.data, c.fonte); else falhas[a.id] = 'cotação não encontrada'; }
      }).catch((x) => { for (const a of cri) falhas[a.id] = motivo(x); }) : null,
      // As da B3 entram numa fila (uma por vez) dentro de b3().
      ...outros.map((a) => cotacaoDoAtivo(a, data, e.config.brapiToken).then((c) => ok(a.id, c.preco, c.data, c.fonte)).catch((x) => { falhas[a.id] = motivo(x); })),
    ]);
    if (Object.keys(novas).length) {
      emitir({ ...atual, ...novas });
      if (!DEMO) await setDoc(ref(), novas, { merge: true }).catch((x) => console.error(x));
    }
    return falhas;
  })().finally(() => { emAndamento = null; });
  return emAndamento;
}
