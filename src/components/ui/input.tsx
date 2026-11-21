import * as React from 'react';
import { cn } from '@/lib/utils';

/* Campo da direção H: só a linha de base, como numa planilha preenchida à mão. */
const campo =
  'min-h-11 w-full min-w-0 border-0 border-b border-rotulo bg-transparent px-0 py-1.5 text-base text-dado outline-none ' +
  'placeholder:text-rotulo/80 focus-visible:border-b-2 focus-visible:border-dado ' +
  'disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-erro';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" autoComplete="off" className={cn(campo, className)} {...props} />;
}

/* Seletor nativo: acessível, com a roda do sistema no celular. Sem ícones desenhados. */
function Seletor({ className, ...props }: React.ComponentProps<'select'>) {
  return <select data-slot="select" className={cn(campo, 'cursor-pointer appearance-auto bg-fundo text-dado', className)} {...props} />;
}

export { Input, Seletor };
