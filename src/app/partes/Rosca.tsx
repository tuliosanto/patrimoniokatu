import { useEffect, useRef } from 'react';
import { ArcElement, DoughnutController } from 'chart.js';
import { Chart, tokens } from './graficoBase';

Chart.register(DoughnutController, ArcElement);

export type CorSerie = '--serie-1' | '--serie-2' | '--serie-3' | '--serie-4';
export interface Fatia { nome: string; valor: number; cor: CorSerie }

/* Rosca (pizza) da divisão do patrimônio. As fatias ficam separadas por 2px do fundo;
   nome, % e valor estão sempre em texto na lista ao lado, então a cor nunca é a única pista. */
export function Rosca({ fatias, centro, descricao, formato }: { fatias: Fatia[]; centro: string; descricao: string; formato: (v: number) => string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fmt = useRef(formato);
  fmt.current = formato;

  useEffect(() => {
    if (!ref.current) return;
    const t = tokens();
    const total = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0);
    const ch = new Chart(ref.current, {
      type: 'doughnut',
      data: { labels: fatias.map((f) => f.nome), datasets: [{ data: fatias.map((f) => Math.max(0, f.valor)), backgroundColor: fatias.map((f) => t.css(f.cor)), borderColor: t.fundo, borderWidth: 2, hoverOffset: 4 }] },
      options: {
        cutout: '62%', maintainAspectRatio: false, animation: { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.dado, titleColor: t.fundo, bodyColor: t.fundo, titleFont: t.fonte, bodyFont: t.fonte, displayColors: false, cornerRadius: 0, padding: 10,
            callbacks: { label: (c) => `${fmt.current(c.parsed)} · ${total ? Math.round((c.parsed / total) * 100) : 0}%` },
          },
        },
      },
    });
    return () => ch.destroy();
  }, [fatias]);

  return (
    <div className="relative mx-auto my-2 aspect-square w-full max-w-[13rem]">
      <canvas ref={ref} role="img" aria-label={descricao} />
      <p className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span className="rotulo">Total</span>
        <span className="text-[15px] tabular-nums">{centro}</span>
      </p>
    </div>
  );
}
