import { createContext, useContext, useEffect, useState } from 'react';

export type Tela = 'inicio' | 'lancar' | 'fechar' | 'carteira' | 'mes' | 'analises' | 'metas' | 'ajustes';
export const TELAS: { id: Tela; nome: string; principal: boolean }[] = [
  { id: 'inicio', nome: 'Início', principal: true },
  { id: 'lancar', nome: 'Lançar', principal: true },
  { id: 'fechar', nome: 'Fechar mês', principal: true },
  { id: 'carteira', nome: 'Carteira', principal: true },
  { id: 'mes', nome: 'Mês a mês', principal: false },
  { id: 'analises', nome: 'Análises', principal: true },
  { id: 'metas', nome: 'Metas', principal: false },
  { id: 'ajustes', nome: 'Ajustes', principal: false },
];

/* Endereço de cada tela: #/carteira?ativo=…&ver=c-acoes. Os parâmetros ligam um módulo ao outro. */
export type Params = Record<string, string | number | undefined | null>;
export interface Rota { tela: Tela; params: URLSearchParams }

const ler = (): Rota => {
  const [caminho, busca = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const tela = TELAS.some((t) => t.id === caminho) ? (caminho as Tela) : 'inicio';
  return { tela, params: new URLSearchParams(busca) };
};

export function href(tela: Tela, params?: Params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return `#/${tela}${s ? `?${s}` : ''}`;
}

export function useRota() {
  const [rota, setRota] = useState<Rota>(ler);
  useEffect(() => {
    const f = () => setRota((antes) => {
      const nova = ler();
      // Trocar de tela volta ao topo; mudar só os parâmetros (outro mês, outro ativo) mantém o lugar.
      if (nova.tela !== antes.tela && !nova.params.get('ver')) window.scrollTo({ top: 0 });
      return nova;
    });
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return rota;
}

export const ir = (t: Tela, params?: Params) => { location.hash = href(t, params); };
/** Troca os parâmetros da tela atual sem criar um passo novo no histórico do navegador. */
export const trocarParams = (t: Tela, params: Params) => { history.replaceState(null, '', href(t, params)); window.dispatchEvent(new HashChangeEvent('hashchange')); };

const ParamsCtx = createContext<URLSearchParams>(new URLSearchParams());
export const ParamsProvider = ParamsCtx.Provider;
/** Parâmetros da tela atual (ex.: ?ativo=…, ?m=2026-03). */
export const useParams = () => useContext(ParamsCtx);

/** Leva até o elemento de id `ver` e o realça por um instante (quando se chega por um atalho). */
export function useVer(ver: string | null) {
  useEffect(() => {
    if (!ver) return;
    let tentativas = 0, quadro = 0;
    const achar = () => {
      const el = document.getElementById(ver);
      if (!el) { if (tentativas++ < 60) quadro = requestAnimationFrame(achar); return; }
      el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.remove('alvo'); void el.offsetWidth; el.classList.add('alvo');
    };
    quadro = requestAnimationFrame(achar);
    return () => cancelAnimationFrame(quadro);
  }, [ver]);
}
