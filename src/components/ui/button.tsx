import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

/* Botões da direção H: tipográficos, sem cantos arredondados nem sombra.
   Laranja só para a ação do "agora" (ex.: confirmar o fechamento). */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        agora: 'bg-agora text-fundo hover:bg-[var(--agora-forte)]',
        default: 'bg-dado text-fundo hover:bg-[var(--dado-forte)]',
        texto: 'text-dado underline decoration-traco decoration-1 underline-offset-[6px] hover:decoration-dado',
        rotulo: 'text-rotulo hover:text-dado',
        destrutivo: 'text-erro underline decoration-1 underline-offset-[6px]',
      },
      size: {
        default: 'min-h-11 px-5 text-[15px]',
        sm: 'min-h-10 px-3 text-sm',
        texto: 'min-h-11 px-0 text-[15px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({ className, variant, size, asChild = false, ...props }:
  React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
