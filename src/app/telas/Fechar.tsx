import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CLASSES } from '@/domain/classes';
import { ehCotada, r2, reservado } from '@/domain/carteira';
import { fechamentoAnterior, montarFechamento, quantidadesNaData } from '@/domain/fechar';
import type { Ativo, ClasseId, Estado } from '@/domain/tipos';
import { cotacaoDoAtivo, motivo } from '@/data/cotacaoAtivo';
import { cdi, criptos } from '@/data/cotacoes';
import { salvarFechamento, useEstado } from '@/data/store';
import { brl, comSinal, dataBr, fimDoMes, hojeIso, lerNumero, mesAtual, mesesEntre, mesExtenso, num, paraCampo, pct, somarMeses } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { CampoTexto } from '../partes/Campo';
import { EscolhaMes } from '../partes/EscolhaMes';
import { Linha } from '../partes/Degrau';
import { Tela } from '../partes/Tela';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { calcularResumo } from '../resumo';
import { ir, trocarParams, useParams } from '../rota';
import { rotuloAtivo } from '../textos';

const dataPadrao = (ref: string) => { const h = hojeIso(); return fimDoMes(ref) > h ? h : fimDoMes(ref); };
const lerTodos = (xs: Record<string, string>) => Object.fromEntries(Object.entries(xs).map(([k, v]) => [k, lerNumero(v)]));
type Textos = Record<string, string>;

/** Busca as cotações e o CDI do período, em paralelo. Devolve preços como texto de campo e o status de cada ativo. */
async function buscarCotacoes(e: Estado, ref: string, data: string) {
  const qtd = quantidadesNaData(e, ref, data);
  const ativos = e.ativos.filter((a) => !a.arquivado && ehCotada(a) && qtd[a.id] > 0);
  const precos: Textos = {}, status: Textos = {};
  const ok = (a: Ativo, preco: number, d: string) => { precos[a.id] = paraCampo(preco, 6); status[a.id] = d !== data ? `cotação de ${dataBr(d)}` : 'ok'; };
  const cri = ativos.filter((a) => a.classe === 'cripto');
  const outros = ativos.filter((a) => a.classe !== 'cripto' && (a.classe === 'dolar' || e.config.brapiToken));
  const anterior = fechamentoAnterior(e.fechamentos, ref, data);
  const [, , fator] = await Promise.all([
    cri.length ? criptos(cri.map(rotuloAtivo), data).then((r) => {
      for (const a of cri) { const c = r[rotuloAtivo(a)]; if (c) ok(a, c.preco, c.data); else status[a.id] = 'cotação não encontrada'; }
    }).catch((x) => { for (const a of cri) status[a.id] = motivo(x); }) : null,
    Promise.all(outros.map((a) => cotacaoDoAtivo(a, data, e.config.brapiToken).then((c) => ok(a, c.preco, c.data)).catch((x) => { status[a.id] = motivo(x); }))),
    anterior ? cdi(anterior.data, data).catch(() => null) : null,
  ]);
  return { precos, status, fatorCdi: fator };
}

