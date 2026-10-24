import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDocFromServer, initializeFirestore, onSnapshot, persistentLocalCache,
  persistentMultipleTabManager, setDoc, writeBatch, type FirestoreError,
} from 'firebase/firestore';
import { aplicarSeed, ehLegado, migrar, type LegadoSeed } from './migrate';
import type { Ativo, Config, Estado, Mes } from './types';

/* A configuração do Firebase é pública por natureza (vai para o navegador);
   quem protege os dados são as regras em firestore.rules. */
const app = initializeApp({
  apiKey: 'AIzaSyC5EkvfBDvP05eg6wvLh5gZMlwTkUBrJLE',
  authDomain: 'investimentos-katu.firebaseapp.com',
  projectId: 'investimentos-katu',
  storageBucket: 'investimentos-katu.firebasestorage.app',
  messagingSenderId: '783633406438',
  appId: '1:783633406438:web:bcaae800a4c6610d975e27',
});
const auth = getAuth(app);
// Cache local: o app abre e funciona sem internet, e sincroniza quando ela volta.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export type Sync = 'carregando' | 'salvo' | 'salvando' | 'offline' | 'erro';
export interface Snapshot {
  estado: Estado;
  sync: Sync;
  erro?: string;
  /** Já recebemos ativos, meses e config ao menos uma vez. */
  pronto: boolean;
}

const vazio = (): Estado => ({ ativos: [], meses: [], config: { metas: {}, versao: 2 } });

let atual: Snapshot = { estado: vazio(), sync: 'carregando', pronto: false };
const ouvintes = new Set<(s: Snapshot) => void>();
export const snapshot = () => atual;
export function ouvir(fn: (s: Snapshot) => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
function emitir(p: Partial<Snapshot>) {
  atual = { ...atual, ...p };
  ouvintes.forEach((fn) => fn(atual));
}

/* ---------------- Login ---------------- */

export const usuario = () => auth.currentUser;
export function aoMudarUsuario(fn: (u: User | null) => void) {
  return onAuthStateChanged(auth, fn);
}
export async function entrar(email: string, senha: string) {
  await setPersistence(auth, browserLocalPersistence);
  await signInWithEmailAndPassword(auth, email, senha);
}
export const sair = () => signOut(auth);

export function mensagemLogin(code: string): string {
  const m: Record<string, string> = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
  };
  return m[code] ?? 'Não foi possível entrar. Tente novamente.';
}

/* ---------------- Leitura em tempo real ---------------- */

let parar: (() => void)[] = [];

function falha(e: FirestoreError) {
  console.error(e);
  const erro = e.code === 'permission-denied'
    ? 'Sem permissão para ler os dados. As regras do Firestore precisam ser atualizadas (veja firestore.rules).'
    : 'Não foi possível falar com a nuvem. Verifique a internet e recarregue a página.';
  emitir({ sync: 'erro', erro });
}

export async function iniciar() {
  parar.forEach((f) => f());
  parar = [];
  try {
    await migrarSeNecessario();
  } catch (e) {
    falha(e as FirestoreError);
    return;
  }
  const recebido = { ativos: false, meses: false, config: false };
  const pendente = { ativos: false, meses: false, config: false };
  const cache = { ativos: false, meses: false, config: false };
  const atualizar = () => {
    const pronto = recebido.ativos && recebido.meses && recebido.config;
    let sync: Sync = 'salvo';
    if (Object.values(pendente).some(Boolean)) sync = navigator.onLine ? 'salvando' : 'offline';
    else if (Object.values(cache).some(Boolean) && !navigator.onLine) sync = 'offline';
    emitir({ pronto, sync: pronto ? sync : 'carregando', erro: undefined });
  };
  const opt = { includeMetadataChanges: true };
  parar.push(onSnapshot(collection(db, 'ativos'), opt, (s) => {
    recebido.ativos = true; pendente.ativos = s.metadata.hasPendingWrites; cache.ativos = s.metadata.fromCache;
    emitir({ estado: { ...atual.estado, ativos: s.docs.map((d) => ({ ...(d.data() as Ativo), id: d.id })) } });
    atualizar();
  }, falha));
  parar.push(onSnapshot(collection(db, 'meses'), opt, (s) => {
    recebido.meses = true; pendente.meses = s.metadata.hasPendingWrites; cache.meses = s.metadata.fromCache;
    const meses = s.docs.map((d) => ({ ...(d.data() as Mes), id: d.id })).sort((a, b) => a.data.localeCompare(b.data));
    emitir({ estado: { ...atual.estado, meses } });
    atualizar();
  }, falha));
  parar.push(onSnapshot(doc(db, 'config', 'geral'), opt, (s) => {
    recebido.config = true; pendente.config = s.metadata.hasPendingWrites; cache.config = s.metadata.fromCache;
    emitir({ estado: { ...atual.estado, config: (s.data() as Config) ?? vazio().config } });
    atualizar();
  }, falha));
  window.addEventListener('online', atualizar);
  window.addEventListener('offline', atualizar);
  parar.push(() => { window.removeEventListener('online', atualizar); window.removeEventListener('offline', atualizar); });
  void backupDoMes();
}

