import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch, type FirestoreError, type QuerySnapshot,
} from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { auth, db } from './firebase';
import { estadoVazio, type Ativo, type Config, type Dividendo, type Estado, type Fechamento, type Lancamento, type Reserva } from '@/domain/tipos';

/* Coleções do 3.0. As do 2.0 (ativos, meses, config, snapshots, carteira) ficam intocadas. */
const COL = {
  ativos: 'v3_ativos', lancamentos: 'v3_lancamentos', dividendos: 'v3_dividendos',
  fechamentos: 'v3_fechamentos', reservas: 'v3_reservas', config: 'v3_config', snapshots: 'v3_snapshots',
} as const;
type Lista = 'ativos' | 'lancamentos' | 'dividendos' | 'fechamentos' | 'reservas';
const LISTAS: Lista[] = ['ativos', 'lancamentos', 'dividendos', 'fechamentos', 'reservas'];

export type Sync = 'carregando' | 'salvo' | 'salvando' | 'offline' | 'erro';
export interface Snapshot {
  usuario: User | null | undefined; // undefined = ainda verificando
  estado: Estado;
  sync: Sync;
  erro?: string;
  pronto: boolean;
}

/* Modo de demonstração (só em desenvolvimento, com ?demo): lê o histórico local servido pelo Vite
   e guarda tudo em memória, sem login e sem tocar na nuvem. Não existe no site publicado. */
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');

let atual: Snapshot = { usuario: undefined, estado: estadoVazio(), sync: 'carregando', pronto: false };
const ouvintes = new Set<() => void>();
function emitir(p: Partial<Snapshot>) {
  atual = { ...atual, ...p };
  ouvintes.forEach((f) => f());
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
export const useStore = () => useSyncExternalStore(assinar, () => atual);
/** Só os dados: a tela não redesenha quando muda apenas o indicador de sincronização. */
export const useEstado = () => useSyncExternalStore(assinar, () => atual.estado);

/* ---------------- Leitura em tempo real ---------------- */

let parar: (() => void)[] = [];

function falha(e: FirestoreError) {
  console.error(e);
  const erro = e.code === 'permission-denied'
    ? 'Sem permissão para ler os dados. As regras do Firestore precisam ser atualizadas com o arquivo firestore.rules.'
    : 'Não foi possível falar com a nuvem. Verifique a internet e recarregue.';
  emitir({ sync: 'erro', erro });
}

function iniciar() {
  parar.forEach((f) => f());
  parar = [];
  const recebido = new Set<string>();
  const pendente = new Set<string>();
  const estadoSync = (): Pick<Snapshot, 'pronto' | 'sync'> => {
    const pronto = recebido.size === LISTAS.length + 1;
    const sync: Sync = !pronto ? 'carregando' : pendente.size ? (navigator.onLine ? 'salvando' : 'offline') : navigator.onLine ? 'salvo' : 'offline';
    return { pronto, sync };
  };
  /* Uma emissão por snapshot. Mudanças só de metadados (a gravação local virou confirmada) não recriam o estado,
     para não recalcular telas e gráficos à toa. Um erro de leitura fica visível até recarregar. */
  const receber = (nome: string, pend: boolean, mudou: boolean, parcial: Partial<Estado>) => {
    const primeira = !recebido.has(nome);
    recebido.add(nome);
    if (pend) pendente.add(nome); else pendente.delete(nome);
    if (atual.sync === 'erro') return;
    emitir({ ...estadoSync(), erro: undefined, ...(mudou || primeira ? { estado: { ...atual.estado, ...parcial } } : {}) });
  };
  const opt = { includeMetadataChanges: true };
  for (const nome of LISTAS) {
    parar.push(onSnapshot(collection(db, COL[nome]), opt, (s: QuerySnapshot) => {
      const mudou = s.docChanges().length > 0;
      receber(nome, s.metadata.hasPendingWrites, mudou, mudou || !recebido.has(nome) ? { [nome]: s.docs.map((d) => ({ ...d.data(), id: d.id })) } : {});
    }, falha));
  }
  parar.push(onSnapshot(doc(db, COL.config, 'geral'), opt, (s) => {
    receber('config', s.metadata.hasPendingWrites, true, { config: (s.data() as Config) ?? estadoVazio().config });
  }, falha));
  const rede = () => { if (atual.sync !== 'erro') emitir(estadoSync()); };
  window.addEventListener('online', rede);
  window.addEventListener('offline', rede);
  parar.push(() => { window.removeEventListener('online', rede); window.removeEventListener('offline', rede); });
}

if (DEMO) {
  void (async () => {
    const { importarHistorico } = await import('@/domain/importar');
    const arq = await fetch('/__demo.json').then((r) => r.json());
    const r = importarHistorico(arq);
    emitir({ usuario: { email: 'demonstracao@local' } as User, pronto: true, sync: 'salvo',
      estado: { ...estadoVazio(), ativos: r.ativos, fechamentos: r.fechamentos, dividendos: r.dividendos, config: { metas: {}, versao: 3, avisos: r.avisos } } });
  })();
} else onAuthStateChanged(auth, (u) => {
  emitir({ usuario: u });
  if (u) { emitir({ sync: 'carregando', erro: undefined }); iniciar(); }
  else { parar.forEach((f) => f()); parar = []; emitir({ estado: estadoVazio(), pronto: false, sync: 'carregando' }); }
});

/* ---------------- Escrita ---------------- */

/* O Firestore não aceita undefined: removemos as chaves vazias antes de gravar. */
function limpo<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}
const autor = () => auth.currentUser?.email ?? undefined;

