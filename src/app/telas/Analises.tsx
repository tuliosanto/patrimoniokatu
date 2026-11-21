import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CLASSES, GRUPOS } from '@/domain/classes';
import { composicaoPorMes, responder, resumoPeriodo, somaClasses, type Pergunta } from '@/domain/analise';
import { ehCotada, posicao, r2 } from '@/domain/carteira';
import type { ClasseId } from '@/domain/tipos';
import { fatorCdi, serieCdi, serieMensal, valorAte } from '@/data/cotacoes';
import { brl, comSinal, lerNumero, mesCurto, mesesDe, mesExtenso, num, pct, somarMeses } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { Degrau, Linha } from '../partes/Degrau';
import { EscolhaAtivo } from '../partes/EscolhaAtivo';
import { Explorador } from '../partes/Explorador';
import type { Serie } from '../partes/graficoBase';
import { Para } from '../partes/Para';
import { Escolha, Tela } from '../partes/Tela';
import { useResumo } from '../resumo';
import { trocarParams, useParams, type Params } from '../rota';
import { rotuloAtivo } from '../textos';

type Visao = 'patrimonio' | 'rendimento' | 'rentabilidade' | 'dividendos' | 'alocacao' | 'ativo';
const VISOES: { id: Visao; nome: string; explica: string }[] = [
  { id: 'patrimonio', nome: 'Patrimônio', explica: 'Quanto a carteira valia no fim de cada mês, e quanto disso foi dinheiro aportado.' },
  { id: 'rendimento', nome: 'Rendimento', explica: 'Quanto a carteira rendeu sozinha em cada mês, descontados aportes e retiradas.' },
  { id: 'rentabilidade', nome: 'Rentabilidade', explica: 'Rentabilidade acumulada desde o início do trecho, comparada ao CDI e ao Ibovespa.' },
  { id: 'dividendos', nome: 'Dividendos', explica: 'Dividendos recebidos em cada mês.' },
  { id: 'alocacao', nome: 'Alocação', explica: 'Parte do patrimônio em cada grupo, mês a mês.' },
  { id: 'ativo', nome: 'Um ativo', explica: 'Quantidade e cotação de um ativo em cada fechamento.' },
];
const PERGUNTAS: { id: Exclude<Pergunta, 'passou'>; nome: string }[] = [
  { id: 'melhor', nome: 'Melhor mês' }, { id: 'pior', nome: 'Pior mês' }, { id: 'aporte', nome: 'Maior aporte' }, { id: 'dividendo', nome: 'Maior dividendo' },
];
const COR = ['--serie-1', '--serie-2', '--serie-3', '--serie-4'] as const;
// Formatadores fixos: passar a mesma função não recria o gráfico.
const compacto = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${num(v / 1000, Math.abs(v) < 10000 ? 1 : 0)} mil` : brl(v));
const pct1 = (v: number) => pct(v);
const pct1s = (v: number) => pct(v, 1, true);
const numero = (v: number) => num(v);
const ehClasse = (x: string): x is ClasseId => CLASSES.some((c) => c.id === x);

export function Analises() {
  const r = useResumo();
  const e = r.estado;
  const p = useParams();
  const todos = r.linhas;
  const primeiro = todos[0]?.mes.id ?? '', ultimo = todos[todos.length - 1]?.mes.id ?? '';

  /* Todo o estado da tela mora no endereço: um atalho de outra tela abre exatamente esta consulta. */
  const v = (VISOES.some((x) => x.id === p.get('v')) ? p.get('v') : 'patrimonio') as Visao;
  const limitar = (x: string) => (x < primeiro ? primeiro : x > ultimo ? ultimo : x);
  const de = limitar(p.get('de') ?? somarMeses(ultimo, -12));
  const ate = limitar(p.get('ate') ?? ultimo);
  const classes = (p.get('classes') ?? '').split(',').filter(ehClasse);
  const sep = p.get('sep') === 'grupo';
  const medida = p.get('medida') === 'preco' ? 'preco' : 'qtd';
  const mudar = (x: Params) => trocarParams('analises', { ...Object.fromEntries(p), ...x });

  const fPorMes = useMemo(() => new Map(r.fechamentos.map((f) => [f.id, f])), [r.fechamentos]);
  const comp = useMemo(() => composicaoPorMes(e.fechamentos, e.ativos), [e.fechamentos, e.ativos]);
  const { meses, rot, ls } = useMemo(() => {
    const meses = primeiro ? mesesDe(de, ate) : [];
    return { meses, rot: meses.map(mesCurto), ls: todos.filter((l) => l.mes.id >= de && l.mes.id <= ate) };
  }, [de, ate, todos, primeiro]);
  const porMes = useMemo(() => new Map(ls.map((l) => [l.mes.id, l])), [ls]);
  const m = p.get('m');
  const sel = m && porMes.has(m) ? meses.indexOf(m) : null;

  /* Ativo escolhido (visão "Um ativo"). */
  const cotadas = useMemo(() => e.ativos.filter((a) => ehCotada(a) && !a.arquivado), [e.ativos]);
  const maior = useMemo(() => [...cotadas].sort((a, b) => (r.ultimo?.posicoes[b.id]?.v ?? 0) - (r.ultimo?.posicoes[a.id]?.v ?? 0))[0], [cotadas, r.ultimo]);
  const ativo = cotadas.find((a) => a.id === p.get('ativo')) ?? maior;
  const pm = useMemo(() => (ativo ? posicao(ativo, e.lancamentos).pm : null), [ativo, e.lancamentos]);

  /* Rentabilidade × CDI × Ibovespa: só busca quando essa visão está aberta. */
  const [bench, setBench] = useState<{ cdi: (number | null)[]; ibov: (number | null)[]; erro?: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    setBench(null);
    if (v !== 'rentabilidade' || ls.length < 2) return;
    const ini = ls[0].mes.data, fim = ls[ls.length - 1].mes.data;
    const token = e.config.brapiToken;
    void Promise.allSettled([serieCdi(ini, fim), token ? serieMensal('^BVSP', token) : Promise.reject(new Error('sem token'))]).then(([c, i]) => {
      const erros: string[] = [];
      const cdi = c.status === 'fulfilled' ? ls.map((l) => fatorCdi(c.value, ini, l.mes.data) - 1) : (erros.push('CDI indisponível agora'), ls.map(() => null));
      let ibov: (number | null)[] = ls.map(() => null);
      if (i.status === 'fulfilled') {
        const base = valorAte(i.value, ini);
        if (base) ibov = ls.map((l) => { const x = valorAte(i.value, l.mes.data); return x ? x / base - 1 : null; });
        else erros.push('Ibovespa sem dados para o início do trecho');
      } else erros.push(token ? 'Ibovespa indisponível agora' : 'Ibovespa precisa do token do brapi (em Ajustes)');
      if (vivo) setBench({ cdi, ibov, erro: erros.join(' · ') || undefined });
    });
    return () => { vivo = false; };
  }, [v, ls, e.config.brapiToken]);

  /* As séries da visão escolhida, sempre no mesmo eixo de meses (meses sem registro ficam vazios). */
  const { series, formato, formatoEixo, titulo, rotularFim } = useMemo(() => {
    const noMes = <T,>(f: (id: string) => T | null) => meses.map((id) => f(id));
    const linha = (f: (l: (typeof ls)[number]) => number | null) => noMes((id) => { const l = porMes.get(id); return l ? f(l) : null; });
    switch (v) {
      case 'rendimento':
        return { titulo: 'Rendimento de cada mês', series: [{ nome: 'Rendimento', dados: linha((l) => l.rend), cor: '--serie-1', tipo: 'bar' }] as Serie[], formato: comSinal, formatoEixo: compacto };
      case 'dividendos':
        return { titulo: 'Dividendos de cada mês', series: [{ nome: 'Dividendos', dados: linha((l) => l.mes.dividendos), cor: '--serie-1', tipo: 'bar' }] as Serie[], formato: brl, formatoEixo: compacto };
      case 'alocacao':
        return {
          titulo: 'Parte de cada grupo no patrimônio', rotularFim: true, formato: pct1,
          series: GRUPOS.map((g, k) => ({ nome: g.nome, cor: COR[k], dados: noMes((id) => { const c = comp.get(id); const t = c && somaClasses(c.classes, []); return c && t ? c.grupos[g.id] / t : null; }) })) as Serie[],
        };
      case 'rentabilidade': {
        let acc = 1;
        const idx = new Map(ls.map((l, i) => [l.mes.id, i]));
        const carteira = ls.map((l, i) => { if (i > 0 && l.retorno != null) acc *= 1 + l.retorno; return acc - 1; });
        const alinhar = (xs: (number | null)[]) => noMes((id) => (idx.has(id) ? xs[idx.get(id)!] : null));
        return {
          titulo: 'Rentabilidade acumulada no trecho', formato: pct1s, rotularFim: true,
          series: [
            { nome: 'Carteira', dados: alinhar(carteira), cor: '--serie-1' },
            ...(bench?.cdi.some((x) => x != null) ? [{ nome: 'CDI', dados: alinhar(bench.cdi), cor: '--serie-2' }] : []),
            ...(bench?.ibov.some((x) => x != null) ? [{ nome: 'Ibovespa', dados: alinhar(bench.ibov), cor: '--serie-3' }] : []),
          ] as Serie[],
        };
      }
      case 'ativo': {
        if (!ativo) return { titulo: 'Nenhum ativo cotado', series: [] as Serie[], formato: numero };
        if (medida === 'qtd') return { titulo: `Quantidade de ${rotuloAtivo(ativo)}`, formato: numero, series: [{ nome: 'Quantidade', dados: noMes((id) => fPorMes.get(id)?.posicoes[ativo.id]?.q ?? null), cor: '--serie-1', degrau: true }] as Serie[] };
        return {
          titulo: `Cotação de ${rotuloAtivo(ativo)}`, formato: brl,
          series: [
            { nome: 'Cotação', dados: noMes((id) => fPorMes.get(id)?.posicoes[ativo.id]?.p ?? null), cor: '--serie-1' },
            ...(pm != null ? [{ nome: 'Preço médio', dados: meses.map(() => pm), cor: '--serie-2', tracejado: true }] : []),
          ] as Serie[],
        };
      }
      default: {
        if (sep) return { titulo: 'Patrimônio por grupo', rotularFim: true, formato: brl, formatoEixo: compacto, series: GRUPOS.map((g, k) => ({ nome: g.nome, cor: COR[k], dados: noMes((id) => comp.get(id)?.grupos[g.id] ?? null) })) as Serie[] };
        if (classes.length) {
          const nome = classes.length <= 2 ? classes.map((c) => CLASSES.find((x) => x.id === c)!.nome).join(' + ') : `${classes.length} classes`;
          return { titulo: `Patrimônio em ${nome}`, formato: brl, formatoEixo: compacto, series: [{ nome, dados: noMes((id) => { const c = comp.get(id); return c ? somaClasses(c.classes, classes) : null; }), cor: '--serie-1' }] as Serie[] };
        }
        return {
          titulo: 'Patrimônio e total aportado', formato: brl, formatoEixo: compacto,
          series: [{ nome: 'Patrimônio', dados: linha((l) => l.total), cor: '--serie-1' }, { nome: 'Aportado', dados: linha((l) => l.aportado), cor: '--serie-2', tracejado: true }] as Serie[],
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, meses, porMes, ls, comp, bench, ativo?.id, medida, pm, fPorMes, sep, classes.join(',')]);

  const resumo = useMemo(() => resumoPeriodo(ls), [ls]);
  const [limite, setLimite] = useState('');

  if (todos.length < 2) return <Tela titulo="Análises"><Degrau nivel={0}><p>As análises aparecem depois de dois fechamentos.</p></Degrau></Tela>;

  const anos = [...new Set(todos.map((l) => l.mes.id.slice(0, 4)))];
  const periodos = [
    { id: '12', nome: '12 meses', de: somarMeses(ultimo, -12), ate: ultimo },
    { id: '24', nome: '24 meses', de: somarMeses(ultimo, -24), ate: ultimo },
    { id: 'tudo', nome: 'Tudo', de: primeiro, ate: ultimo },
    ...anos.map((a) => ({ id: a, nome: a, de: `${a}-01`, ate: `${a}-12` })),
  ].map((x) => ({ ...x, de: limitar(x.de), ate: limitar(x.ate) }));
  const periodo = periodos.find((x) => x.de === de && x.ate === ate)?.id ?? 'livre';

  function perguntar(q: Pergunta, valor?: number) {
    if (q === 'passou') {
      const achado = responder(todos, 'passou', valor);
      if (achado && (achado < de || achado > ate)) mudar({ m: achado, de: primeiro, ate: ultimo });
      else mudar({ m: achado ?? undefined });
      return achado;
    }
    const achado = responder(ls, q);
    mudar({ m: achado ?? undefined });
    return achado;
  }
  const valorLimite = lerNumero(limite);
  const naoPassou = valorLimite != null && !responder(todos, 'passou', valorLimite) && limite.trim() !== '';

  const linhaSel = sel != null ? porMes.get(meses[sel]) : undefined;
  const comSel = sel != null ? comp.get(meses[sel]) : undefined;
  const escolherMes = (id: string) => mudar({ m: id });
  /** Leva a escolha ao mês com fechamento mais próximo (na direção da seta, ou para os dois lados no clique). undefined = não mexe. */
  function encaixar(i: number | null, d: -1 | 0 | 1): number | null | undefined {
    if (i == null) return null;
    const tem = (k: number) => k >= 0 && k < meses.length && porMes.has(meses[k]);
    if (d !== 0) { for (let k = i; k >= 0 && k < meses.length; k += d) if (tem(k)) return k; return undefined; }
    for (let dist = 0; dist < meses.length; dist++) { if (tem(i - dist)) return i - dist; if (tem(i + dist)) return i + dist; }
    return null;
  }

  /* Ranking de dividendos e alocação contra a meta, dentro do trecho. */
  const divPorAtivo = v === 'dividendos' ? (() => {
    const mapa = new Map<string, number>();
    for (const d of e.dividendos) if (d.data.slice(0, 7) >= de && d.data.slice(0, 7) <= ate) mapa.set(d.ativoId ?? '', (mapa.get(d.ativoId ?? '') ?? 0) + d.valor);
    return [...mapa].map(([id, total]) => ({ id, total: r2(total) })).sort((a, b) => b.total - a.total).slice(0, 8);
  })() : [];

  return (
    <Tela titulo="Análises">
      <Escolha rotulo="O que ver" opcoes={VISOES} valor={v} onChange={(x) => mudar({ v: x })} className="mt-2" tamanho="text-[17px]" />
      <p className="max-w-2xl text-sm text-rotulo">{VISOES.find((x) => x.id === v)!.explica}</p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-1">
        <Escolha rotulo="Trecho" opcoes={[...periodos.map(({ id, nome }) => ({ id, nome })), ...(periodo === 'livre' ? [{ id: 'livre', nome: `${mesCurto(de)} a ${mesCurto(ate)}` }] : [])]}
          valor={periodo} onChange={(id) => { const x = periodos.find((y) => y.id === id); if (x) mudar({ de: x.de, ate: x.ate }); }} className="gap-x-4" tamanho="text-sm" />
      </div>

      {v === 'patrimonio' && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4" role="group" aria-label="Filtrar classes">
          <span className="rotulo mr-1">Classes</span>
          <button type="button" aria-pressed={!classes.length && !sep} onClick={() => mudar({ classes: undefined, sep: undefined })}
            className={cn('min-h-10 text-sm', !classes.length && !sep ? 'font-semibold text-dado underline decoration-2 underline-offset-4' : 'text-rotulo hover:text-dado')}>Todas</button>
          {CLASSES.map((c) => {
            const on = classes.includes(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => mudar({ sep: undefined, classes: (on ? classes.filter((x) => x !== c.id) : [...classes, c.id]).join(',') || undefined })}
                className={cn('min-h-10 text-sm', on ? 'font-semibold text-dado underline decoration-2 underline-offset-4' : 'text-rotulo hover:text-dado')}>{c.nome}</button>
            );
          })}
          <button type="button" aria-pressed={sep} onClick={() => mudar({ sep: sep ? undefined : 'grupo', classes: undefined })}
            className={cn('ml-3 min-h-10 text-sm', sep ? 'font-semibold text-dado underline decoration-2 underline-offset-4' : 'text-rotulo hover:text-dado')}>Separar por grupo</button>
        </div>
      )}

      {v === 'ativo' && ativo && (
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
          <EscolhaAtivo rotulo="Ativo" ativos={cotadas} valor={ativo.id} onChange={(id) => mudar({ ativo: id })} permitirNovo={false} className="w-72" />
          <Escolha rotulo="Medida" opcoes={[{ id: 'qtd', nome: 'Quantidade' }, { id: 'preco', nome: 'Cotação e preço médio' }]} valor={medida} onChange={(x) => mudar({ medida: x })} tamanho="text-sm" className="gap-x-4" />
        </div>
      )}

      <div className="mt-6 grid items-start gap-x-12 gap-y-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {series.length === 0 || series.every((s) => s.dados.every((x) => x == null))
            ? <p className="text-rotulo">{v === 'ativo' ? 'Sem registros deste ativo no trecho. As cotações aparecem a partir dos próximos fechamentos.' : 'Sem dados no trecho.'}</p>
            : <Explorador titulo={titulo} descricao={VISOES.find((x) => x.id === v)!.explica} rotulos={rot} series={series} formato={formato} formatoEixo={formatoEixo}
                rotularFim={rotularFim} selecionado={sel} altura={Math.round(Math.min(460, Math.max(280, innerHeight * 0.5)))}
                onSelecionar={(i, d) => { const k = encaixar(i, d); if (k !== undefined) mudar({ m: k == null ? undefined : meses[k] }); }} onIntervalo={(i0, i1) => mudar({ de: meses[i0], ate: meses[i1] })} />}
          {v === 'rentabilidade' && !bench && <p className="text-sm text-rotulo" role="status">Buscando CDI e Ibovespa…</p>}
          {v === 'rentabilidade' && bench?.erro && <p className="text-sm text-rotulo">{bench.erro}</p>}
          <p className="mt-1 text-sm text-rotulo">Arraste sobre o gráfico para aproximar um trecho. Toque num mês para consultá-lo; as setas ← → andam entre os meses.</p>
        </div>

        {/* Painel de consulta: responde ao que se escolhe no gráfico. */}
        <aside aria-label="Consulta" aria-live="polite" className="grid gap-6">
          {linhaSel ? (
            <section>
              <h2 className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="marco text-[22px] italic">{mesExtenso(linhaSel.mes.id)}</span>
                <button type="button" className="min-h-10 text-sm text-rotulo hover:text-dado" onClick={() => mudar({ m: undefined })}>limpar</button>
              </h2>
              {series.filter((s) => s.nome !== 'Patrimônio' && s.dados[sel!] != null).map((s) => <Linha key={s.nome} rotulo={s.nome} valor={formato(s.dados[sel!]!)} />)}
              <Linha rotulo="Patrimônio" valor={brl(linhaSel.total)} />
              {linhaSel.varMes != null && <Linha rotulo="Variação" valor={comSinal(linhaSel.varMes)} />}
              {linhaSel.rend != null && <Linha rotulo="Rendimento" valor={<>{comSinal(linhaSel.rend)}{linhaSel.retorno != null && <span className="ml-2 text-rotulo">{pct(linhaSel.retorno, 2, true)}</span>}</>} />}
              <Linha rotulo="Aporte líquido" valor={comSinal(linhaSel.fluxo)} />
              <Linha rotulo="Dividendos" valor={brl(linhaSel.mes.dividendos)} />
              {v === 'patrimonio' && classes.length > 0 && comSel && <Linha rotulo="Nas classes escolhidas" valor={brl(somaClasses(comSel.classes, classes))} />}
              <p className="mt-2 flex flex-wrap gap-x-5">
                <Para tela="mes" params={{ m: linhaSel.mes.id }}>abrir o mês</Para>
                {v === 'ativo' && ativo && <Para tela="carteira" params={{ ativo: ativo.id }}>ficha de {rotuloAtivo(ativo)}</Para>}
              </p>
            </section>
          ) : null}

          {resumo && (
            <section>
              <h2 className="rotulo mb-1">De {mesCurto(resumo.ini.mes.id)} a {mesCurto(resumo.fim.mes.id)}</h2>
              <Linha rotulo="Variação" valor={<>{comSinal(resumo.variacao)}{resumo.variacaoPct != null && <span className="ml-2 text-rotulo">{pct(resumo.variacaoPct, 1, true)}</span>}</>} />
              {resumo.rentabilidade && <Linha rotulo="Rentabilidade" valor={<>{pct(resumo.rentabilidade.total, 1, true)}<span className="ml-2 text-rotulo">{pct(resumo.rentabilidade.mensal, 2)} ao mês</span></>} />}
              <Linha rotulo="Aportes líquidos" valor={comSinal(resumo.fluxo)} />
              <Linha rotulo="Rendimento" valor={comSinal(resumo.rendimento)} />
              <Linha rotulo="Dividendos" valor={brl(resumo.dividendos)} />
              {resumo.melhor && <Linha rotulo="Melhor mês" valor={<button type="button" className="underline decoration-traco underline-offset-4 hover:decoration-dado" onClick={() => escolherMes(resumo.melhor!.mes.id)}>{mesCurto(resumo.melhor.mes.id)} · {comSinal(resumo.melhor.rend!)}</button>} />}
              {resumo.pior && <Linha rotulo="Pior mês" valor={<button type="button" className="underline decoration-traco underline-offset-4 hover:decoration-dado" onClick={() => escolherMes(resumo.pior!.mes.id)}>{mesCurto(resumo.pior.mes.id)} · {comSinal(resumo.pior.rend!)}</button>} />}
            </section>
          )}

          <section>
            <h2 className="rotulo mb-1">Perguntar</h2>
            <div className="flex flex-wrap gap-x-4">
              {PERGUNTAS.map((q) => <Button key={q.id} variant="texto" size="texto" className="min-h-10 text-sm" onClick={() => perguntar(q.id)}>{q.nome}</Button>)}
            </div>
            <form className="mt-2 flex items-end gap-3" onSubmit={(x) => { x.preventDefault(); if (valorLimite) perguntar('passou', valorLimite); }}>
              <label className="grid flex-1 gap-1"><span className="rotulo">Quando passamos de (R$)</span>
                <Input inputMode="decimal" value={limite} onChange={(x) => setLimite(x.target.value)} placeholder="500000" aria-describedby="passou-d" /></label>
              <Button type="submit" variant="texto" size="texto">Achar</Button>
            </form>
            <p id="passou-d" className="text-sm text-rotulo">{naoPassou ? 'Ainda não chegamos a esse valor; veja quando em Metas.' : ' '}</p>
            {naoPassou && <Para tela="metas" params={{ ver: 'm-sim' }} className="text-sm">simular em Metas</Para>}
          </section>

          {v === 'dividendos' && divPorAtivo.length > 0 && (
            <section>
              <h2 className="rotulo mb-1">Por ativo no trecho</h2>
              {divPorAtivo.map((x) => {
                const a = e.ativos.find((y) => y.id === x.id);
                return <Linha key={x.id || 'sem'} rotulo={a ? <Para tela="carteira" params={{ ativo: a.id }} discreto>{rotuloAtivo(a)}</Para> : 'Planilha (sem ativo)'} valor={brl(x.total)} />;
              })}
            </section>
          )}

          {v === 'alocacao' && (
            <section>
              <h2 className="rotulo mb-1 flex justify-between"><span>Hoje, por classe</span><Para tela="metas" params={{ ver: 'm-aloc' }}>metas</Para></h2>
              {CLASSES.map((c) => {
                const hoje = r.total ? r.porClasse[c.id] / r.total : 0, meta = e.config.metas[c.id];
                return <Linha key={c.id} rotulo={<Para tela="carteira" params={{ classe: c.id }} discreto>{c.nome}</Para>} valor={<>{pct(hoje)}{meta ? <span className="ml-2 text-rotulo">meta {pct(meta)}</span> : null}</>} />;
              })}
            </section>
          )}

          {v === 'ativo' && ativo && !linhaSel && (
            <p className="flex flex-wrap gap-x-5"><Para tela="carteira" params={{ ativo: ativo.id }}>ficha de {rotuloAtivo(ativo)}</Para><Para tela="lancar" params={{ tipo: 'aporte', ativo: ativo.id }}>lançar compra</Para></p>
          )}
        </aside>
      </div>
    </Tela>
  );
}
