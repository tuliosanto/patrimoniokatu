import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Popover } from 'radix-ui';
import { CLASSES } from '@/domain/classes';
import type { Ativo, ClasseId } from '@/domain/tipos';
import { cn } from '@/lib/utils';
import { nomeCompleto, rotuloAtivo } from '../textos';

const NOVO = '__novo';
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* Escolher um ativo sem rolar uma lista enorme: busca por nome ou código, filtro por classe em palavras,
   os usados há pouco no topo e "Novo ativo" sempre à mão. Teclado: ↑ ↓ para andar, Enter para escolher. */
export function EscolhaAtivo({ rotulo, ativos, valor, onChange, dica, recentes = [], classeInicial, permitirNovo = true, className, vazio = 'Escolha…' }:
  { rotulo: string; ativos: Ativo[]; valor: string; onChange: (id: string) => void; dica?: string; recentes?: string[];
    classeInicial?: ClasseId; permitirNovo?: boolean; className?: string; vazio?: string }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [classe, setClasse] = useState<ClasseId | ''>(classeInicial ?? '');
  const [ativo, setAtivo] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const atual = ativos.find((a) => a.id === valor);

  const classes = useMemo(() => CLASSES.filter((c) => ativos.some((a) => a.classe === c.id)), [ativos]);
  const opcoes = useMemo(() => {
    const q = normal(busca.trim());
    const xs = ativos
      .filter((a) => (!classe || a.classe === classe) && (!q || normal(`${a.ticker ?? ''} ${a.nome} ${a.corretora ?? ''} ${a.cdb?.banco ?? ''}`).includes(q)))
      .sort((a, b) => CLASSES.findIndex((c) => c.id === a.classe) - CLASSES.findIndex((c) => c.id === b.classe) || rotuloAtivo(a).localeCompare(rotuloAtivo(b)));
    // Sem busca nem filtro: os usados há pouco primeiro.
    const topo = !q && !classe ? recentes.map((r) => xs.find((a) => a.id === r)).filter(Boolean) as Ativo[] : [];
    return { topo, resto: xs.filter((a) => !topo.includes(a)) };
  }, [ativos, busca, classe, recentes]);
  const planas = [...opcoes.topo, ...opcoes.resto];
  const total = planas.length + (permitirNovo ? 1 : 0);

  function escolher(i: number) {
    const a = planas[i];
    onChange(a ? a.id : NOVO);
    setAberto(false); setBusca('');
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = (ativo + (e.key === 'ArrowDown' ? 1 : -1) + total) % total;
      setAtivo(n);
      lista.current?.querySelector(`[data-i="${n}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); if (total) escolher(ativo); }
  }

  const item = (a: Ativo, i: number) => (
    <li key={a.id} id={`${id}-${i}`} data-i={i} role="option" aria-selected={i === ativo}
        onMouseEnter={() => setAtivo(i)} onClick={() => escolher(i)}
        className={cn('flex min-h-10 cursor-pointer items-baseline justify-between gap-4 px-3 py-1.5', i === ativo && 'bg-realce', a.id === valor && 'font-semibold')}>
      <span>{nomeCompleto(a)}</span>
      <span className="text-[13px] text-rotulo">{a.classe === 'cdb' ? a.cdb?.banco ?? '' : a.corretora ?? ''}</span>
    </li>
  );
  let i = 0;

  return (
    <div className={cn('grid gap-1', className)}>
      <span className="rotulo" id={`${id}-r`}>{rotulo}</span>
      <Popover.Root open={aberto} onOpenChange={(v) => { setAberto(v); if (v) { setAtivo(0); setBusca(''); setClasse(classeInicial ?? ''); } }}>
        <Popover.Trigger aria-labelledby={`${id}-r ${id}-v`} aria-describedby={dica ? `${id}-d` : undefined}
          className="flex min-h-11 w-full items-baseline justify-between gap-3 border-0 border-b border-rotulo bg-transparent py-1.5 text-left text-base text-dado outline-none focus-visible:border-b-2 focus-visible:border-dado">
          <span id={`${id}-v`} className={cn(!atual && 'text-rotulo')}>{atual ? nomeCompleto(atual) : vazio}</span>
          <span aria-hidden="true" className="text-sm text-rotulo">buscar</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={12}
            className="z-50 grid w-[min(28rem,calc(100vw-24px))] gap-2 bg-fundo p-3 shadow-[0_0_0_1px_var(--traco),0_12px_32px_-12px_var(--sombra)] outline-none data-[state=open]:animate-[h-esmaece_150ms_ease-out]"
            onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus(); }}>
            <input role="combobox" aria-expanded aria-controls={`${id}-l`} aria-activedescendant={total ? `${id}-${ativo}` : undefined}
              aria-label={`Buscar ${rotulo.toLowerCase()}`} placeholder="Nome, código, banco ou corretora" value={busca} autoComplete="off"
              onChange={(e) => { setBusca(e.target.value); setAtivo(0); }} onKeyDown={tecla}
              className="min-h-11 w-full border-0 border-b border-rotulo bg-transparent px-0 text-base text-dado outline-none placeholder:text-rotulo/80 focus-visible:border-b-2 focus-visible:border-dado" />
            {classes.length > 1 && (
              <div role="radiogroup" aria-label="Filtrar por classe" className="flex flex-wrap gap-x-4">
                {[{ id: '' as const, nome: 'Todas' }, ...classes].map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={classe === c.id} onClick={() => { setClasse(c.id); setAtivo(0); }}
                    className={cn('min-h-9 text-sm', classe === c.id ? 'font-semibold text-dado underline decoration-2 underline-offset-4' : 'text-rotulo hover:text-dado')}>{c.nome}</button>
                ))}
              </div>
            )}
            <ul id={`${id}-l`} ref={lista} role="listbox" aria-labelledby={`${id}-r`} className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain text-[15px]">
              {opcoes.topo.length > 0 && <li role="presentation" className="rotulo px-3 pt-1">Usados há pouco</li>}
              {opcoes.topo.map((a) => item(a, i++))}
              {opcoes.topo.length > 0 && opcoes.resto.length > 0 && <li role="presentation" className="rotulo px-3 pt-3">Todos</li>}
              {opcoes.resto.map((a) => item(a, i++))}
              {planas.length === 0 && <li role="presentation" className="px-3 py-2 text-rotulo">Nada encontrado.</li>}
              {permitirNovo && (
                <li id={`${id}-${planas.length}`} data-i={planas.length} role="option" aria-selected={ativo === planas.length}
                    onMouseEnter={() => setAtivo(planas.length)} onClick={() => escolher(planas.length)}
                    className={cn('mt-1 min-h-10 cursor-pointer px-3 py-1.5 underline decoration-traco underline-offset-4', ativo === planas.length && 'bg-realce')}>
                  Novo ativo{busca.trim() ? ` “${busca.trim()}”` : ''}…
                </li>
              )}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {dica && <p id={`${id}-d`} className="text-sm text-rotulo">{dica}</p>}
    </div>
  );
}