/* Com o cache offline, a promessa de gravação só termina quando o servidor confirma.
   Sem internet, isso nunca acontece: a gravação já está no aparelho e sobe quando a conexão voltar.
   Então esperamos a confirmação por até 4 s; depois seguimos, e um erro tardio aparece no topo. */
function gravar(p: Promise<unknown>): Promise<void> {
  const tardio = p.then(() => undefined).catch((e: FirestoreError) => {
    emitir({ sync: 'erro', erro: e.code === 'permission-denied' ? 'A nuvem recusou a gravação: as regras do Firestore precisam ser atualizadas.' : 'Uma gravação falhou. Recarregue e confira.' });
    throw e;
  });
  if (!navigator.onLine) { tardio.catch(() => undefined); return Promise.resolve(); }
  return Promise.race([tardio, new Promise<void>((r) => setTimeout(r, 4000))]);
}

function local(nome: Lista, item: { id: string } | null, apagar?: string) {
  const xs = (atual.estado[nome] as { id: string }[]).filter((x) => x.id !== (item?.id ?? apagar));
  emitir({ estado: { ...atual.estado, [nome]: item ? [...xs, item] : xs } });
  return Promise.resolve();
}

export const novoId = () => crypto.randomUUID();

export const salvarAtivo = (a: Ativo) => DEMO ? local('ativos', a) : gravar(setDoc(doc(db, COL.ativos, a.id), limpo(a)));
export const salvarLancamento = (l: Lancamento) => DEMO ? local('lancamentos', l) : gravar(setDoc(doc(db, COL.lancamentos, l.id), limpo({ ...l, criadoPor: l.criadoPor ?? autor() })));
export const excluirLancamento = (id: string) => DEMO ? local('lancamentos', null, id) : gravar(deleteDoc(doc(db, COL.lancamentos, id)));
export const salvarDividendo = (d: Dividendo) => DEMO ? local('dividendos', d) : gravar(setDoc(doc(db, COL.dividendos, d.id), limpo(d)));
export const excluirDividendo = (id: string) => DEMO ? local('dividendos', null, id) : gravar(deleteDoc(doc(db, COL.dividendos, id)));
export const salvarReserva = (r: Reserva) => DEMO ? local('reservas', r) : gravar(setDoc(doc(db, COL.reservas, r.id), limpo(r)));
export const excluirReserva = (id: string) => DEMO ? local('reservas', null, id) : gravar(deleteDoc(doc(db, COL.reservas, id)));
export const salvarConfig = (c: Config) => DEMO ? (emitir({ estado: { ...atual.estado, config: c } }), Promise.resolve()) : gravar(setDoc(doc(db, COL.config, 'geral'), limpo(c)));

export async function salvarFechamento(f: Fechamento): Promise<{ backupNaNuvem: boolean }> {
  if (DEMO) { await local('fechamentos', f); return { backupNaNuvem: true }; }
  const b = writeBatch(db);
  b.set(doc(db, COL.fechamentos, f.id), limpo({ ...f, confirmadoPor: autor(), confirmadoEm: Date.now() }));
  // Backup: uma cópia completa por fechamento confirmado, que não pode ser alterada depois.
  // Ao revisar um mês já fechado, a versão substituída vai junto na cópia, para poder voltar a ela.
  const substituido = atual.estado.fechamentos.find((x) => x.id === f.id);
  const copia = limpo({ criadoEm: Date.now(), por: autor(), estado: { ...atual.estado, fechamentos: [...atual.estado.fechamentos.filter((x) => x.id !== f.id), f] }, ...(substituido ? { substituido } : {}) });
  // Um documento do Firestore aceita até 1 MB; acima disso, o backup na nuvem é pulado (o backup em arquivo continua disponível).
  const cabe = JSON.stringify(copia).length < 900_000;
  if (cabe) b.set(doc(db, COL.snapshots, `${f.id}-${Date.now()}`), copia);
  await gravar(b.commit());
  return { backupNaNuvem: cabe };
}

/** Grava muitos documentos em lotes de até 450 operações.
    Com `substituir`, apaga das coleções gravadas os documentos que não estão em `e` (restauração de backup). */
export async function gravarTudo(e: Partial<Estado>, substituir = false) {
  if (DEMO) { emitir({ estado: { ...atual.estado, ...e } }); return 0; }
  const ops: [string, string, object | null][] = [];
  if (substituir) for (const nome of LISTAS) {
    if (!e[nome]) continue;
    const ficam = new Set((e[nome] as { id: string }[]).map((x) => x.id));
    for (const x of atual.estado[nome] as { id: string }[]) if (!ficam.has(x.id)) ops.push([COL[nome], x.id, null]);
  }
  for (const nome of LISTAS) for (const x of (e[nome] ?? []) as { id: string }[]) ops.push([COL[nome], x.id, x]);
  if (e.config) ops.push([COL.config, 'geral', e.config]);
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db);
    for (const [c, id, x] of ops.slice(i, i + 450)) { if (x) b.set(doc(db, c, id), limpo(x)); else b.delete(doc(db, c, id)); }
    await gravar(b.commit());
  }
  return ops.length;
}

export function exportar(): string {
  return JSON.stringify({ app: 'nosso-patrimonio', versao: 3, exportadoEm: new Date().toISOString(), estado: atual.estado }, null, 2);
}
