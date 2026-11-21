import { useMemo, useState } from 'react';
import type { Plugin } from 'chart.js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CLASSES, classe } from '@/domain/classes';
import { aporteNecessario, duracao, projetar } from '@/domain/analise';
import { r2, somar, sugerirAporte } from '@/domain/carteira';
import { baseProjecao, mesesAte } from '@/domain/historico';
import type { ClasseId, Objetivo } from '@/domain/tipos';
import { novoId, salvarConfig } from '@/data/store';
import { brl, comSinal, lerNumero, mesCurto, mesesDe, mesesEntre, mesExtenso, num, paraCampo, pct, somarMeses } from '@/lib/formato';
import { Tela, Escolha } from '../partes/Tela';
import { CampoNumero } from '../partes/Campo';
import { Degrau, Linha } from '../partes/Degrau';
import { Grafico, type Serie } from '../partes/Grafico';
import { tokens } from '../partes/graficoBase';
import { Para } from '../partes/Para';
import { useResumo } from '../resumo';

const RITMOS = [{ id: 12, nome: 'Últimos 12 meses' }, { id: 24, nome: 'Últimos 24 meses' }, { id: 0, nome: 'Desde o início' }];
const compacto = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${num(v / 1e6, 1)} mi` : Math.abs(v) >= 1000 ? `R$ ${num(v / 1000, 0)} mil` : brl(v));
type Rascunho = { id: string; nome: string; valor: string; data: string };
const paraRascunho = (o: Objetivo): Rascunho => ({ id: o.id, nome: o.nome, valor: paraCampo(o.valor, 2), data: o.data ?? '' });

export function Metas() {
  const r = useResumo();
  const c = r.estado.config;
  const [metas, setMetas] = useState<Partial<Record<ClasseId, string>>>(() => Object.fromEntries(Object.entries(c.metas).map(([k, v]) => [k, paraCampo((v ?? 0) * 100, 2)])));
  const [aporte, setAporte] = useState('');

  const metasNum = useMemo(() => Object.fromEntries(CLASSES.map((x) => [x.id, (lerNumero(metas[x.id] ?? '') ?? 0) / 100])) as Record<ClasseId, number>, [metas]);
  const soma = somar(Object.values(metasNum));
  const total = r.total;
  const sugestao = useMemo(() => { const a = lerNumero(aporte); return a && a > 0 ? sugerirAporte(r.porClasse, metasNum, a) : []; }, [aporte, r.porClasse, metasNum]);

  /* ---------- Simulação ---------- */
  const [ritmo, setRitmo] = useState(12);
  const base = useMemo(() => baseProjecao(r.linhas, ritmo) ?? baseProjecao(r.linhas, 0), [r.linhas, ritmo]);
  const [aporteSim, setAporteSim] = useState('');
  const [taxaSim, setTaxaSim] = useState('');
  const aporteMes = lerNumero(aporteSim) ?? Math.max(0, base?.aporteMensal ?? 0);
  const taxaMes = lerNumero(taxaSim) != null ? lerNumero(taxaSim)! / 100 : base?.taxaMensal ?? 0;
  const [objetivos, setObjetivos] = useState<Rascunho[]>(() => {
    if (c.objetivos?.length) return c.objetivos.map(paraRascunho);
    if (c.metaPatrimonio) return [paraRascunho({ id: novoId(), nome: 'Meta de patrimônio', ...c.metaPatrimonio })];
    // Sugestão inicial editável: o próximo marco redondo acima do patrimônio de hoje.
    const marco = total < 1e6 ? 1e6 : Math.ceil((total * 1.5) / 5e5) * 5e5;
    return [{ id: novoId(), nome: marco === 1e6 ? 'Primeiro milhão' : 'Próximo marco', valor: paraCampo(marco, 2), data: '' }];
  });
  const mudarObj = (id: string, x: Partial<Rascunho>) => setObjetivos((os) => os.map((o) => (o.id === id ? { ...o, ...x } : o)));

  const hoje = r.ultimo?.id ?? '';
  const resultados = objetivos.map((o) => {
    const alvo = lerNumero(o.valor);
    const meses = alvo ? mesesAte(total, alvo, taxaMes, aporteMes) : null;
    const prazo = o.data ? mesesEntre(hoje, o.data.slice(0, 7)) : null;
    return { o, alvo, meses, quando: meses != null ? somarMeses(hoje, meses) : null, prazo, necessario: alvo && prazo != null ? aporteNecessario(total, alvo, taxaMes, prazo) : null };
  });

  // Gráfico: os últimos 24 meses reais e a projeção até o objetivo mais distante (no máximo 30 anos).
  const { rotulos, series, plugins } = useMemo(() => {
    if (!hoje) return { rotulos: [], series: [] as Serie[], plugins: [] };
    const alcancaveis = resultados.map((x) => x.meses).filter((x): x is number => x != null);
    const horizonte = Math.min(360, Math.max(24, ...alcancaveis.map((x) => x + 6)));
    const hist = r.linhas.filter((l) => l.mes.id > somarMeses(hoje, -24));
    const ini = hist[0]?.mes.id ?? hoje;
    const meses = mesesDe(ini, somarMeses(hoje, horizonte));
    const realPorMes = new Map(hist.map((l) => [l.mes.id, l.total]));
    const proj = projetar(total, taxaMes, aporteMes, horizonte);
    const k0 = meses.indexOf(hoje);
    const alvos = resultados.filter((x) => x.alvo).map((x) => ({ nome: x.o.nome || 'Objetivo', valor: x.alvo! }));
    // Cada objetivo vira uma linha horizontal fina, com o nome escrito no fim (texto, não cor).
    const linhasAlvo: Plugin<'line' | 'bar'> = {
      id: 'h-objetivos',
      afterDatasetsDraw(ch) {
        const t = tokens();
        const { left, right, top, bottom } = ch.chartArea;
        const ctx = ch.ctx;
        ctx.save();
        ctx.font = `500 12px ${t.fonte.family}`;
        ctx.textAlign = 'left';
        for (const a of alvos) {
          const y = ch.scales.y.getPixelForValue(a.valor);
          if (y < top || y > bottom) continue;
          ctx.strokeStyle = t.rotulo; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
          ctx.fillStyle = t.dado; ctx.fillText(`${a.nome} · ${compacto(a.valor)}`, left + 6, y - 6);
        }
        ctx.restore();
      },
    };
    return {
      rotulos: meses.map(mesCurto),
      plugins: [linhasAlvo],
      series: [
        { nome: 'Patrimônio', dados: meses.map((m) => realPorMes.get(m) ?? null), cor: '--serie-1' },
        { nome: 'Projeção', dados: meses.map((_, k) => (k >= k0 ? proj[k - k0] : null)), cor: '--serie-1', tracejado: true },
      ] as Serie[],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje, total, taxaMes, aporteMes, r.linhas, JSON.stringify(resultados.map((x) => [x.o.nome, x.alvo, x.meses]))]);

  async function salvarMetas() {
    if (Math.abs(soma - 1) > 0.001 && soma > 0) { toast.error(`As metas somam ${pct(soma)}; ajuste para 100%.`); return; }
    await salvarConfig({ ...c, metas: Object.fromEntries(Object.entries(metasNum).filter(([, v]) => v > 0)) });
    toast.success('Metas de alocação salvas.');
  }
  async function salvarObjetivos() {
    const validos = objetivos.map((o) => ({ id: o.id, nome: o.nome.trim() || 'Objetivo', valor: lerNumero(o.valor) ?? 0, data: o.data.slice(0, 7) || undefined })).filter((o) => o.valor > 0);
    await salvarConfig({ ...c, objetivos: validos, metaPatrimonio: undefined });
    toast.success('Objetivos salvos.');
  }

  return (
    <Tela titulo="Metas">
      <div className="painel pausa">
        <Degrau nivel={0} titulo="Alocação-alvo por classe" id="m-aloc">
          <div className="grid max-w-2xl gap-y-2">
            <div className="rotulo grid grid-cols-[minmax(8rem,1fr)_4rem_5rem_7.5rem] gap-x-4 text-right max-sm:grid-cols-[minmax(7rem,1fr)_4rem_5rem]"><span className="text-left">Classe</span><span>Hoje</span><span>Meta (%)</span><span className="max-sm:hidden">Diferença</span></div>
            {CLASSES.map((x) => {
              const hojePct = total ? r.porClasse[x.id] / total : 0;
              const diff = metasNum[x.id] ? r2(metasNum[x.id] * total - r.porClasse[x.id]) : null;
              return (
                <div key={x.id} className="grid grid-cols-[minmax(8rem,1fr)_4rem_5rem_7.5rem] items-baseline gap-x-4 text-right max-sm:grid-cols-[minmax(7rem,1fr)_4rem_5rem]">
                  <span className="text-left"><Para tela="carteira" params={{ classe: x.id }} discreto>{x.nome}</Para></span>
                  <span className="text-rotulo">{pct(hojePct)}</span>
                  <Input aria-label={`Meta para ${x.nome}, em %`} inputMode="decimal" value={metas[x.id] ?? ''} onChange={(ev) => setMetas({ ...metas, [x.id]: ev.target.value })} className="min-h-9 py-1 text-right" />
                  <span className="max-sm:hidden">{diff != null ? comSinal(diff) : ''}</span>
                </div>
              );
            })}
            <p className={soma > 0 && Math.abs(soma - 1) > 0.001 ? 'text-erro' : 'text-rotulo'}>Soma das metas: {pct(soma)}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6">
            <Button onClick={() => void salvarMetas()}>Salvar metas</Button>
            <Para tela="analises" params={{ v: 'alocacao' }} className="text-sm">ver a alocação no tempo</Para>
          </div>
        </Degrau>

        <Degrau nivel={0} titulo="Onde aportar" id="m-sug">
          <CampoNumero rotulo="Quanto vão aportar (R$)" valor={aporte} onChange={setAporte} casas={2} className="max-w-xs" />
          {soma === 0 ? <p className="mt-3 text-rotulo">Defina as metas ao lado para receber sugestões.</p>
            : sugestao.length > 0 ? <div className="mt-4">
                {sugestao.map((s) => <Linha key={s.classe} rotulo={classe(s.classe).nome}
                  valor={<Para tela="lancar" params={{ tipo: 'aporte', classe: s.classe, valor: paraCampo(s.valor, 2) }} titulo={`Lançar aporte de ${brl(s.valor)} em ${classe(s.classe).nome}`}>{brl(s.valor)}</Para>} />)}
                <p className="mt-2 text-sm text-rotulo">Toque num valor para lançar o aporte já preenchido.</p>
              </div>
            : lerNumero(aporte) ? <p className="mt-3 text-rotulo">A carteira já está nas metas; qualquer classe serve.</p> : null}
        </Degrau>

        <Degrau nivel={0} titulo="Quando chegamos lá" id="m-sim" className="col-span-full">
          <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <div className="grid gap-5">
              <div>
                <Escolha rotulo="Ritmo usado" opcoes={RITMOS} valor={ritmo} onChange={(x) => { setRitmo(x); setAporteSim(''); setTaxaSim(''); }} tamanho="text-sm" className="gap-x-4" />
                {base && <p className="text-sm text-rotulo">Nesse ritmo, vocês aportaram {brl(Math.max(0, base.aporteMensal))} por mês e a carteira rendeu {pct(base.taxaMensal, 2)} ao mês.</p>}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <CampoNumero rotulo="Aporte por mês (R$)" valor={aporteSim} onChange={setAporteSim} casas={2} dica={aporteSim ? undefined : `ritmo: ${brl(Math.max(0, base?.aporteMensal ?? 0))}`} />
                <CampoNumero rotulo="Rendimento ao mês (%)" valor={taxaSim} onChange={setTaxaSim} casas={3} dica={taxaSim ? undefined : `ritmo: ${pct(base?.taxaMensal ?? 0, 2)}`} />
              </div>
              {(aporteSim || taxaSim) && <Button variant="rotulo" size="texto" className="justify-self-start text-sm" onClick={() => { setAporteSim(''); setTaxaSim(''); }}>Voltar ao ritmo real</Button>}

              <div>
                <h3 className="rotulo mb-1">Objetivos</h3>
                <ul className="grid gap-4">
                  {resultados.map(({ o, alvo, meses, quando, prazo, necessario }) => (
                    <li key={o.id} className="grid gap-1">
                      <Input aria-label="Nome do objetivo" value={o.nome} onChange={(x) => mudarObj(o.id, { nome: x.target.value })} placeholder="Ex.: casa na praia" className="text-[17px]" />
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-x-3">
                        <Input aria-label={`Valor de ${o.nome || 'objetivo'} (R$)`} inputMode="decimal" value={o.valor} onChange={(x) => mudarObj(o.id, { valor: x.target.value })} className="text-right" placeholder="Valor (R$)" />
                        <Input aria-label={`Até quando (opcional) para ${o.nome || 'objetivo'}`} type="month" value={o.data} onChange={(x) => mudarObj(o.id, { data: x.target.value })} />
                        <Button variant="rotulo" size="sm" aria-label={`Tirar ${o.nome || 'objetivo'}`} onClick={() => setObjetivos((os) => os.filter((y) => y.id !== o.id))}>tirar</Button>
                      </div>
                      {alvo ? (
                        <p className="text-[15px]">
                          {meses === 0 ? 'Já alcançado.' : meses == null ? 'Nesse ritmo, não chega em 100 anos.'
                            : <>Chega em <b>{mesExtenso(quando!, false)}</b>, em {duracao(meses)}.</>}
                          {prazo != null && meses != null && meses > 0 && (meses <= prazo
                            ? <span className="text-rotulo"> Dentro do prazo.</span>
                            : <span className="text-rotulo"> Para chegar até {mesCurto(o.data)}: {necessario != null ? `${brl(necessario)} por mês` : 'o prazo já passou'}.</span>)}
                        </p>
                      ) : <p className="text-sm text-rotulo">Informe o valor.</p>}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-x-6">
                  <Button variant="texto" size="texto" onClick={() => setObjetivos((os) => [...os, { id: novoId(), nome: '', valor: '', data: '' }])}>Novo objetivo</Button>
                  <Button onClick={() => void salvarObjetivos()}>Salvar objetivos</Button>
                </div>
              </div>
            </div>

            {base && series.length > 0
              ? <Grafico titulo="Patrimônio e projeção" descricao="Patrimônio real dos últimos 24 meses e a projeção mês a mês com o aporte e o rendimento escolhidos; cada objetivo é uma linha horizontal pontilhada."
                  rotulos={rotulos} series={series} formato={brl} formatoEixo={compacto} plugins={plugins} altura={360} />
              : <p className="text-rotulo">A simulação aparece depois de dois meses de histórico.</p>}
          </div>
        </Degrau>
      </div>
    </Tela>
  );
}
