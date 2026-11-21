import {
  BarController, BarElement, CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip,
  type ChartDataset, type ChartOptions, type Plugin,
} from 'chart.js';

Chart.register(LineController, BarController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);
export { Chart };

export interface Serie {
  nome: string;
  dados: (number | null)[];
  /** Variável CSS da cor (validadas com a skill dataviz sobre o fundo). */
  cor: '--serie-1' | '--serie-2' | '--serie-3' | '--serie-4';
  tipo?: 'line' | 'bar';
  tracejado?: boolean;
  degrau?: boolean;
}

export type Fmt = { formato: (v: number) => string; formatoEixo?: (v: number) => string };

/* Lê os tokens no momento de desenhar (assim um tema futuro vale sem mudar código). */
export function tokens() {
  const estilo = getComputedStyle(document.documentElement);
  const css = (v: string) => estilo.getPropertyValue(v).trim();
  return { css, fonte: { family: css('--h-fonte-leitura') || 'system-ui', size: 12 }, rotulo: css('--rotulo'), traco: css('--traco'), dado: css('--dado'), agora: css('--agora'), fundo: css('--fundo') };
}

/* Linguagem H nos gráficos: traço de 2px, barras com ponta arredondada de 4px ancoradas na base,
   meses sem registro atravessados com tracejado curto, e o laranja só no último ponto quando pedido. */
export function datasetsDe(series: Serie[], destacarUltimo = false): ChartDataset<'line' | 'bar', (number | null)[]>[] {
  const t = tokens();
  return series.map((s) => {
    const cor = t.css(s.cor);
    const ultimo = s.dados.length - 1;
    const poucos = s.dados.filter((x) => x != null).length <= 3;
    return (s.tipo ?? 'line') === 'bar'
      ? { type: 'bar', label: s.nome, data: s.dados, backgroundColor: cor, borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }, borderSkipped: 'start', maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9 }
      : {
          type: 'line', label: s.nome, data: s.dados, borderColor: cor, backgroundColor: cor, borderWidth: 2, stepped: s.degrau ? 'before' : false,
          borderDash: s.tracejado ? [6, 4] : undefined, tension: 0, spanGaps: true,
          segment: { borderDash: (c) => (c.p0.skip || c.p1.skip || c.p1DataIndex - c.p0DataIndex > 1 ? [3, 4] : s.tracejado ? [6, 4] : undefined) },
          pointRadius: (c) => (destacarUltimo && c.dataIndex === ultimo ? 5 : poucos ? 3 : 0),
          pointBackgroundColor: (c) => (destacarUltimo && c.dataIndex === ultimo ? t.agora : cor),
          pointBorderColor: t.fundo, pointBorderWidth: 2, pointHoverRadius: 5, pointHitRadius: 12,
        };
  });
}

export function opcoes(series: Serie[], fmt: { current: Fmt }, horizontal = false): ChartOptions<'line' | 'bar'> {
  const t = tokens();
  const eixoValor = { grid: { color: t.traco, drawTicks: false }, border: { display: false }, ticks: { color: t.rotulo, font: t.fonte, padding: 8, maxRotation: 0, autoSkipPadding: 16, callback: (v: string | number) => (fmt.current.formatoEixo ?? fmt.current.formato)(+v) } };
  const eixoCat = { grid: { display: false }, border: { color: t.traco }, ticks: { color: t.rotulo, font: t.fonte, maxRotation: 0, autoSkipPadding: 16 } };
  const eixo = horizontal ? 'x' : 'y';
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true, maintainAspectRatio: false, animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 250 },
    interaction: { mode: 'index', intersect: false, axis: horizontal ? 'y' : 'x' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.dado, titleColor: '#fff', bodyColor: '#fff', titleFont: { ...t.fonte, size: 13, weight: 600 }, bodyFont: { ...t.fonte, size: 13 },
        padding: 10, cornerRadius: 0, displayColors: series.length > 1, boxWidth: 10, boxHeight: 2, boxPadding: 4,
        callbacks: { label: (c) => `${series.length > 1 ? `${c.dataset.label}: ` : ''}${c.parsed[eixo] == null ? '—' : fmt.current.formato(c.parsed[eixo]!)}` },
      },
    },
    scales: horizontal ? { x: eixoValor, y: eixoCat } : { x: eixoCat, y: eixoValor },
  } as ChartOptions<'line' | 'bar'>;
}

/** Nome de cada linha escrito no fim dela, em cor de texto (a cor da série fica só no traço). */
export const rotulosNoFim: Plugin<'line' | 'bar'> = {
  id: 'h-rotulos-fim',
  afterDatasetsDraw(ch) {
    const t = tokens();
    const ctx = ch.ctx;
    const itens = ch.data.datasets.map((d, i) => {
      const meta = ch.getDatasetMeta(i);
      const dados = d.data as (number | null)[];
      let k = dados.length - 1;
      while (k >= 0 && dados[k] == null) k--;
      const p = k >= 0 ? meta.data[k] : null;
      return p ? { nome: String(d.label), x: p.x, y: p.y } : null;
    }).filter(Boolean) as { nome: string; x: number; y: number }[];
    itens.sort((a, b) => a.y - b.y);
    for (let i = 1; i < itens.length; i++) if (itens[i].y - itens[i - 1].y < 15) itens[i].y = itens[i - 1].y + 15;
    ctx.save();
    ctx.font = `500 12px ${t.fonte.family}`;
    ctx.fillStyle = t.dado;
    ctx.textBaseline = 'middle';
    for (const it of itens) ctx.fillText(it.nome, it.x + 8, it.y);
    ctx.restore();
  },
};
