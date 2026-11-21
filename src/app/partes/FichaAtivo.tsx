import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { classe as classeDe } from '@/domain/classes';
import { ehCotada, ordenarFechamentos, posicao, qtdLiquida, r2, somar } from '@/domain/carteira';
import type { Ativo, Estado } from '@/domain/tipos';
import { brl, comSinal, dataBr, mesCurto, num, pct, usd } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { href, type Params, type Tela } from '../rota';
import { descreverCdb, nomeCompleto, rotuloAtivo } from '../textos';
import { Linha } from './Degrau';
import { Para } from './Para';

const NOME_TIPO: Record<string, string> = { aporte: 'Aporte', compra: 'Compra', venda: 'Venda', resgate: 'Resgate', transferencia: 'Transferência', retirada: 'Retirada' };

/* Ficha de um ativo: o ponto de encontro dos módulos. Daqui se lança, se vê o gráfico, o mês e se edita o cadastro. */
export function FichaAtivo({ ativo: a, estado: e, onFechar, onEditar }: { ativo: Ativo; estado: Estado; onFechar: () => void; onEditar: () => void }) {
  const cotada = ehCotada(a);
  const c = classeDe(a.classe);
  const dados = useMemo(() => {
    const fs = ordenarFechamentos(e.fechamentos).filter((f) => f.posicoes[a.id]);
    const ult = fs[fs.length - 1];
    const p = posicao(a, e.lancamentos);
    const q = qtdLiquida(p.q, a.id, e.reservas);
    const cot = ult?.posicoes[a.id]?.p ?? null;
    const valor = cotada && cot != null ? r2(q * cot) : ult?.posicoes[a.id]?.v ?? null;
    const lancs = e.lancamentos.filter((l) => l.ativoId === a.id || l.contraparteId === a.id).sort((x, y) => y.data.localeCompare(x.data) || y.criadoEm - x.criadoEm);
    const divs = e.dividendos.filter((d) => d.ativoId === a.id).sort((x, y) => y.data.localeCompare(x.data));
    return { fs: fs.slice(-6), ult, p, q, cot, valor, resultado: valor != null && p.custo != null && cotada ? r2(valor - p.custo) : null, lancs, divs, totalDiv: somar(divs.map((d) => d.valor)) };
  }, [a, e, cotada]);
  const nomeDe = (id?: string) => { const x = e.ativos.find((y) => y.id === id); return x ? rotuloAtivo(x) : '—'; };

  // O que se pode fazer com este ativo, cada ação levando ao módulo certo já preenchido.
  const acoes: { rotulo: string; tela: Tela; params: Params }[] = [
    ...(cotada ? [{ rotulo: 'Comprar', tela: 'lancar' as Tela, params: { tipo: 'aporte', ativo: a.id } }, { rotulo: 'Vender', tela: 'lancar' as Tela, params: { tipo: 'venda', ativo: a.id } }]
      : a.classe === 'cdb' ? [{ rotulo: 'Aplicar', tela: 'lancar' as Tela, params: { tipo: 'aporte', ativo: a.id } }, { rotulo: 'Resgatar', tela: 'lancar' as Tela, params: { tipo: 'resgate', ativo: a.id } }]
      : [{ rotulo: 'Aporte', tela: 'lancar' as Tela, params: { tipo: 'aporte', ativo: a.id } }, { rotulo: 'Retirada', tela: 'lancar' as Tela, params: { tipo: 'retirada', ativo: a.id } }]),
    ...(['acoes', 'fii', 'etf_bdr'].includes(a.classe) ? [{ rotulo: 'Dividendo', tela: 'lancar' as Tela, params: { tipo: 'dividendo', ativo: a.id } }] : []),
    ...(cotada ? [{ rotulo: 'Gráfico', tela: 'analises' as Tela, params: { v: 'ativo', ativo: a.id } }] : []),
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="top-0 right-0 left-auto h-dvh max-h-dvh w-full max-w-[min(34rem,100%)] translate-x-0 translate-y-0 content-start overflow-y-auto sm:max-w-[34rem]">
        <div>
          <p className="rotulo">{c.nome}{a.corretora ? ` · ${a.corretora}` : ''}{a.arquivado ? ' · arquivado' : ''}</p>
          <DialogTitle className="marco mt-1 text-[clamp(28px,4vw,40px)] font-light italic leading-tight">{rotuloAtivo(a)}</DialogTitle>
          <DialogDescription className="text-[15px] text-rotulo">{a.classe === 'cdb' ? descreverCdb(a) || 'Sem banco, taxa e vencimento.' : nomeCompleto(a) !== rotuloAtivo(a) ? a.nome : ' '}</DialogDescription>
        </div>

        <nav aria-label="Ações deste ativo" className="flex flex-wrap gap-x-5 gap-y-1">
          {acoes.map((x) => (
            <a key={x.rotulo} href={href(x.tela, x.params)} onClick={onFechar}
               className="min-h-11 content-center text-[15px] text-dado underline decoration-traco underline-offset-[6px] hover:decoration-dado">{x.rotulo}</a>
          ))}
          <Button variant="texto" size="texto" onClick={onEditar}>Editar cadastro</Button>
        </nav>

        <section aria-label="Posição">
          {cotada && <Linha rotulo="Quantidade" valor={a.classe === 'dolar' ? usd(dados.q) : num(dados.q)} />}
          {cotada && <Linha rotulo="Preço médio" valor={dados.p.pm != null ? brl(dados.p.pm) : <span className="text-rotulo">informar em Editar</span>} />}
          {cotada && <Linha rotulo={`Cotação${dados.ult ? ` em ${mesCurto(dados.ult.id)}` : ''}`} valor={dados.cot != null ? brl(dados.cot) : '—'} />}
          {a.classe === 'cdb' && a.cdb?.aplicado != null && <Linha rotulo="Aplicado" valor={brl(a.cdb.aplicado)} />}
          <Linha rotulo="Valor" valor={<b>{dados.valor != null ? brl(dados.valor) : '—'}</b>} />
          {dados.resultado != null && <Linha rotulo="Resultado" valor={<>{comSinal(dados.resultado)}{dados.p.custo ? <span className="ml-2 text-rotulo">{pct(dados.resultado / dados.p.custo, 1, true)}</span> : null}</>} />}
          {dados.totalDiv > 0 && <Linha rotulo="Dividendos recebidos" valor={brl(dados.totalDiv)} />}
        </section>

        {dados.fs.length > 0 && (
          <section aria-labelledby="f-meses">
            <h3 id="f-meses" className="rotulo mb-1">Nos últimos fechamentos</h3>
            <table className="w-full text-[15px]">
              <tbody>{dados.fs.map((f, i) => {
                const p = f.posicoes[a.id];
                const qAnt = i > 0 ? dados.fs[i - 1].posicoes[a.id]?.q : undefined;
                const dq = p.q != null && qAnt != null ? +(p.q - qAnt).toFixed(8) : 0;
                return (
                  <tr key={f.id}>
                    <td className="py-0.5"><Para tela="mes" params={{ m: f.id, ver: `a-${a.id}` }} onClick={onFechar} discreto>{mesCurto(f.id)}</Para></td>
                    {cotada && <td className="text-right">{p.q != null ? num(p.q) : '—'}{dq ? <span className="ml-2 text-sm text-rotulo">{dq > 0 ? '+' : '−'}{num(Math.abs(dq))}</span> : null}</td>}
                    <td className="text-right">{p.v != null ? brl(p.v) : '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </section>
        )}

        <section aria-labelledby="f-lanc">
          <h3 id="f-lanc" className="rotulo mb-1">Lançamentos</h3>
          {dados.lancs.length === 0 ? <p className="text-rotulo">Nenhum lançamento ainda.</p> : (
            <ul className="grid gap-0.5 text-[15px]">
              {dados.lancs.slice(0, 8).map((l) => {
                const outro = l.ativoId === a.id ? l.contraparteId : l.ativoId;
                return (
                  <li key={l.id} className="grid grid-cols-[5.5rem_1fr_auto] gap-x-3">
                    <span className="text-rotulo">{dataBr(l.data)}</span>
                    <span>{NOME_TIPO[l.tipo]}{l.quantidade ? ` · ${num(l.quantidade)}` : ''}{outro ? <span className="text-rotulo"> {l.ativoId === a.id ? '·' : 'de'} {nomeDe(outro)}</span> : null}</span>
                    <span className={cn('text-right', l.ativoId !== a.id && 'text-rotulo')}>{brl(l.valor)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {dados.lancs.length > 8 && <p className="mt-1 text-sm text-rotulo">e mais {dados.lancs.length - 8} anteriores.</p>}
        </section>

        {dados.divs.length > 0 && (
          <section aria-labelledby="f-div">
            <h3 id="f-div" className="rotulo mb-1">Últimos dividendos</h3>
            <ul className="grid gap-0.5 text-[15px]">{dados.divs.slice(0, 5).map((d) => (
              <li key={d.id} className="grid grid-cols-[5.5rem_1fr] gap-x-3"><span className="text-rotulo">{dataBr(d.data)}</span><span className="text-right">{brl(d.valor)}</span></li>
            ))}</ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
