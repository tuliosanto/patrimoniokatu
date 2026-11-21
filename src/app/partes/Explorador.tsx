import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Plugin } from 'chart.js';
import { Button } from '@/components/ui/button';
import { Chart, datasetsDe, opcoes, rotulosNoFim, tokens, type Fmt, type Serie } from './graficoBase';

/* O gráfico que se manipula: arrastar aproxima um trecho, tocar escolhe um mês, as setas andam entre os meses,
   Esc limpa. A escolha é desenhada como uma régua fina; o resto da leitura fica no painel de consulta. */
export function Explorador({ titulo, descricao, rotulos, series, formato, formatoEixo, selecionado, onSelecionar, onIntervalo, altura = 420, rotularFim }:
  { titulo: string; descricao: string; rotulos: string[]; series: Serie[]; formato: (v: number) => string; formatoEixo?: (v: number) => string;
    selecionado: number | null; onSelecionar: (i: number | null, direcao: -1 | 0 | 1) => void; onIntervalo: (i0: number, i1: number) => void; altura?: number; rotularFim?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const grafico = useRef<Chart | null>(null);
  const fmt = useRef<Fmt>({ formato, formatoEixo });
  fmt.current = { formato, formatoEixo };
  const sel = useRef(selecionado);
  sel.current = selecionado;
  const arrasto = useRef<{ x0: number; moveu: boolean } | null>(null);
  const [faixa, setFaixa] = useState<{ de: number; ate: number } | null>(null);
  const [tabela, setTabela] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!canvas.current) return;
    // Régua do mês escolhido: linha de 1px na cor dos dados, sem disputar com o laranja do "agora".
    const regua: Plugin<'line' | 'bar'> = {
      id: 'h-regua',
      afterDatasetsDraw(ch) {
        const i = sel.current;
        if (i == null || i < 0 || i >= rotulos.length) return;
        const x = ch.scales.x.getPixelForValue(i);
        const { top, bottom } = ch.chartArea;
        const ctx = ch.ctx;
        ctx.save();
        ctx.strokeStyle = tokens().dado;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
        ctx.restore();
      },
    };
    const op = opcoes(series, fmt);
    if (rotularFim) op.layout = { padding: { right: 96 } };
    const ch = new Chart(canvas.current, {
      type: series[0]?.tipo ?? 'line',
      data: { labels: rotulos, datasets: datasetsDe(series) as never },
      options: op as never,
      plugins: (rotularFim ? [regua, rotulosNoFim] : [regua]) as never,
    });
    grafico.current = ch;
    return () => { ch.destroy(); grafico.current = null; };
  }, [rotulos, series, rotularFim]);

  // Mudar só a seleção redesenha, sem recriar o gráfico.
  useEffect(() => { grafico.current?.draw(); }, [selecionado]);

  const indice = (x: number) => {
    const ch = grafico.current;
    if (!ch) return 0;
    const v = ch.scales.x.getValueForPixel(Math.min(Math.max(x, ch.chartArea.left), ch.chartArea.right));
    return Math.min(rotulos.length - 1, Math.max(0, Math.round(v ?? 0)));
  };
  const pos = (e: PointerEvent) => e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left;

  function inicio(e: PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrasto.current = { x0: pos(e), moveu: false };
  }
  function mover(e: PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    const x = pos(e);
    if (Math.abs(x - a.x0) > 8) a.moveu = true;
    if (a.moveu) setFaixa({ de: Math.min(a.x0, x), ate: Math.max(a.x0, x) });
  }
  function fim(e: PointerEvent) {
    const a = arrasto.current;
    arrasto.current = null;
    setFaixa(null);
    if (!a) return;
    const x = pos(e);
    if (a.moveu) {
      const i0 = indice(Math.min(a.x0, x)), i1 = indice(Math.max(a.x0, x));
      if (i1 > i0) onIntervalo(i0, i1);
      return;
    }
    const i = indice(x);
    onSelecionar(i === selecionado ? null : i, 0);
  }
  function tecla(e: KeyboardEvent) {
    const n = rotulos.length;
    // Sem mês escolhido, a primeira seta escolhe o mais recente.
    const passo = (d: -1 | 1) => (selecionado == null ? [n - 1, -1] : [selecionado + d, d]) as [number, -1 | 1];
    const mapa: Record<string, [number | null, -1 | 0 | 1]> = { ArrowLeft: passo(-1), ArrowRight: passo(1), Home: [0, 1], End: [n - 1, -1], Escape: [null, 0] };
    if (e.key in mapa) { e.preventDefault(); onSelecionar(...mapa[e.key]); }
  }

  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6">
        <span id={id} className="text-[19px]">{titulo}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-x-5 text-sm" aria-hidden="true">
            {series.map((s) => (
              <span key={s.nome} className="inline-flex items-center gap-2">
                <span className="inline-block h-[2px] w-4" style={{ background: `var(${s.cor})`, borderTop: s.tracejado ? '2px dashed var(--fundo)' : undefined }} />{s.nome}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div tabIndex={0} role="group" aria-labelledby={id} aria-describedby={`${id}-d`} onKeyDown={tecla}
           className="relative mt-3 cursor-crosshair select-none outline-offset-4 [touch-action:pan-y]" style={{ height: altura }}
           onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={() => { arrasto.current = null; setFaixa(null); }}>
        <canvas ref={canvas} role="img" aria-labelledby={id} />
        {faixa && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 bg-realce/70 mix-blend-multiply" style={{ left: faixa.de, width: faixa.ate - faixa.de }} />}
      </div>
      <p id={`${id}-d`} className="sr-only">{descricao} Use as setas para escolher um mês e Esc para limpar.</p>
      <Button variant="rotulo" size="sm" className="px-0" aria-expanded={tabela} onClick={() => setTabela(!tabela)}>{tabela ? 'Esconder tabela' : 'Ver tabela'}</Button>
      {tabela && (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="rotulo text-right"><tr><th className="text-left font-medium">Mês</th>{series.map((s) => <th key={s.nome} className="font-medium">{s.nome}</th>)}</tr></thead>
            <tbody>{rotulos.map((r, i) => (
              <tr key={r + i} className={i === selecionado ? 'bg-realce' : undefined}><td>{r}</td>{series.map((s) => <td key={s.nome} className="text-right tabular-nums">{s.dados[i] == null ? '—' : formato(s.dados[i]!)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
