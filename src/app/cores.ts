/* Combinações de cores da H. Cada aparelho guarda a sua; ?cores=noite no endereço também troca.
   Os valores ficam no CSS (src/styles/index.css); aqui só os nomes e o fundo de cada uma, para a barra do sistema. */
export const CORES = [
  { id: 'lilas', nome: 'Lilás', fundo: '#F4F1FA', dado: '#2A1B3D', agora: '#C2410C', nota: 'a original' },
  { id: 'areia', nome: 'Areia', fundo: '#F5F0E8', dado: '#2A2018', agora: '#B03A1E', nota: 'papel quente e terracota' },
  { id: 'salvia', nome: 'Sálvia', fundo: '#EEF3EF', dado: '#18291F', agora: '#B4431A', nota: 'verde acinzentado e cobre' },
  { id: 'nevoa', nome: 'Névoa', fundo: '#EDF1F6', dado: '#141E30', agora: '#C0360F', nota: 'azul frio e vermelhão' },
  { id: 'rose', nome: 'Rosé', fundo: '#F7EFEF', dado: '#36161F', agora: '#0F6F63', nota: 'rosa seco e verde-água' },
  { id: 'noite', nome: 'Noite', fundo: '#17121F', dado: '#EFE9F7', agora: '#FB8A3C', nota: 'escura, para usar à noite' },
] as const;
export type Cores = (typeof CORES)[number]['id'];
const CHAVE = 'np-cores';
const valida = (x: string | null): x is Cores => CORES.some((c) => c.id === x);

export function coresIniciais(): Cores {
  try {
    const q = new URLSearchParams(location.search).get('cores');
    if (valida(q)) { localStorage.setItem(CHAVE, q); return q; }
    const s = localStorage.getItem(CHAVE);
    return valida(s) ? s : 'lilas';
  } catch { return 'lilas'; }
}

export function aplicarCores(c: Cores, guardar = false) {
  if (c === 'lilas') delete document.documentElement.dataset.cores; else document.documentElement.dataset.cores = c;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CORES.find((x) => x.id === c)!.fundo);
  if (guardar) try { localStorage.setItem(CHAVE, c); } catch { /* sem armazenamento: vale só nesta visita */ }
}
