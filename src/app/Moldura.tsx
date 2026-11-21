import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Sync } from '@/data/store';
import { TELAS, type Tela } from './rota';

const TEXTO_SYNC: Record<Sync, string> = {
  carregando: 'Carregando', salvo: 'Salvo', salvando: 'Salvando…', offline: 'Sem internet · salva ao voltar', erro: 'Erro de sincronização',
};

function LinkTela({ id, nome, atual, className }: { id: Tela; nome: string; atual: boolean; className?: string }) {
  return (
    <a href={`#/${id}`} aria-current={atual ? 'page' : undefined}
       className={cn('text-[15px] no-underline', atual ? 'font-semibold text-dado' : 'text-rotulo hover:text-dado', className)}>{nome}</a>
  );
}

/* A moldura segue H: título em Zodiak itálico à esquerda, navegação só com palavras. */
export function Moldura({ tela, sync, erro, children }: { tela: Tela; sync: Sync; erro?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-28 sm:pb-16">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-fundo focus:p-3">Pular para o conteúdo</a>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-[5vw] pt-[max(4vh,env(safe-area-inset-top))]">
        <a href="#/inicio" className="marco text-xl italic text-dado no-underline">Nosso Patrimônio</a>
        <nav aria-label="Seções" className="hidden flex-wrap gap-x-6 sm:flex">
          {TELAS.map((t) => <LinkTela key={t.id} id={t.id} nome={t.nome} atual={tela === t.id} className="py-2" />)}
        </nav>
        <span className="flex items-baseline gap-x-5">
          {TELAS.filter((t) => !t.principal).map((t) => <LinkTela key={t.id} id={t.id} nome={t.nome} atual={tela === t.id} className="py-2 sm:hidden" />)}
          <span className={cn('rotulo', sync === 'erro' && 'text-erro')} role="status" aria-live="polite">{TEXTO_SYNC[sync]}</span>
        </span>
      </header>
      {erro && <p role="alert" className="mx-[5vw] mt-6 max-w-2xl text-erro">{erro}</p>}

      <main id="conteudo" className="px-[5vw]">{children}</main>

      {/* No celular: as cinco seções principais embaixo, ao alcance do polegar; Metas e Ajustes no topo. */}
      <nav aria-label="Seções principais" className="fixed inset-x-0 bottom-0 z-40 flex justify-around bg-fundo px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1 sm:hidden">
        {TELAS.filter((t) => t.principal).map((t) => <LinkTela key={t.id} id={t.id} nome={t.id === 'fechar' ? 'Fechar' : t.nome} atual={tela === t.id} className="flex min-h-12 items-center px-1.5" />)}
      </nav>
    </div>
  );
}