export function Fechar() {
  const e = useEstado();
  const r = useMemo(() => calcularResumo(e), [e]);
  const pedido = useParams().get('m');
  const fechados = useMemo(() => new Set(e.fechamentos.map((f) => f.id)), [e.fechamentos]);
  const [ref, setRef] = useState(() => (pedido && /^\d{4}-\d{2}$/.test(pedido) ? pedido : null) ?? r.pendentes[0] ?? (r.ultimo && mesesEntre(r.ultimo.id, mesAtual()) <= 1 ? mesAtual() : somarMeses(mesAtual(), -1)));
  const [data, setData] = useState(() => e.fechamentos.find((f) => f.id === ref)?.data ?? dataPadrao(ref));
  const [precos, setPrecos] = useState<Textos>({});
  const [status, setStatus] = useState<Textos>({});
  const [extratos, setExtratos] = useState<Textos>({});
  const [banco, setBanco] = useState<Textos>({});
  const [obs, setObs] = useState('');
  const [fatorCdi, setFatorCdi] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function buscar(novoRef = ref, novaData = data) {
    setBuscando(true);
    const b = await buscarCotacoes(e, novoRef, novaData);
    setPrecos((p) => ({ ...p, ...b.precos })); setStatus(b.status); setFatorCdi(b.fatorCdi);
    setBuscando(false);
    const falhas = Object.values(b.status).filter((s) => s !== 'ok' && !s.startsWith('cotação de')).length;
    if (falhas) toast.warning(`${falhas} cotaç${falhas > 1 ? 'ões' : 'ão'} não ${falhas > 1 ? 'vieram' : 'veio'}. Digite à mão.`);
  }

  /** Troca de mês: recomeça, ou carrega o fechamento existente para revisar. */
  function abrirMes(novoRef: string) {
    const ex = e.fechamentos.find((f) => f.id === novoRef);
    const d = ex?.data ?? dataPadrao(novoRef);
    setRef(novoRef); setData(d); setStatus({}); setFatorCdi(null);
    const comValor = (pred: (id: string) => boolean, campo: 'p' | 'v', casas: number) =>
      ex ? Object.fromEntries(Object.entries(ex.posicoes).filter(([id, p]) => p[campo] != null && pred(id)).map(([id, p]) => [id, paraCampo(p[campo]!, casas)])) : {};
    setPrecos(comValor(() => true, 'p', 6));
    setExtratos(comValor((id) => e.ativos.find((a) => a.id === id)?.classe === 'cdb', 'v', 2));
    setBanco(ex ? Object.fromEntries(Object.entries(ex.banco).map(([c, v]) => [c, paraCampo(v!, 2)])) : {});
    setObs(ex?.obs ?? '');
    if (!ex) void buscar(novoRef, d);
  }
  // Só na primeira abertura da tela; depois, abrirMes é chamado pela troca de mês.
  useEffect(() => { abrirMes(ref); }, []);

  const m = useMemo(() => montarFechamento(e, {
    ref, data, precos: lerTodos(precos), extratos: lerTodos(extratos), fatorCdi, obs,
    banco: Object.fromEntries(Object.entries(lerTodos(banco)).filter(([, v]) => v != null)) as Partial<Record<ClasseId, number>>,
  }), [e, ref, data, precos, extratos, banco, fatorCdi, obs]);
  const { existente, anterior, qtd } = m;

  // Aviso ao sair da página com valores digitados e ainda não confirmados.
  const sujo = Object.values(banco).some(Boolean) || Object.values(extratos).some(Boolean) || !!obs;
  useEffect(() => {
    if (!sujo || existente) return;
    const f = (ev: BeforeUnloadEvent) => { ev.preventDefault(); };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sujo, existente]);

  async function confirmar() {
    try {
      const { backupNaNuvem } = await salvarFechamento(m.fechamento);
      toast.success(`${mesExtenso(ref)} fechado.`, { action: { label: 'Ver o mês', onClick: () => ir('mes', { m: ref }) } });
      if (!backupNaNuvem) toast.warning('O histórico ficou grande para a cópia automática na nuvem. Baixe um backup em Ajustes.');
      ir('inicio');
    } catch { toast.error('Não foi possível salvar o fechamento. Tente de novo.'); }
  }

  const ativos = e.ativos.filter((a) => !a.arquivado);
  const naClasse = (c: ClasseId) => ativos.filter((a) => a.classe === c && (!ehCotada(a) || qtd[a.id] > 0 || precos[a.id]));

  /* Estado de cada classe, em palavras. A conferência é pelo total que o banco mostra para a classe. */
  function estadoDe(c: ClasseId): { tipo: 'falta' | 'aviso' | 'dif' | 'ok' | 'calc' | 'vazio'; texto: string } {
    const b = lerNumero(banco[c] ?? ''), calc = m.calculado[c];
    const faltam = m.semPreco[c].length + m.semValor.filter((a) => a.classe === c).length;
    if (b != null) return Math.abs(b - calc) >= 0.01 && !m.repetidas.has(c) && !faltam
      ? { tipo: 'dif', texto: `vale o banco · diferença ${comSinal(r2(b - calc))}` } : { tipo: 'ok', texto: 'conferido com o banco' };
    if (faltam) return { tipo: 'falta', texto: `falta${faltam > 1 ? 'm' : ''} ${faltam} valor${faltam > 1 ? 'es' : ''}: digite o total do banco ou abra os detalhes` };
    if (m.repetidas.has(c)) return { tipo: 'aviso', texto: 'repete o mês anterior; digite o total do banco' };
    if (!naClasse(c).length && !calc) return { tipo: 'vazio', texto: 'sem investimentos' };
    const ant = m.anteriorPorClasse?.[c];
    if (ant && calc && Math.abs(calc / ant - 1) > 0.3) return { tipo: 'calc', texto: `calculado · mudou ${pct(calc / ant - 1, 0, true)} desde o mês anterior, confira` };
    return { tipo: 'calc', texto: 'calculado; confira com o banco' };
  }
  const estados = Object.fromEntries(CLASSES.map((c) => [c.id, estadoDe(c.id)])) as Record<ClasseId, ReturnType<typeof estadoDe>>;
  const conferidas = CLASSES.filter((c) => estados[c.id].tipo === 'ok' || estados[c.id].tipo === 'dif').length;
  const ativasN = CLASSES.filter((c) => estados[c.id].tipo !== 'vazio').length;

  // Detalhes recolhidos: só abrem quando alguém quer ver item por item.
  const [abertas, setAbertas] = useState<Set<ClasseId>>(new Set());
  const aberta = (c: ClasseId) => abertas.has(c);
  const alternar = (c: ClasseId) => setAbertas((x) => { const n = new Set(x); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const [substituir, setSubstituir] = useState(false);
  const pedirConfirmacao = () => (existente ? setSubstituir(true) : void confirmar());
  const bloqueio = m.incompletas.length > 0
    ? `Falta o valor de ${m.incompletas.map((c) => CLASSES.find((x) => x.id === c)!.nome).join(', ')}.` : null;
  const botao = (
    <Button variant="agora" disabled={!!bloqueio} onClick={pedirConfirmacao}>
      {existente ? `Substituir o fechamento de ${mesExtenso(ref, false)}` : `Confirmar ${mesExtenso(ref, false)}`}
    </Button>
  );

  return (
    <Tela titulo={`Fechar ${mesExtenso(ref, false)}`}>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <EscolhaMes rotulo="Mês" valor={ref} onChange={(v) => { abrirMes(v); trocarParams('fechar', { m: v }); }} className="w-56"
          fechados={fechados} pendentes={r.pendentes} maximo={mesAtual()} />
        <CampoTexto rotulo="Data das cotações" tipo="date" valor={data} onChange={(v) => { if (!v) return; setData(v); void buscar(ref, v); }} className="w-48" />
        <Button variant="texto" size="texto" disabled={buscando} onClick={() => void buscar()}>{buscando ? 'Buscando cotações…' : 'Buscar cotações de novo'}</Button>
      </div>
      {existente && (
        <p className="mt-3 max-w-2xl">Você está <b>revisando</b> {mesExtenso(ref, false)}, que já foi fechado{existente.importado ? ' (importado da planilha)' : ''}. Nada muda até confirmar a substituição.</p>
      )}
      {!e.config.brapiToken && <p className="mt-2 text-sm text-rotulo">Sem o token do brapi, as ações não têm cotação automática: digite o total do banco ou <a href="#/ajustes" className="underline underline-offset-4">cadastre o token em Ajustes</a>.</p>}

      {/* O resultado, de cara, com o botão sempre à mão. */}
      <section aria-label="Resultado do fechamento" className="pausa flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p className="rotulo">{bloqueio ? `Parcial, sem ${m.incompletas.map((c) => CLASSES.find((x) => x.id === c)!.nome).join(', ')}` : `Patrimônio em ${dataBr(data)}`}</p>
          <p className={cn('chegada', bloqueio && 'text-rotulo')}>{brl(m.total)}</p>
          {!bloqueio && m.totalAnterior != null && <p className="mt-2">Variação <b>{comSinal(m.total - m.totalAnterior)}</b> {pct((m.total - m.totalAnterior) / m.totalAnterior, 2, true)} <span className="text-rotulo">desde {mesExtenso(anterior!.id, false)}</span></p>}
        </div>
        <div className="grid justify-items-start gap-2 sm:justify-items-end sm:text-right">
          <p className="text-[15px]">{conferidas} de {ativasN} classes conferidas com o banco</p>
          {botao}
          <p className={cn('text-sm', bloqueio ? 'text-erro' : 'text-rotulo')} role={bloqueio ? 'alert' : undefined}>{bloqueio ?? 'Classes sem total do banco ficam com o valor calculado.'}</p>
        </div>
      </section>

      <section aria-labelledby="f-classes" className="pausa">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6">
          <h2 id="f-classes" className="rotulo">Conferência por classe</h2>
          <p className="text-sm text-rotulo">Digite o total que o banco ou a corretora mostra. Em branco, vale o calculado.</p>
        </div>
        <div className="rotulo mt-2 grid grid-cols-[minmax(0,1fr)_9rem_10rem] gap-x-6 text-right max-sm:hidden">
          <span className="text-left">Classe</span><span>Calculado</span><span>Total do banco (R$)</span>
        </div>
        <ul>
          {CLASSES.map((c) => {
            const est = estados[c.id];
            const itens = naClasse(c.id);
            const aberto = aberta(c.id);
            return (
              <li key={c.id} id={`f-${c.id}`} className={cn('py-2', est.tipo === 'vazio' && 'text-rotulo')}>
                <div className="grid grid-cols-[minmax(0,1fr)_9rem_10rem] items-end gap-x-6 max-sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <div className="max-sm:col-span-2">
                    <p className="text-[19px]">{c.nome}
                      {itens.length > 0 && <button type="button" aria-expanded={aberto} aria-controls={`f-${c.id}-d`} onClick={() => alternar(c.id)}
                        className="ml-3 min-h-10 text-sm text-rotulo underline decoration-traco underline-offset-4 hover:text-dado">{aberto ? 'esconder' : `${itens.length} ${itens.length > 1 ? 'itens' : 'item'}`}</button>}
                    </p>
                    <p className={cn('text-sm', est.tipo === 'falta' ? 'text-erro' : 'text-rotulo')}>{est.texto}</p>
                  </div>
                  <p className="text-right">{m.semPreco[c.id].length || m.semValor.some((a) => a.classe === c.id) ? <span className="text-rotulo">incompleto</span> : brl(m.calculado[c.id])}</p>
                  {est.tipo === 'vazio' && !banco[c.id] ? <span /> : (
                    <Input aria-label={`Total do banco para ${c.nome} (R$)`} inputMode="decimal" value={banco[c.id] ?? ''} placeholder="do extrato"
                      onChange={(x) => setBanco({ ...banco, [c.id]: x.target.value })} className="text-right placeholder:text-rotulo/50" aria-invalid={lerNumero(banco[c.id] ?? '') === null && !!banco[c.id]?.trim() || undefined} />
                  )}
                </div>

                {aberto && (
                  <div id={`f-${c.id}-d`} className="mt-2 mb-3 grid gap-x-12 gap-y-1 border-l border-traco pl-4 sm:ml-2 xl:grid-cols-2">
                    {itens.map((a) => {
                      if (ehCotada(a)) {
                        const p = lerNumero(precos[a.id] ?? ''), ant = anterior?.posicoes[a.id]?.q, st = status[a.id];
                        return (
                          <div key={a.id} className="grid grid-cols-[minmax(5rem,1fr)_auto_7.5rem_7.5rem] items-baseline gap-x-3 text-[15px]">
                            <span>{rotuloAtivo(a)}{reservado(a.id, e.reservas) > 0 && <span className="ml-1 text-[13px] text-rotulo">sem a reserva</span>}</span>
                            <span className="text-right text-rotulo">{num(qtd[a.id])}{ant != null && ant !== qtd[a.id] ? ` (${qtd[a.id] - ant > 0 ? '+' : ''}${num(+(qtd[a.id] - ant).toFixed(8))})` : ''}</span>
                            <Input aria-label={`Preço de ${rotuloAtivo(a)}`} inputMode="decimal" value={precos[a.id] ?? ''} placeholder="preço" onChange={(x) => setPrecos({ ...precos, [a.id]: x.target.value })} className="min-h-9 py-1 text-right" />
                            <span className="text-right">{p != null ? brl(r2(qtd[a.id] * p)) : <span className={st && st !== 'ok' && !st.startsWith('cotação de') ? 'text-erro' : 'text-rotulo'}>{st && st !== 'ok' ? st : 'sem preço'}</span>}</span>
                          </div>
                        );
                      }
                      if (a.classe === 'cdb') {
                        const est2 = m.estimativas[a.id];
                        return (
                          <div key={a.id} className="grid grid-cols-[minmax(5rem,1fr)_7.5rem_7.5rem] items-baseline gap-x-3 text-[15px]">
                            <span>{a.nome}<span className="ml-2 text-[13px] text-rotulo">{a.cdb?.banco ?? ''}</span></span>
                            <span className="text-right text-rotulo" title="Estimado pelo CDI ou pela taxa">{est2 != null ? `≈ ${brl(est2)}` : 'sem estimativa'}</span>
                            <Input aria-label={`Extrato de ${a.nome} (R$)`} inputMode="decimal" value={extratos[a.id] ?? ''} placeholder="extrato" onChange={(x) => setExtratos({ ...extratos, [a.id]: x.target.value })} className="min-h-9 py-1 text-right" />
                          </div>
                        );
                      }
                      const v = m.fechamento.posicoes[a.id]?.v;
                      return (
                        <div key={a.id} className="grid grid-cols-[minmax(5rem,1fr)_auto] items-baseline gap-x-3 text-[15px]">
                          <span>{a.nome}{a.agregado && <span className="ml-2 text-[13px] text-rotulo">sem detalhe por ativo</span>}</span>
                          <span className="text-right">{v != null ? brl(v) : '—'}</span>
                        </div>
                      );
                    })}
                    {c.id === 'cdb' && <p className="text-sm text-rotulo xl:col-span-2">A estimativa corrige o mês anterior pelo CDI{fatorCdi ? ` (${pct(fatorCdi - 1, 2)} no período)` : ''} ou pela taxa prefixada. O extrato de cada CDB é opcional quando o total do banco é digitado.</p>}
                    {c.id === 'caixa' && <p className="text-sm text-rotulo xl:col-span-2">O caixa é o do mês anterior mais as entradas e menos as saídas lançadas.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="painel pausa">
        <section aria-labelledby="f-mov">
          <h2 id="f-mov" className="rotulo mb-1">Movimentos do mês</h2>
          <Linha rotulo="Aportes" valor={brl(m.fechamento.aporte)} />
          <Linha rotulo="Retiradas" valor={brl(m.fechamento.retirada)} />
          <Linha rotulo="Dividendos" valor={brl(m.fechamento.dividendos)} />
          <p className="mt-1 text-sm text-rotulo">Vêm dos lançamentos. Faltou algo? <a href="#/lancar" className="text-dado underline underline-offset-4">Lance</a> e volte: a folha se atualiza sozinha.</p>
        </section>
        <section aria-label="Observação e confirmação" className="grid content-start gap-4">
          <CampoTexto rotulo="Observação do mês (opcional)" valor={obs} onChange={setObs} />
          <div>{botao}</div>
        </section>
      </div>

      <AlertDialog open={substituir} onOpenChange={setSubstituir}>
        <AlertDialogContent>
          <AlertDialogTitle className="marco text-xl font-normal italic">Substituir o fechamento de {mesExtenso(ref, false)}?</AlertDialogTitle>
          <AlertDialogDescription className="text-dado">O fechamento guardado{existente?.importado ? ', importado da planilha,' : ''} dá lugar a este, de {brl(m.total)}. A versão atual fica guardada na cópia de segurança deste fechamento.</AlertDialogDescription>
          <AlertDialogFooter className="flex-row gap-6">
            <AlertDialogCancel asChild><Button variant="texto" size="texto">Manter o atual</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button variant="agora" onClick={() => void confirmar()}>Substituir</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tela>
  );
}
