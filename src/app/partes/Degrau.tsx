import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Um degrau da escada temporal: recua `nivel` passos (0 a 5) e abre uma pausa acima. */
export function Degrau({ nivel, titulo, children, className, id }: { nivel: 0 | 1 | 2 | 3 | 4 | 5; titulo?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={titulo && id ? id : undefined} id={!titulo ? id : undefined} className={cn('pausa', nivel > 0 && `degrau-${nivel}`, className)}>
      {titulo && <h2 id={id} className="rotulo mb-2 font-medium">{titulo}</h2>}
      {children}
    </section>
  );
}

/* Rótulo à esquerda, valor à direita, numa linha. */
export function Linha({ rotulo, valor, className, forte }: { rotulo: ReactNode; valor: ReactNode; className?: string; forte?: boolean }) {
  return (
    <div className={cn('linha max-w-[32rem]', forte && 'mt-2 font-bold', className)}>
      <span>{rotulo}</span>
      <span>{valor}</span>
    </div>
  );
}
