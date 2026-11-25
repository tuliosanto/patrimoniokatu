import { Button } from '@/components/ui/button';
import { CLASSES, GRUPOS } from '@/domain/classes';
import { brl, comSinal, dataBr, mesCurto, mesExtenso, pct, usd } from '@/lib/formato';
import { LinhaReserva } from '../partes/Reservas';
import { Degrau, Linha } from '../partes/Degrau';
import { useResumo } from '../resumo';
import { ir, type Params, type Tela } from '../rota';
import { Para } from '../partes/Para';
import { Agora } from '../partes/Agora';
import { Rosca, type CorSerie } from '../partes/Rosca';
import { useMemo } from 'react';

/** Ao tocar num grupo, a Carteira abre na classe principal dele. */
const CLASSE_DO_GRUPO = { rf: 'cdb', rv: 'acoes', cri: 'cripto', ext: 'dolar' } as const;
/** Cor fixa de cada grupo (a cor segue o grupo, nunca a posição). */
const COR_DO_GRUPO: Record<keyof typeof CLASSE_DO_GRUPO, CorSerie> = { rf: '--serie-1', rv: '--serie-2', cri: '--serie-3', ext: '--serie-4' };

export function Inicio() {
  const r = useResumo();
  const { estado: e } = r;
  const fatias = useMemo(() => GRUPOS.map((g) => ({ nome: g.nome, valor: r.porGrupo?.[g.id] ?? 0, cor: COR_DO_GRUPO[g.id] })), [r.porGrupo]);

  if (!r.ultimo) {
    return (
      <Degrau nivel={1} titulo="Começar">
        <p className="max-w-md">Ainda não há fechamentos. Importe o histórico da planilha em Ajustes ou feche o primeiro mês.</p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Button variant="agora" onClick={() => ir('ajustes')}>Importar histórico</Button>
          <Button variant="texto" size="texto" onClick={() => ir('fechar')}>Fechar um mês</Button>
        </div>
      </Degrau>
    );
  }

  const total = r.total;
  const primeiroAporte = r.fechamentos.find((f) => f.aporte > 0);
  const avisos: { texto: string; tela?: Tela; params?: Params }[] = [
    ...r.pendentes.map((m) => ({ texto: `${mesExtenso(m)} ainda não foi fechado.`, tela: 'fechar' as Tela, params: { m } })),
    ...(e.config.avisos ?? []).map((texto) => ({ texto })),
    ...r.vencimentos.map((a) => ({ texto: `${a.nome}${a.cdb?.banco ? ` (${a.cdb.banco})` : ''} vence em ${dataBr(a.cdb!.vencimento!)}.`, tela: 'carteira' as Tela, params: { ativo: a.id } })),
  ];
  const mes = { m: r.ultimo.id };

  return (
    <div className="escada pb-[6vh]">
      <h1 className="sr-only">Patrimônio da família em {mesExtenso(r.ultimo.id, false)}</h1>

      {/* O agora, de cara */}
      <section aria-label="Patrimônio atual" className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-2">
        <div>
          <p className="rotulo"><Para tela="mes" params={mes} discreto titulo="Ver este mês em detalhe">{mesExtenso(r.ultimo.id)}</Para></p>
          <p className="chegada"><Para tela="mes" params={mes} discreto className="hover:text-agora" titulo="Ver este mês em detalhe">{brl(total)}</Para></p>
        </div>
        <div className="text-right">
          {r.variacao !== null && (
            <p className="text-[17px]"><Para tela="mes" params={mes} discreto>Variação mensal</Para> <b>{comSinal(r.variacao)}</b> &nbsp;{r.variacaoPct !== null && pct(r.variacaoPct, 2, true)}</p>
          )}
          {r.primeiro && <p className="text-rotulo"><Para tela="analises" params={{ v: 'patrimonio', de: r.primeiro.mes.id }} discreto>desde {mesExtenso(r.primeiro.mes.id, false)}: {brl(r.primeiro.total)}</Para> · <Para tela="mes" params={mes} discreto>{r.linhas.length} fechamentos</Para></p>}
          {r.lancamentosAbertos > 0 && <p className="text-sm text-rotulo"><Para tela="lancar" params={{ ver: 'lista' }} discreto>{r.lancamentosAbertos} lançamento{r.lancamentosAbertos > 1 ? 's' : ''} entram no próximo fechamento.</Para></p>}
        </div>
      </section>

      <Agora e={e} ultimo={r.ultimo} totalFechado={total} />

      <div className="painel pausa">
        <Degrau nivel={0} titulo="Por grupo" id="grupos">
          <Rosca fatias={fatias} centro={brl(total)} formato={brl}
            descricao={`Divisão do patrimônio por grupo: ${GRUPOS.map((g) => `${g.nome} ${total ? pct(r.porGrupo[g.id] / total) : '—'}`).join(', ')}.`} />
          {GRUPOS.map((g) => (
            <div key={g.id} className="grid grid-cols-[minmax(0,1fr)_4.5ch_auto] items-baseline gap-x-3 py-0.5">
              <span><span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: `var(${COR_DO_GRUPO[g.id]})` }} /><Para tela="carteira" params={{ classe: CLASSE_DO_GRUPO[g.id] }} discreto>{g.nome}</Para>{g.id === 'ext' && r.ultimo!.posicoes.dolar?.q ? <span className="ml-2 text-[13px] text-rotulo">{usd(r.ultimo!.posicoes.dolar.q)}</span> : null}</span>
              <span className="text-right text-rotulo">{total ? pct(r.porGrupo[g.id] / total) : '—'}</span>
              <span className="whitespace-nowrap text-right">{brl(r.porGrupo[g.id])}</span>
            </div>
          ))}
        </Degrau>

        <Degrau nivel={0} titulo="Resumo dos investimentos" id="resumo">
          {CLASSES.map((c) => <Linha key={c.id} rotulo={<Para tela="carteira" params={{ classe: c.id }} discreto>{c.nome}</Para>} valor={brl(r.porClasse[c.id])} />)}
          <Linha rotulo="Total" valor={<span className="agora">{brl(total)}</span>} forte />
        </Degrau>

        <Degrau nivel={0} titulo="Dividendos, aportes e o caminho" id="divid">
          <Linha rotulo={<Para tela="mes" params={{ ...mes, ver: 'divs' }} discreto>Dividendos do mês</Para>} valor={brl(r.dividendosMes)} />
          <Linha rotulo={<Para tela="analises" params={{ v: 'dividendos', de: r.primeiro?.mes.id }} discreto>Acumulado</Para>} valor={brl(r.dividendos.total)} />
          <Linha rotulo={`Média de ${r.ano}`} valor={<span className="text-rotulo">{brl(r.dividendos.mediaMensalAno)}/mês</span>} />
          <Linha rotulo={<Para tela="mes" params={{ ...mes, ver: 'lancs' }} discreto>Aporte do mês</Para>} valor={brl(r.aporteMes)} className="mt-2" />
          <Linha rotulo={<Para tela="analises" params={{ v: 'patrimonio', de: r.primeiro?.mes.id }} discreto>Aportado desde o início</Para>} valor={brl(r.aportado)} />
          <Linha rotulo={<Para tela="analises" params={{ v: 'rendimento', de: r.primeiro?.mes.id }} discreto>Rendimento</Para>} valor={comSinal(total - r.aportado)} />
          {primeiroAporte && primeiroAporte.id > r.primeiro!.mes.id && (
            <p className="mt-1 text-sm text-rotulo">Aportes antes de {mesCurto(primeiroAporte.id)} não foram registrados; aparecem como rendimento.</p>
          )}
        </Degrau>

        {(avisos.length > 0 || e.reservas.length > 0) && (
          <Degrau nivel={0} titulo="Para conferir" id="avisos">
            <ul className="grid gap-1 text-[15px]">{avisos.map((a) => <li key={a.texto}>{a.tela ? <Para tela={a.tela} params={a.params}>{a.texto}</Para> : a.texto}</li>)}</ul>
            {e.reservas.length > 0 && <>
              <h2 className="rotulo mt-4 mb-1">Fora do patrimônio</h2>
              {e.reservas.map((x) => <p key={x.id}><Para tela="carteira" params={{ classe: 'reservas' }} discreto>{x.nome}</Para><LinhaReserva r={x} dolar={r.dolar} /></p>)}
            </>}
          </Degrau>
        )}
      </div>
    </div>
  );
}
