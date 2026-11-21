import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Moldura de cada tela: título em Zodiak itálico (marco da direção H) e, opcionalmente, uma ação à direita. */
export function Tela({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <div className="pb-[6vh]">
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="marco text-[clamp(28px,3.6vw,48px)] font-light italic">{titulo}</h1>
        {acao}
      </div>
      {children}
    </div>
  );
}

/* Grupo de opções só com palavras: a escolhida fica sublinhada. */
export function Escolha<T extends string | number>({ rotulo, opcoes, valor, onChange, className, tamanho = 'text-[15px]' }:
  { rotulo: string; opcoes: { id: T; nome: string }[]; valor: T; onChange: (v: T) => void; className?: string; tamanho?: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn('flex flex-wrap gap-x-6 gap-y-1', className)}>
      {opcoes.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={valor === o.id} onClick={() => onChange(o.id)}
          className={cn('min-h-11', tamanho, valor === o.id ? 'font-semibold text-dado underline decoration-2 underline-offset-8' : 'text-rotulo hover:text-dado')}>
          {o.nome}
        </button>
      ))}
    </div>
  );
}
