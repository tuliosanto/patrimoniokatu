import { useEffect, useId, useRef, useState } from 'react';
import type { Plugin } from 'chart.js';
import { Button } from '@/components/ui/button';
import { Chart, datasetsDe, opcoes, type Serie } from './graficoBase';
export type { Serie };

// Constante fora do componente: um [] novo a cada render recriaria o gráfico.
const SEM_PLUGINS: Plugin<'line' | 'bar'>[] = [];

/* Gráfico em canvas (sem SVG), na linguagem H: traço de 2px, grade recessiva, legenda em texto,
   dica no hover/toque, e a tabela com os mesmos dados para quem não vê o gráfico. */
export function Grafico({ titulo, descricao, rotulos, series, formato, formatoEixo, destacarUltimo, altura = 280, horizontal, plugins = SEM_PLUGINS }:
  { titulo: string; descricao: string; rotulos: string[]; series: Serie[]; formato: (v: number) => string; formatoEixo?: (v: number) => string;
    destacarUltimo?: boolean; altura?: number; horizontal?: boolean; plugins?: Plugin<'line' | 'bar'>[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Formatadores num ref: trocar a função não recria o gráfico.
  const fmt = useRef({ formato, formatoEixo });
  fmt.current = { formato, formatoEixo };
  const [tabela, setTabela] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!ref.current) return;
    const ch = new Chart(ref.current, { type: series[0]?.tipo ?? 'line', data: { labels: rotulos, datasets: datasetsDe(series, destacarUltimo) as never }, options: opcoes(series, fmt, horizontal) as never, plugins: plugins as never });
    return () => ch.destroy();
  }, [rotulos, series, destacarUltimo, horizontal, plugins]);

  return (
    <figure className="max-w-4xl">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6">
        <span id={id} className="text-[19px]">{titulo}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-x-5 text-sm" aria-hidden="true">
            {series.map((s) => (
              <span key={s.nome} className="inline-flex items-center gap-2">
                <span className="inline-block h-[2px] w-4" style={{ background: `var(${s.cor})` }} />{s.nome}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div style={{ height: altura }} className="mt-3">
        <canvas ref={ref} role="img" aria-labelledby={id} aria-describedby={`${id}-d`} />
      </div>
      <p id={`${id}-d`} className="sr-only">{descricao}</p>
      <Button variant="rotulo" size="sm" className="px-0" aria-expanded={tabela} onClick={() => setTabela(!tabela)}>{tabela ? 'Esconder tabela' : 'Ver tabela'}</Button>
      {tabela && (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="rotulo text-right"><tr><th className="text-left font-medium">Período</th>{series.map((s) => <th key={s.nome} className="font-medium">{s.nome}</th>)}</tr></thead>
            <tbody>{rotulos.map((r, i) => (
              <tr key={r + i}><td>{r}</td>{series.map((s) => <td key={s.nome} className="text-right tabular-nums">{s.dados[i] == null ? '—' : formato(s.dados[i]!)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
