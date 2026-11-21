import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { href, type Params, type Tela } from '../rota';

/* Atalho entre módulos: texto sublinhado fino, que escurece ao passar.
   `discreto` deixa o sublinhado só no hover, para listas onde tudo é link. */
export function Para({ tela, params, children, className, discreto, titulo, onClick }:
  { tela: Tela; params?: Params; children: ReactNode; className?: string; discreto?: boolean; titulo?: string; onClick?: () => void }) {
  return (
    <a href={href(tela, params)} title={titulo} onClick={onClick}
       className={cn('text-inherit underline-offset-4 hover:text-dado', discreto ? 'no-underline hover:underline' : 'underline decoration-traco hover:decoration-dado', className)}>
      {children}
    </a>
  );
}
