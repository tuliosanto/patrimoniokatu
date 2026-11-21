import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useStore } from '@/data/store';
import { Entrar } from './telas/Entrar';
import { Moldura } from './Moldura';
import { ParamsProvider, TELAS, useRota, useVer, type Tela } from './rota';
import { Inicio } from './telas/Inicio';

const pagina = <K extends string>(carregar: () => Promise<Record<K, ComponentType>>, nome: K) => lazy(() => carregar().then((m) => ({ default: m[nome] })));
/* Início vem no pacote principal; as demais telas carregam quando abertas. */
const COMPONENTES: Record<Tela, ComponentType> = {
  inicio: Inicio,
  lancar: pagina(() => import('./telas/Lancar'), 'Lancar'),
  fechar: pagina(() => import('./telas/Fechar'), 'Fechar'),
  carteira: pagina(() => import('./telas/Carteira'), 'Carteira'),
  mes: pagina(() => import('./telas/MesAMes'), 'MesAMes'),
  analises: pagina(() => import('./telas/Analises'), 'Analises'),
  metas: pagina(() => import('./telas/Metas'), 'Metas'),
  ajustes: pagina(() => import('./telas/Ajustes'), 'Ajustes'),
};

export function App() {
  const s = useStore();
  const { tela, params } = useRota();
  useVer(params.get('ver'));
  useEffect(() => { document.title = `${TELAS.find((t) => t.id === tela)!.nome} · Nosso Patrimônio`; }, [tela]);

  if (s.usuario === undefined) return <p className="p-[6vw] rotulo" role="status">Abrindo…</p>;
  if (s.usuario === null) return <><Entrar /><Toaster /></>;

  const Atual = COMPONENTES[tela];
  return (
    <Moldura tela={tela} sync={s.sync} erro={s.erro}>
      <Suspense fallback={<p className="rotulo pausa" role="status">Abrindo…</p>}>
        {!s.pronto && s.sync !== 'erro'
          ? <p className="rotulo pausa" role="status">Carregando os dados…</p>
          : <ParamsProvider value={params}><div key={tela} className="tela-entra"><Atual /></div></ParamsProvider>}
      </Suspense>
      <Toaster />
    </Moldura>
  );
}
