import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Popover } from 'radix-ui';
import { mesCurto, mesExtenso } from '@/lib/formato';
import { cn } from '@/lib/utils';

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ref = (ano: number, k: number) => `${ano}-${String(k + 1).padStart(2, '0')}`;

/* Escolher o mês sem digitar: um calendário de meses que mostra o que já foi fechado e o que falta.
   Os pendentes aparecem no topo, um toque leva a eles. Teclado: setas andam pela grade, PageUp/PageDown trocam o ano. */
export function EscolhaMes({ rotulo, valor, onChange, fechados, pendentes, maximo, className }:
  { rotulo: string; valor: string; onChange: (ref: string) => void; fechados: Set<string>; pendentes: string[]; maximo: string; className?: string }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(+valor.slice(0, 4));
  const [foco, setFoco] = useState(+valor.slice(5) - 1);
  const grade = useRef<HTMLDivElement>(null);
  const minimoAno = Math.min(+valor.slice(0, 4), ...[...fechados].map((x) => +x.slice(0, 4)));
  const maxAno = +maximo.slice(0, 4);
  const pend = new Set(pendentes);

  // Ao andar com as setas, o foco acompanha o mês destacado (a abertura foca pelo onOpenAutoFocus).
  useEffect(() => { if (aberto && grade.current?.contains(document.activeElement)) grade.current.querySelector<HTMLButtonElement>(`[data-k="${foco}"]`)?.focus(); }, [aberto, ano, foco]);

  const escolher = (r: string) => { setAberto(false); if (r !== valor) onChange(r); };
  const irPara = (a: number, k: number) => {
    while (k < 0) { k += 12; a--; }
    while (k > 11) { k -= 12; a++; }
    if (a < minimoAno || ref(a, k) > maximo) return;
    setAno(a); setFoco(k);
  };
  function tecla(ev: KeyboardEvent) {
    const passo = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 }[ev.key];
    if (passo != null) { ev.preventDefault(); irPara(ano, foco + passo); }
    else if (ev.key === 'Home') { ev.preventDefault(); setFoco(0); }
    else if (ev.key === 'End') { ev.preventDefault(); setFoco(ano === maxAno ? +maximo.slice(5) - 1 : 11); }
  }
  const estado = (r: string) => r > maximo ? 'futuro' : fechados.has(r) ? 'fechado' : pend.has(r) ? 'pendente' : 'aberto';

  return (
    <div className={cn('grid gap-1', className)}>
      <span className="rotulo" id={`${id}-r`}>{rotulo}</span>
      <Popover.Root open={aberto} onOpenChange={(v) => { setAberto(v); if (v) { setAno(+valor.slice(0, 4)); setFoco(+valor.slice(5) - 1); } }}>
        <Popover.Trigger aria-labelledby={`${id}-r ${id}-v`}
          className="flex min-h-11 w-full items-baseline justify-between gap-3 border-0 border-b border-rotulo bg-transparent py-1.5 text-left text-base text-dado outline-none focus-visible:border-b-2 focus-visible:border-dado">
          <span id={`${id}-v`}>{mesExtenso(valor)}</span>
          <span aria-hidden="true" className="text-sm text-rotulo">trocar</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={(ev) => { ev.preventDefault(); (ev.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('[role=grid] [tabindex="0"]')?.focus(); }}
            className="z-50 grid w-[min(20rem,calc(100vw-24px))] gap-3 bg-fundo p-3 shadow-[0_0_0_1px_var(--traco),0_12px_32px_-12px_var(--sombra)] outline-none data-[state=open]:animate-[h-esmaece_150ms_ease-out]">
            {pendentes.length > 0 && (
              <p className="text-sm">
                <span className="text-rotulo">Falta fechar: </span>
                {pendentes.map((p, i) => (
                  <span key={p}>{i > 0 && ', '}
                    <button type="button" onClick={() => escolher(p)} className="min-h-9 font-semibold text-dado underline decoration-traco underline-offset-4 hover:decoration-dado">{mesCurto(p)}</button>
                  </span>
                ))}
              </p>
            )}
            <div className="flex items-center justify-between">
              <button type="button" aria-label="Ano anterior" disabled={ano <= minimoAno} onClick={() => irPara(ano - 1, foco)}
                className="min-h-10 min-w-10 text-dado disabled:text-rotulo/40">←</button>
              <span className="text-[17px] font-semibold tabular-nums" aria-live="polite">{ano}</span>
              <button type="button" aria-label="Próximo ano" disabled={ano >= maxAno} onClick={() => irPara(ano + 1, Math.min(foco, ano + 1 === maxAno ? +maximo.slice(5) - 1 : 11))}
                className="min-h-10 min-w-10 text-dado disabled:text-rotulo/40">→</button>
            </div>
            <div ref={grade} role="grid" aria-label={`Meses de ${ano}`} onKeyDown={tecla} className="grid grid-cols-3 gap-1">
              {NOMES.map((nome, k) => {
                const r = ref(ano, k);
                const s = estado(r);
                const atual = r === valor;
                return (
                  <button key={r} type="button" data-k={k} tabIndex={k === foco ? 0 : -1} disabled={s === 'futuro'} onClick={() => escolher(r)}
                    aria-current={atual ? 'date' : undefined} aria-label={`${mesExtenso(r)}${s === 'fechado' ? ', já fechado' : s === 'pendente' ? ', falta fechar' : ''}`}
                    className={cn('grid min-h-14 content-center justify-items-center gap-0.5 outline-none hover:bg-realce focus-visible:shadow-[inset_0_0_0_2px_var(--dado)]',
                      atual && 'bg-realce', s === 'futuro' && 'text-rotulo/40 hover:bg-transparent')}>
                    <span className={cn('text-[15px]', atual && 'font-semibold underline decoration-2 underline-offset-4', s === 'pendente' && 'font-semibold')}>{nome}</span>
                    <span className={cn('text-[11px] leading-none', s === 'pendente' ? 'text-dado' : 'text-rotulo')}>
                      {s === 'fechado' ? 'fechado' : s === 'pendente' ? 'a fechar' : ' '}
                    </span>
                  </button>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
