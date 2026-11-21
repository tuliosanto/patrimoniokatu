import { useId, type ReactNode } from 'react';
import { Input, Seletor } from '@/components/ui/input';
import { lerNumero, num } from '@/lib/formato';
import { cn } from '@/lib/utils';

export function Campo({ rotulo, dica, erro, children, className }: { rotulo: string; dica?: ReactNode; erro?: string; children: (id: string, descr?: string) => ReactNode; className?: string }) {
  const id = useId();
  const descr = dica || erro ? `${id}-d` : undefined;
  return (
    <div className={cn('grid gap-1', className)}>
      <label htmlFor={id} className="rotulo">{rotulo}</label>
      {children(id, descr)}
      {(dica || erro) && <p id={descr} className={cn('text-sm', erro ? 'text-erro' : 'text-rotulo')}>{erro ?? dica}</p>}
    </div>
  );
}

/* Campo numérico em formato brasileiro; mostra como o número foi entendido. */
export function CampoNumero({ rotulo, valor, onChange, dica, casas = 8, className, obrigatorio }:
  { rotulo: string; valor: string; onChange: (v: string) => void; dica?: ReactNode; casas?: number; className?: string; obrigatorio?: boolean }) {
  const n = lerNumero(valor);
  const invalido = valor.trim() !== '' && n === null;
  return (
    <Campo rotulo={rotulo} className={className} erro={invalido ? 'Número inválido.' : undefined}
      dica={dica ?? (n !== null && valor.includes('.') && !valor.includes(',') ? `Entendido como ${num(n, casas)}` : undefined)}>
      {(id, d) => <Input id={id} inputMode="decimal" autoComplete="off" value={valor} onChange={(e) => onChange(e.target.value)}
        aria-describedby={d} aria-invalid={invalido || undefined} required={obrigatorio} className="tabular-nums" />}
    </Campo>
  );
}

export function CampoSeletor({ rotulo, valor, onChange, children, dica, className }:
  { rotulo: string; valor: string; onChange: (v: string) => void; children: ReactNode; dica?: ReactNode; className?: string }) {
  return (
    <Campo rotulo={rotulo} dica={dica} className={className}>
      {(id, d) => <Seletor id={id} value={valor} onChange={(e) => onChange(e.target.value)} aria-describedby={d}>{children}</Seletor>}
    </Campo>
  );
}

export function CampoTexto({ rotulo, valor, onChange, tipo = 'text', lista, dica, className }:
  { rotulo: string; valor: string; onChange: (v: string) => void; tipo?: string; lista?: string[]; dica?: ReactNode; className?: string }) {
  const listaId = useId();
  return (
    <Campo rotulo={rotulo} dica={dica} className={className}>
      {(id, d) => <>
        <Input id={id} type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} aria-describedby={d} list={lista ? listaId : undefined} />
        {lista && <datalist id={listaId}>{lista.map((x) => <option key={x} value={x} />)}</datalist>}
      </>}
    </Campo>
  );
}