/* Primeira abertura no modelo novo: converte o documento antigo
   (carteira/dados), que fica intocado como cópia de segurança. Lê do
   servidor de propósito — o cache local vazio não pode disparar migração. */
async function migrarSeNecessario() {
  const cfg = await getDocFromServer(doc(db, 'config', 'geral'));
  if (cfg.exists() && (cfg.data() as Config).versao >= 2) return;
  const velho = await getDocFromServer(doc(db, 'carteira', 'dados'));
  const payload = velho.exists() ? velho.data()?.payload : null;
  if (!payload) {
    await setDoc(doc(db, 'config', 'geral'), vazio().config);
    return;
  }
  const antigo = JSON.parse(payload);
  if (!ehLegado(antigo)) throw new Error('Formato antigo irreconhecível');
  // snapshots não podem ser sobrescritos: o id leva o instante, para uma nova tentativa não colidir
  await gravarEstado(migrar(antigo), `migracao-${Date.now()}`, payload);
}

/** Grava um estado completo em lotes (limite do Firestore: 500 operações por lote). */
async function gravarEstado(e: Estado, idSnapshot?: string, payloadSnapshot?: string) {
  const ops: [string, string, object][] = [
    ...e.ativos.map((a) => ['ativos', a.id, limpar(a)] as [string, string, object]),
    ...e.meses.map((m) => ['meses', m.id, limpar(m)] as [string, string, object]),
  ];
  if (idSnapshot) ops.unshift(['snapshots', idSnapshot, { criadoEm: Date.now(), payload: payloadSnapshot ?? JSON.stringify(e) }]);
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([c, id, d]) => b.set(doc(db, c, id), d));
    await b.commit();
  }
  // a config por último: só marca versão 2 depois que tudo foi gravado
  await setDoc(doc(db, 'config', 'geral'), limpar(e.config));
}

/** Firestore rejeita `undefined`; remove essas chaves em qualquer profundidade. */
function limpar<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

/* ---------------- Escrita ----------------
   Não esperamos a confirmação do servidor: com o cache offline a gravação
   vale localmente na hora, e o indicador de sync mostra quando chegou. */

const autor = () => auth.currentUser?.email ?? undefined;

export function salvarMes(m: Mes) {
  return setDoc(doc(db, 'meses', m.id), limpar({ ...m, atualizadoEm: Date.now(), atualizadoPor: autor() }));
}
export function excluirMes(id: string) {
  return deleteDoc(doc(db, 'meses', id));
}
export function salvarAtivo(a: Ativo) {
  return setDoc(doc(db, 'ativos', a.id), limpar(a));
}
export function salvarConfig(c: Config) {
  return setDoc(doc(db, 'config', 'geral'), limpar(c));
}

/** Substitui tudo por um backup (os ativos e meses que não estiverem nele são apagados). */
export async function restaurar(e: Estado) {
  const antes = atual.estado;
  const b = writeBatch(db);
  antes.meses.filter((m) => !e.meses.some((x) => x.id === m.id)).forEach((m) => b.delete(doc(db, 'meses', m.id)));
  antes.ativos.filter((a) => !e.ativos.some((x) => x.id === a.id)).forEach((a) => b.delete(doc(db, 'ativos', a.id)));
  await b.commit();
  await gravarEstado(e, `antes-de-restaurar-${Date.now()}`, JSON.stringify(antes));
}

export async function importarSeed(seed: LegadoSeed[]) {
  const { estado, casados } = aplicarSeed(atual.estado, seed);
  const b = writeBatch(db);
  estado.meses.filter((m) => m.quantidades).forEach((m) => b.set(doc(db, 'meses', m.id), limpar(m)));
  await b.commit();
  return casados;
}

/* Backup automático: uma cópia completa por mês, guardada na própria nuvem. */
async function backupDoMes() {
  const id = new Date().toISOString().slice(0, 7);
  try {
    const s = await getDocFromServer(doc(db, 'snapshots', id));
    if (s.exists()) return;
    // espera os dados chegarem antes de copiar
    await new Promise<void>((ok) => {
      if (atual.pronto) return ok();
      const off = ouvir((x) => { if (x.pronto) { off(); ok(); } });
    });
    if (!atual.estado.meses.length) return;
    await setDoc(doc(db, 'snapshots', id), { criadoEm: Date.now(), payload: JSON.stringify(atual.estado) });
  } catch (e) {
    console.warn('Backup automático não foi feito agora:', e);
  }
}
