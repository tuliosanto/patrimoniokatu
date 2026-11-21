import { useEffect, useMemo } from 'react';
import { CLASSES, GRUPOS } from '@/domain/classes';
import { composicaoPorMes } from '@/domain/analise';
import { ehCotada } from '@/domain/carteira';
import { brl, comSinal, dataBr, mesExtenso, num, pct, usd } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Degrau } from '../partes/Degrau';
import { Para } from '../partes/Para';
import { Tela } from '../partes/Tela';
import { useResumo } from '../resumo';
import { href, ir, useParams } from '../rota';
import { rotuloAtivo } from '../textos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const NOME_TIPO: Record<string, string> = { aporte: 'Aporte', compra: 'Compra', venda: 'Venda', resgate: 'Resgate', transferencia: 'Transferência', retirada: 'Retirada' };
const delta = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.005 ? <span className="text-rotulo">—</span> : comSinal(v));

/* Como na planilha, uma "aba" por mês: escolhe o ano e o mês, ou anda com ← e →. */
export function MesAMes() {
  const r = useResumo();
  const e = r.estado;
  const pedido = useParams().get('m');
  const ids = useMemo(() => r.linhas.map((l) => l.mes.id), [r.linhas]);
  const m = pedido && ids.includes(pedido) ? pedido : ids[ids.length - 1];
  const i = ids.indexOf(m);
  const ant = i > 0 ? ids[i - 1] : null, prox = i < ids.length - 1 ? ids[i + 1] : null;
  const comp = useMemo(() => composicaoPorMes(e.fechamentos, e.ativos), [e.fechamentos, e.ativos]);

  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement;
      if (ev.altKey || ev.metaKey || ev.ctrlKey || /input|select|textarea/i.test(alvo.tagName) || document.querySelector('[role=dialog]')) return;
      if (ev.key === 'ArrowLeft' && ant) { ev.preventDefault(); ir('mes', { m: ant }); }
      if (ev.key === 'ArrowRight' && prox) { ev.preventDefault(); ir('mes', { m: prox }); }
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [ant, prox]);

  if (!m) return <Tela titulo="Mês a mês"><Degrau nivel={0}><p>Ainda não há fechamentos. Feche um mês ou importe o histórico em Ajustes.</p></Degrau></Tela>;

  const linha = r.linhas[i];
  const f = r.fechamentos.find((x) => x.id === m)!;
  const c = comp.get(m)!, cAnt = ant ? comp.get(ant)! : null;
  const fAnt = ant ? r.fechamentos.find((x) => x.id === ant) : undefined;
  const ehUltimo = i === ids.length - 1;
  const ano = m.slice(0, 4);
  const anos = [...new Set(ids.map((x) => x.slice(0, 4)))];
  const total = linha.total;

  // Ativos com posição neste fechamento, por classe e valor.
  const ordem = (id: string) => CLASSES.findIndex((x) => x.id === id);
  const ativos = e.ativos
    .filter((a) => f.posicoes[a.id] && (f.posicoes[a.id].v || f.posicoes[a.id].q))
    .sort((a, b) => ordem(a.classe) - ordem(b.classe) || (f.posicoes[b.id].v ?? 0) - (f.posicoes[a.id].v ?? 0));
  const doMes = (d: string) => d.slice(0, 7) === m;
  const lancs = e.lancamentos.filter((l) => doMes(l.data)).sort((a, b) => a.data.localeCompare(b.data));
  const divs = e.dividendos.filter((d) => doMes(d.data)).sort((a, b) => a.data.localeCompare(b.data));
  const nome = (id?: string) => { const a = e.ativos.find((x) => x.id === id); return a ? rotuloAtivo(a) : '—'; };

  return (
    <Tela titulo="Mês a mês" acao={
      <span className="flex gap-x-6 text-[15px]">
        {ant ? <a href={href('mes', { m: ant })} className="min-h-11 content-center text-dado underline decoration-traco underline-offset-[6px] hover:decoration-dado" aria-keyshortcuts="ArrowLeft">← {MESES[+ant.slice(5) - 1]}/{ant.slice(2, 4)}</a> : <span />}
        {prox && <a href={href('mes', { m: prox })} className="min-h-11 content-center text-dado underline decoration-traco underline-offset-[6px] hover:decoration-dado" aria-keyshortcuts="ArrowRight">{MESES[+prox.slice(5) - 1]}/{prox.slice(2, 4)} →</a>}
      </span>}>

      {/* As abas: ano e mês, só em palavras. Meses sem fechamento ficam apagados. */}
      <nav aria-label="Escolher o mês" className="mt-3 grid gap-1">
        <div className="flex flex-wrap gap-x-5">
          {anos.map((a) => {
            const alvo = ids.filter((x) => x.startsWith(a)).find((x) => x.slice(5) === m.slice(5)) ?? ids.filter((x) => x.startsWith(a)).pop()!;
            return <a key={a} href={href('mes', { m: alvo })} aria-current={a === ano ? 'true' : undefined}
                      className={cn('min-h-10 content-center text-[17px] no-underline', a === ano ? 'font-semibold text-dado underline decoration-2 underline-offset-8' : 'text-rotulo hover:text-dado')}>{a}</a>;
          })}
        </div>
        <div className="flex flex-wrap gap-x-4">
          {MESES.map((nomeMes, k) => {
            const id = `${ano}-${String(k + 1).padStart(2, '0')}`;
            const existe = ids.includes(id);
            return existe
              ? <a key={id} href={href('mes', { m: id })} aria-current={id === m ? 'page' : undefined}
                   className={cn('min-h-10 min-w-8 content-center text-[15px] no-underline', id === m ? cn('font-semibold underline decoration-2 underline-offset-8', ehUltimo ? 'text-agora' : 'text-dado') : 'text-dado/80 hover:text-dado')}>{nomeMes}</a>
              : <span key={id} className="min-h-10 min-w-8 content-center text-[15px] text-rotulo/50" aria-hidden="true">{nomeMes}</span>;
          })}
        </div>
      </nav>

      <section aria-label={`Resumo de ${mesExtenso(m, false)}`} className="pausa flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <div>
          <h2 className="marco text-[clamp(22px,2.4vw,30px)] font-light italic">{mesExtenso(m)}</h2>
          <p className={cn('marco text-[clamp(34px,4.6vw,60px)] font-bold leading-none tracking-[-0.03em]', ehUltimo && 'agora')}>{brl(total)}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-6 text-[15px] sm:grid-cols-[auto_auto_auto_auto]">
          <dt className="text-rotulo">Variação</dt><dd className="text-right">{delta(linha.varMes)}{linha.varMes != null && fAnt && <span className="ml-2 text-rotulo">{pct(linha.varMes / r.linhas[i - 1].total, 2, true)}</span>}</dd>
          <dt className="text-rotulo">Rendimento</dt><dd className="text-right">{delta(linha.rend)}{linha.retorno != null && <span className="ml-2 text-rotulo">{pct(linha.retorno, 2, true)}</span>}</dd>
          <dt className="text-rotulo">Aporte</dt><dd className="text-right">{brl(f.aporte ?? 0)}</dd>
          <dt className="text-rotulo">Retirada</dt><dd className="text-right">{brl(f.retirada ?? 0)}</dd>
          <dt className="text-rotulo">Dividendos</dt><dd className="text-right">{brl(f.dividendos ?? 0)}</dd>
          <dt className="text-rotulo">Aportado até aqui</dt><dd className="text-right">{brl(linha.aportado)}</dd>
        </dl>
      </section>
      <p className="mt-2 text-sm text-rotulo">
        {f.importado ? 'Importado da planilha' : `Fechado em ${dataBr(f.data)}${f.confirmadoPor ? ` por ${f.confirmadoPor}` : ''}`}
        {f.obs ? ` · ${f.obs}` : ''} · <Para tela="analises" params={{ v: 'patrimonio', m }}>ver na linha do tempo</Para> · <Para tela="fechar" params={{ m }}>refazer este fechamento</Para>
      </p>

      <div className="painel pausa">
        <Degrau nivel={0} titulo={`Por classe${ant ? `, comparado a ${MESES[+ant.slice(5) - 1]}/${ant.slice(2, 4)}` : ''}`} id="classes">
          <table className="w-full text-[15px]">
            <thead className="rotulo text-right"><tr><th className="text-left font-medium">Classe</th><th className="font-medium">Valor</th><th className="font-medium">No mês</th><th className="font-medium">%</th></tr></thead>
            <tbody>
              {CLASSES.map((x) => (
                <tr key={x.id}>
                  <td className="py-0.5"><Para tela="carteira" params={{ classe: x.id }} discreto>{x.nome}</Para></td>
                  <td className="text-right">{brl(c.classes[x.id])}</td>
                  <td className="text-right">{cAnt ? delta(c.classes[x.id] - cAnt.classes[x.id]) : '—'}</td>
                  <td className="text-right text-rotulo">{total ? pct(c.classes[x.id] / total) : '—'}</td>
                </tr>
              ))}
              <tr className="font-bold"><td className="pt-2">Total</td><td className="pt-2 text-right">{brl(total)}</td><td className="pt-2 text-right">{delta(linha.varMes)}</td><td /></tr>
            </tbody>
          </table>
        </Degrau>

        <Degrau nivel={0} titulo="Por grupo" id="grupos">
          {GRUPOS.map((g) => (
            <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 py-0.5 text-[15px]">
              <span>{g.nome}</span>
              <span className="text-right">{brl(c.grupos[g.id])}</span>
              <span className="w-[4.5ch] text-right text-rotulo">{total ? pct(c.grupos[g.id] / total) : ''}</span>
            </div>
          ))}
        </Degrau>

        <Degrau nivel={0} id="lancs">
          <h2 className="rotulo mb-2 flex flex-wrap justify-between gap-x-4 font-medium"><span>Lançamentos do mês</span>
            {ehUltimo && <Para tela="lancar" className="text-[13px]">lançar</Para>}</h2>
          {lancs.length === 0 ? <p className="text-rotulo">{f.importado ? 'A planilha guardava só o aporte total.' : 'Nenhum lançamento.'}</p> : (
            <ul className="grid gap-0.5 text-[15px]">
              {lancs.map((l) => (
                <li key={l.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-3">
                  <span className="text-rotulo">{l.data.slice(8, 10)}/{l.data.slice(5, 7)}</span>
                  <span>{NOME_TIPO[l.tipo]} · <Para tela="carteira" params={{ ativo: l.ativoId }} discreto>{nome(l.ativoId)}</Para>{l.quantidade ? <span className="text-rotulo"> · {num(l.quantidade)}</span> : null}</span>
                  <span className="text-right">{brl(l.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          <div id="divs" className="mt-4">
            <h3 className="rotulo mb-1">Dividendos do mês</h3>
            {divs.length === 0 ? <p className="text-rotulo">{f.dividendos ? `Só o total da planilha: ${brl(f.dividendos)}.` : 'Nenhum.'}</p> : (
              <ul className="grid gap-0.5 text-[15px]">
                {divs.map((d) => (
                  <li key={d.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-3">
                    <span className="text-rotulo">{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</span>
                    <span>{d.ativoId ? <Para tela="carteira" params={{ ativo: d.ativoId }} discreto>{nome(d.ativoId)}</Para> : d.obs ?? 'sem ativo'}</span>
                    <span className="text-right">{brl(d.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Degrau>
        <Degrau nivel={0} titulo="Ativos neste fechamento" id="ativos" className="col-span-full">
          {ativos.length === 0 ? <p className="text-rotulo">A planilha guardava só o total das classes neste mês.</p> : (
            <div className="colunas">
              {CLASSES.map((x) => {
                const xs = ativos.filter((a) => a.classe === x.id);
                if (!xs.length) return null;
                return (
                  <div key={x.id} className="mb-5">
                    <h3 className="mb-1 flex justify-between text-[17px]"><span>{x.nome}</span><span className="text-rotulo">{brl(c.classes[x.id])}</span></h3>
                    <ul className="grid gap-0.5 text-[15px]">
                      {xs.map((a) => {
                        const p = f.posicoes[a.id], qAnt = fAnt?.posicoes[a.id]?.q;
                        const dq = p.q != null && qAnt != null ? +(p.q - qAnt).toFixed(8) : p.q != null && fAnt ? p.q : 0;
                        return (
                          <li key={a.id} id={`a-${a.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_7.5rem] items-baseline gap-x-3">
                            <Para tela="carteira" params={{ ativo: a.id }} discreto className="truncate">{rotuloAtivo(a)}</Para>
                            <span className="text-right">{ehCotada(a) && p.q != null ? <>{a.classe === 'dolar' ? usd(p.q) : num(p.q)}{dq ? <span className="ml-1 text-[13px] text-rotulo">{dq > 0 ? '+' : '−'}{num(Math.abs(dq))}</span> : null}</> : ''}</span>
                            <span className="text-right">{p.v != null ? brl(p.v) : ''}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {ativos.some((a) => ehCotada(a) && f.posicoes[a.id].v == null) && <p className="text-sm text-rotulo">Nos meses importados, a planilha não guardava o valor de cada ação; só a quantidade e o total da classe.</p>}
        </Degrau>
      </div>
    </Tela>
  );
}
