import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CLASSES, GRUPOS, classe as classeDe } from '@/domain/classes';
import { ehCotada, posicoesAte, qtdLiquida, r2 } from '@/domain/carteira';
import type { Ativo, ClasseId, Reserva } from '@/domain/tipos';
import { brl, comSinal, dataBr, num, pct, usd } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { AtivoForm } from '../partes/AtivoForm';
import { FichaAtivo } from '../partes/FichaAtivo';
import { Para } from '../partes/Para';
import { ReservaForm } from '../partes/ReservaForm';
import { LinhaReserva } from '../partes/Reservas';
import { Tela } from '../partes/Tela';
import { useResumo } from '../resumo';
import { href, trocarParams, useParams } from '../rota';
import { rotuloAtivo, taxaCdb } from '../textos';

type Vista = ClasseId | 'reservas' | 'arquivados';
const ehClasse = (x: string | null): x is ClasseId => !!x && CLASSES.some((c) => c.id === x);
const LIQUIDEZ = { diaria: 'diária', vencimento: 'no vencimento' } as const;

/* Carteira em duas partes: à esquerda, as classes por grupo (o mapa); à direita, uma classe por vez (o detalhe),
   com colunas próprias para cada tipo de investimento. */
export function Carteira() {
  const r = useResumo();
  const e = r.estado;
  const params = useParams();
  const [editar, setEditar] = useState<Ativo | 'novo' | null>(null);
  const [reserva, setReserva] = useState<Reserva | 'nova' | null>(null);
  const u = r.ultimo, ant = r.anterior;
  const ficha = e.ativos.find((a) => a.id === params.get('ativo'));
  const metas = e.config.metas;

  const linhas = useMemo(() => {
    const pos = posicoesAte(e.ativos, e.lancamentos);
    return e.ativos.map((a) => {
      const bruto = pos.get(a.id)!;
      const p = { ...bruto, q: qtdLiquida(bruto.q, a.id, e.reservas) };
      const cot = u?.posicoes[a.id]?.p ?? null;
      // Sem cotação no fechamento (meses importados), vale o valor guardado nele.
      const valor = ehCotada(a) && cot != null ? r2(p.q * cot) : u?.posicoes[a.id]?.v ?? null;
      const resultado = valor != null && p.custo != null && ehCotada(a) ? r2(valor - p.custo) : null;
      const qAnt = ant?.posicoes[a.id]?.q;
      return { a, p, cot, valor, resultado, delta: qAnt != null ? +(bruto.q - qAnt).toFixed(8) : null };
    });
  }, [e.ativos, e.lancamentos, e.reservas, u, ant]);

  // Qual classe mostrar: a pedida, a do ativo aberto, ou a maior.
  const pedida = params.get('classe');
  const maior = [...CLASSES].sort((a, b) => r.porClasse[b.id] - r.porClasse[a.id])[0].id;
  const vista: Vista = pedida === 'reservas' || pedida === 'arquivados' ? pedida : ehClasse(pedida) ? pedida : ficha && !ficha.arquivado ? ficha.classe : maior;
  const linkVista = (v: Vista) => href('carteira', { classe: v });
  const arquivados = e.ativos.filter((a) => a.arquivado);

  const itemNav = (v: Vista, nome: string, valor?: string, extra?: string) => (
    <li key={v}>
      <a href={linkVista(v)} aria-current={vista === v ? 'page' : undefined}
         className={cn('grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-2 py-1.5 no-underline', vista === v ? 'bg-realce font-semibold text-dado' : 'text-dado hover:bg-realce/60')}>
        <span>{nome}{extra && <span className="ml-2 text-[13px] font-normal text-rotulo">{extra}</span>}</span>
        {valor && <span className="text-right tabular-nums">{valor}</span>}
      </a>
    </li>
  );

  return (
    <Tela titulo="Carteira" acao={<Button variant="texto" size="texto" onClick={() => setEditar('novo')}>Novo ativo</Button>}>
      {u && <p className="rotulo mt-1">Valores do fechamento de {dataBr(u.data)}; quantidades com os lançamentos até hoje.</p>}

      <div className="pausa grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* O mapa: no celular vira uma faixa de palavras que rola de lado. */}
        <nav aria-label="Classes da carteira" className="min-w-0 lg:sticky lg:top-6">
          <div className="hidden lg:block">
            {GRUPOS.map((g) => {
              const cs = CLASSES.filter((c) => c.grupo === g.id && (r.porClasse[c.id] || e.ativos.some((a) => a.classe === c.id && !a.arquivado)));
              if (!cs.length) return null;
              return (
                <div key={g.id} className="mb-4">
                  <h2 className="rotulo flex justify-between px-2"><span>{g.nome}</span><span>{brl(r.porGrupo[g.id])}</span></h2>
                  <ul>{cs.map((c) => itemNav(c.id, c.nome, brl(r.porClasse[c.id]), r.total ? pct(r.porClasse[c.id] / r.total) : undefined))}</ul>
                </div>
              );
            })}
            <p className="grid grid-cols-[1fr_auto] border-t border-traco px-2 pt-2 font-bold"><span>Total</span><span className="agora">{brl(r.total)}</span></p>
            <ul className="mt-5 text-[15px]">
              {itemNav('reservas', 'Fora do patrimônio', undefined, e.reservas.length ? String(e.reservas.length) : undefined)}
              {arquivados.length > 0 && itemNav('arquivados', 'Arquivados', undefined, String(arquivados.length))}
            </ul>
          </div>
          <ul className="-mx-[5vw] flex gap-x-5 overflow-x-auto px-[5vw] pb-1 lg:hidden">
            {[...CLASSES.filter((c) => r.porClasse[c.id] || e.ativos.some((a) => a.classe === c.id && !a.arquivado)).map((c) => ({ id: c.id as Vista, nome: c.nome })),
              { id: 'reservas' as Vista, nome: 'Fora do patrimônio' }, ...(arquivados.length ? [{ id: 'arquivados' as Vista, nome: 'Arquivados' }] : [])].map((x) => (
              <li key={x.id} className="shrink-0">
                <a href={linkVista(x.id)} aria-current={vista === x.id ? 'page' : undefined}
                   className={cn('inline-block min-h-11 content-center whitespace-nowrap text-[15px] no-underline', vista === x.id ? 'font-semibold text-dado underline decoration-2 underline-offset-8' : 'text-rotulo')}>{x.nome}</a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-live="polite" className="min-w-0 max-w-5xl">
          {vista === 'reservas' ? (
            <>
              <h2 className="marco text-[clamp(26px,3vw,36px)] font-light italic">Fora do patrimônio</h2>
              <p className="max-w-xl text-sm text-rotulo">Dinheiro guardado para um fim, que não conta no patrimônio. Se está dentro de um investimento (a conta global, por exemplo), é descontado dele.</p>
              <ul className="mt-4 grid gap-1">
                {e.reservas.map((x) => (
                  <li key={x.id}><button className="min-h-10 underline decoration-traco underline-offset-4 hover:decoration-dado" onClick={() => setReserva(x)}>{x.nome}</button><LinhaReserva r={x} dolar={r.dolar} /></li>
                ))}
              </ul>
              <Button variant="texto" size="texto" className="mt-2" onClick={() => setReserva('nova')}>Nova reserva</Button>
            </>
          ) : vista === 'arquivados' ? (
            <>
              <h2 className="marco text-[clamp(26px,3vw,36px)] font-light italic">Arquivados</h2>
              <p className="text-sm text-rotulo">Ativos que vocês não têm mais. O histórico deles continua nos meses passados.</p>
              <ul className="mt-4 colunas text-[15px]">
                {arquivados.map((a) => <li key={a.id} className="py-1"><Para tela="carteira" params={{ classe: 'arquivados', ativo: a.id }} discreto>{rotuloAtivo(a)}</Para><span className="ml-2 text-[13px] text-rotulo">{classeDe(a.classe).nome}</span></li>)}
              </ul>
            </>
          ) : <DetalheClasse c={vista} linhas={linhas.filter((l) => l.a.classe === vista && !l.a.arquivado)} total={r.total} valorClasse={r.porClasse[vista]} meta={metas[vista]} />}
        </section>
      </div>

      {ficha && !editar && <FichaAtivo ativo={ficha} estado={e} onFechar={() => trocarParams('carteira', { classe: pedida })} onEditar={() => setEditar(ficha)} />}
      {editar && <AtivoForm aberto ativo={editar === 'novo' ? undefined : editar} classeInicial={editar === 'novo' && ehClasse(vista) ? vista : undefined} onFechar={() => setEditar(null)} />}
      {reserva && <ReservaForm reserva={reserva === 'nova' ? undefined : reserva} onFechar={() => setReserva(null)} />}
    </Tela>
  );
}

type LinhaAtivo = { a: Ativo; p: { q: number; pm: number | null; custo: number | null }; cot: number | null; valor: number | null; resultado: number | null; delta: number | null };

function DetalheClasse({ c, linhas, total, valorClasse, meta }: { c: ClasseId; linhas: LinhaAtivo[]; total: number; valorClasse: number; meta?: number }) {
  const cl = classeDe(c);
  const xs = [...linhas].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));
  const cotadas = xs.filter((x) => ehCotada(x.a));
  const cdb = c === 'cdb';
  // Colunas que não têm nenhum valor na classe somem; o motivo vai para a linha "Para completar".
  const tem = { valor: xs.some((x) => x.valor != null), pm: cotadas.some((x) => x.p.pm != null), cot: cotadas.some((x) => x.cot != null), res: cotadas.some((x) => x.resultado != null),
    banco: xs.some((x) => x.a.cdb?.banco), taxa: xs.some((x) => x.a.cdb?.taxa), venc: xs.some((x) => x.a.cdb?.vencimento), liq: xs.some((x) => x.a.cdb?.liquidez) };
  const pendencias = [
    cotadas.length && cotadas.some((x) => x.p.pm == null) ? `${cotadas.filter((x) => x.p.pm == null).length} sem preço médio` : null,
    cotadas.length && !tem.cot ? 'cotações a partir do próximo fechamento (a planilha guardava só o total)' : null,
    cdb && xs.some((x) => !x.a.cdb?.banco || !x.a.cdb?.taxa || !x.a.cdb?.vencimento) ? `${xs.filter((x) => !x.a.cdb?.banco || !x.a.cdb?.taxa || !x.a.cdb?.vencimento).length} sem banco, taxa ou vencimento` : null,
    xs.some((x) => x.a.agregado) ? 'guardado só como total da classe; cadastre os ativos para ver um a um' : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        <h2 className="marco text-[clamp(26px,3vw,36px)] font-light italic">{cl.nome}</h2>
        <p className="text-[19px] tabular-nums">{brl(valorClasse)}</p>
      </div>
      <p className="flex flex-wrap gap-x-5 text-sm text-rotulo">
        <span>{total ? pct(valorClasse / total) : '—'} do patrimônio{meta ? <> · <Para tela="metas" params={{ ver: 'm-aloc' }} discreto>meta {pct(meta)}</Para></> : null}</span>
        <Para tela="analises" params={{ v: 'patrimonio', classes: c, de: undefined }}>evolução</Para>
        <Para tela="lancar" params={{ tipo: 'aporte', classe: c }}>lançar</Para>
      </p>
      {pendencias.length > 0 && <p className="mt-2 text-sm"><span className="rotulo">Para completar:</span> {pendencias.join(' · ')}. Abra o ativo e use Editar cadastro.</p>}

      {xs.length === 0 ? <p className="mt-4 text-rotulo">Nenhum ativo nesta classe.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className={cn('text-[15px]', (cotadas.length && tem.valor) || (cdb && (tem.banco || tem.taxa)) ? 'w-full' : 'w-full max-w-xl')}>
            <caption className="sr-only">{cl.nome}</caption>
            <thead className="rotulo text-right">
              <tr>
                <th className="pb-1 text-left font-medium">Ativo</th>
                {cotadas.length > 0 && <th className="font-medium">Quantidade</th>}
                {cotadas.length > 0 && tem.pm && <th className="font-medium">Preço médio</th>}
                {cotadas.length > 0 && tem.cot && <th className="font-medium">Cotação</th>}
                {cdb && tem.banco && <th className="text-left font-medium">Banco</th>}
                {cdb && tem.taxa && <th className="font-medium">Taxa</th>}
                {cdb && tem.venc && <th className="font-medium">Vencimento</th>}
                {cdb && tem.liq && <th className="font-medium">Liquidez</th>}
                {tem.valor && <th className="font-medium">Valor</th>}
                {cotadas.length > 0 && tem.res && <th className="font-medium">Resultado</th>}
                {tem.valor && <th className="font-medium max-sm:hidden">% da classe</th>}
              </tr>
            </thead>
            <tbody>
              {xs.map(({ a, p, cot, valor, resultado, delta }) => (
                <tr key={a.id} className="align-baseline hover:bg-realce">
                  <td className="py-1 pr-3"><Para tela="carteira" params={{ classe: c, ativo: a.id }} className="py-2" titulo="Abrir a ficha">{rotuloAtivo(a)}</Para>
                    {a.ticker && a.nome !== a.ticker && <span className="ml-2 text-[13px] text-rotulo max-md:hidden">{a.nome}</span>}</td>
                  {cotadas.length > 0 && <td className="text-right">{ehCotada(a) ? <>{a.classe === 'dolar' ? usd(p.q) : num(p.q)}{delta ? <span className="ml-1 text-[13px] text-rotulo">{delta > 0 ? '+' : '−'}{num(Math.abs(delta))}</span> : null}</> : ''}</td>}
                  {cotadas.length > 0 && tem.pm && <td className="text-right">{p.pm != null ? brl(p.pm) : <span className="text-rotulo">—</span>}</td>}
                  {cotadas.length > 0 && tem.cot && <td className="whitespace-nowrap text-right">{cot != null ? brl(cot) : '—'}</td>}
                  {cdb && tem.banco && <td className="pl-4">{a.cdb?.banco ?? <span className="text-rotulo">—</span>}</td>}
                  {cdb && tem.taxa && <td className="text-right">{taxaCdb(a) ?? <span className="text-rotulo">—</span>}</td>}
                  {cdb && tem.venc && <td className="text-right">{a.cdb?.vencimento ? dataBr(a.cdb.vencimento) : <span className="text-rotulo">—</span>}</td>}
                  {cdb && tem.liq && <td className="text-right">{a.cdb?.liquidez ? LIQUIDEZ[a.cdb.liquidez] : <span className="text-rotulo">—</span>}</td>}
                  {tem.valor && <td className="whitespace-nowrap text-right">{valor != null ? brl(valor) : '—'}</td>}
                  {cotadas.length > 0 && tem.res && <td className="whitespace-nowrap text-right">{resultado != null ? <>{comSinal(resultado)}{p.custo ? <span className="ml-1 text-[13px] text-rotulo">{pct(resultado / p.custo, 1, true)}</span> : null}</> : '—'}</td>}
                  {tem.valor && <td className="text-right text-rotulo max-sm:hidden">{valor != null && valorClasse ? pct(valor / valorClasse) : ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
