import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

/* A configuração do Firebase é pública por natureza (vai para o navegador);
   quem protege os dados são as regras em firestore.rules. */
export const app = initializeApp({
  apiKey: 'AIzaSyC5EkvfBDvP05eg6wvLh5gZMlwTkUBrJLE',
  authDomain: 'investimentos-katu.firebaseapp.com',
  projectId: 'investimentos-katu',
  storageBucket: 'investimentos-katu.firebasestorage.app',
  messagingSenderId: '783633406438',
  appId: '1:783633406438:web:bcaae800a4c6610d975e27',
});
export const auth = getAuth(app);
// Cache local: o app abre sem internet e sincroniza quando ela volta.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

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
