import { html, svg, type TemplateResult } from 'lit-html';
import { LACUNA_DIAS, type Ano, type Linha } from '../calc';
import { brl, brlS, mesCurto, mesLongo, mesSigla, mil } from './format';

/* Gráficos em SVG puro. Regras (skill dataviz): um eixo só, linhas de 2px,
   grade discreta, legenda sempre presente, tooltip no hover e no teclado,
   cores vindas dos tokens --c-* (validadas para daltonismo nos dois temas). */

const W = 820, PAD_R = 64, H = 220, LBL = 24;
const VW = W + PAD_R, VH = H + LBL;

function ticks(lo: number, hi: number, alvo = 4) {
  const bruto = (hi - lo) / alvo;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= bruto) ?? 10 * mag;
  const ini = Math.ceil(lo / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= hi + 1e-6; v += passo) out.push(v);
  return out;
}

const tsOf = (d: string) => Date.parse(d + 'T12:00:00Z');

/* Posiciona o tooltip HTML sobre o SVG (coordenadas do viewBox → px). */
function mostrarTT(chart: HTMLElement, xVB: number, yVB: number, conteudo: string, vbW = VW, vbH = VH) {
  const tt = chart.querySelector<HTMLElement>('.tt')!;
  const r = chart.querySelector('svg')!.getBoundingClientRect();
  const x = (xVB / vbW) * r.width, y = (yVB / vbH) * r.height;
  tt.innerHTML = conteudo;
  tt.style.left = `${x}px`;
  tt.style.top = `${y}px`;
  tt.classList.toggle('left', x > r.width * 0.6);
  tt.hidden = false;
}
const esconderTT = (chart: HTMLElement) => { chart.querySelector<HTMLElement>('.tt')!.hidden = true; };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/* ---------- Evolução: patrimônio × total aportado ---------- */

export function evolucao(ls: Linha[]): TemplateResult {
  if (ls.length < 2) return html`<p class="tip">Ainda não há meses suficientes para o gráfico.</p>`;
  const t0 = tsOf(ls[0].mes.data), t1 = tsOf(ls[ls.length - 1].mes.data);
  const vals = ls.flatMap((l) => [l.total, l.aportado]);
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const folga = (hi0 - lo0) * 0.08 || hi0 * 0.05;
  const tk = ticks(lo0 - folga, hi0 + folga);
  const lo = Math.min(lo0 - folga, tk[0]), hi = Math.max(hi0 + folga, tk[tk.length - 1]);
  const X = (d: string) => ((tsOf(d) - t0) / (t1 - t0 || 1)) * W;
  const Y = (v: number) => 8 + (H - 16) * (1 - (v - lo) / (hi - lo || 1));
  const pts = ls.map((l) => ({ x: X(l.mes.data), yt: Y(l.total), ya: Y(l.aportado), l }));

  // Trechos com mais de LACUNA_DIAS entre fechamentos: tracejados ("sem registro")
  let cheio = '', lacuna = '', apCheio = '';
  pts.forEach((p, i) => {
    const gap = i > 0 && (p.l.dias ?? 0) > LACUNA_DIAS;
    if (i === 0) { cheio += `M${p.x},${p.yt}`; apCheio += `M${p.x},${p.ya}`; return; }
    const a = pts[i - 1];
    if (gap) { lacuna += `M${a.x},${a.yt}L${p.x},${p.yt}`; cheio += `M${p.x},${p.yt}`; }
    else cheio += `L${p.x},${p.yt}`;
    apCheio += `L${p.x},${p.ya}`;
  });
  const area = `M${pts[0].x},${H}` + pts.map((p) => `L${p.x},${p.yt}`).join('') + `L${pts[pts.length - 1].x},${H}Z`;

  // Rótulos do eixo X: no máximo ~6, por ano ou semestre
  const anos = new Set<string>();
  const marcas = ls.filter((l) => {
    const y = l.mes.data.slice(0, 4);
    if (anos.has(y)) return false;
    anos.add(y);
    return true;
  });
  const passoX = Math.ceil(marcas.length / 6);
  const rotX = marcas.filter((_, i) => i % passoX === 0);

  let foco = pts.length - 1;
  const destacar = (chart: HTMLElement, i: number) => {
    foco = i;
    const p = pts[i];
    const cross = chart.querySelector<SVGLineElement>('.cross')!;
    cross.setAttribute('x1', String(p.x)); cross.setAttribute('x2', String(p.x)); cross.style.display = '';
    const [c1, c2] = chart.querySelectorAll<SVGCircleElement>('.dot');
    c1.setAttribute('cx', String(p.x)); c1.setAttribute('cy', String(p.yt)); c1.style.display = '';
    c2.setAttribute('cx', String(p.x)); c2.setAttribute('cy', String(p.ya)); c2.style.display = '';
    const l = p.l;
    mostrarTT(chart, p.x, (p.yt + p.ya) / 2,
      `<b>${esc(mesLongo(l.mes.data))}</b>Patrimônio ${brl(l.total)}<br>Aportado ${brl(l.aportado)}<br>Rendeu ${brlS(l.total - l.aportado)}`);
  };
  const limpar = (chart: HTMLElement) => {
    chart.querySelector<SVGLineElement>('.cross')!.style.display = 'none';
    chart.querySelectorAll<SVGCircleElement>('.dot').forEach((c) => (c.style.display = 'none'));
    esconderTT(chart);
  };
  const perto = (xVB: number) => {
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - xVB) < Math.abs(pts[best].x - xVB)) best = i; });
    return best;
  };
  const onMove = (e: PointerEvent) => {
    const chart = (e.currentTarget as Element).closest<HTMLElement>('.chart')!;
    const r = chart.querySelector('svg')!.getBoundingClientRect();
    destacar(chart, perto(((e.clientX - r.left) / r.width) * VW));
  };
  const onKey = (e: KeyboardEvent) => {
    const chart = (e.currentTarget as Element).closest<HTMLElement>('.chart')!;
    if (e.key === 'ArrowLeft') { destacar(chart, Math.max(0, foco - 1)); e.preventDefault(); }
    if (e.key === 'ArrowRight') { destacar(chart, Math.min(pts.length - 1, foco + 1)); e.preventDefault(); }
  };
  const ult = ls[ls.length - 1];
  const temLacuna = !!lacuna;

  return html`
    <div class="legend">
      <span><span class="sw" style="background:var(--c-patrimonio)"></span>Patrimônio</span>
      <span><span class="sw" style="background:var(--c-aportado)"></span>Total aportado</span>
      ${temLacuna ? html`<span><span class="sw" style="background:repeating-linear-gradient(90deg,var(--c-patrimonio) 0 4px,transparent 4px 7px)"></span>Meses sem registro</span>` : ''}
      <span class="muted">A distância entre as linhas é o que a carteira rendeu sozinha.</span>
    </div>
    <div class="chart" style="margin-top:10px">
      <svg viewBox="0 0 ${VW} ${VH}" role="img"
        aria-label=${`Patrimônio de ${brl(ls[0].total)} em ${mesLongo(ls[0].mes.data)} para ${brl(ult.total)} em ${mesLongo(ult.mes.data)}; total aportado ${brl(ult.aportado)}.`}>
        ${tk.map((v) => svg`<line class="grid-l" x1="0" x2=${W} y1=${Y(v)} y2=${Y(v)}/><text class="axis" x=${W + 10} y=${Y(v) + 4}>${mil(v)}</text>`)}
        ${rotX.map((l) => svg`<text class="axis" x=${X(l.mes.data)} y=${VH - 4} text-anchor=${X(l.mes.data) < 30 ? 'start' : X(l.mes.data) > W - 30 ? 'end' : 'middle'}>${l.mes.data.slice(0, 4)}</text>`)}
        <path d=${area} fill="var(--c-area)"/>
        <path d=${apCheio} fill="none" stroke="var(--c-aportado)" stroke-width="2" stroke-linejoin="round"/>
        <path d=${cheio} fill="none" stroke="var(--c-patrimonio)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
        ${temLacuna ? svg`<path d=${lacuna} fill="none" stroke="var(--c-patrimonio)" stroke-width="2" stroke-dasharray="4 4" opacity=".75"/>` : ''}
        <circle cx=${pts[pts.length - 1].x} cy=${pts[pts.length - 1].yt} r="4" fill="var(--c-patrimonio)"/>
        <line class="cross" y1="0" y2=${H} stroke="var(--ink)" stroke-opacity=".3" stroke-dasharray="3 3" style="display:none"/>
        <circle class="dot" r="5" fill="var(--c-patrimonio)" stroke="var(--card)" stroke-width="2" style="display:none"/>
        <circle class="dot" r="5" fill="var(--c-aportado)" stroke="var(--card)" stroke-width="2" style="display:none"/>
        <rect x="0" y="0" width=${W} height=${H} fill="transparent" tabindex="0" focusable="true"
          aria-label="Explorar mês a mês com as setas" style="outline:none;cursor:crosshair"
          @pointermove=${onMove} @pointerleave=${(e: Event) => limpar((e.currentTarget as Element).closest('.chart')!)}
          @focus=${(e: Event) => destacar((e.currentTarget as Element).closest('.chart')!, foco)}
          @blur=${(e: Event) => limpar((e.currentTarget as Element).closest('.chart')!)}
          @keydown=${onKey}/>
      </svg>
      <div class="tt" hidden></div>
    </div>`;
}

/* ---------- Aportes e rendimento, por fechamento ---------- */

export function aportesRend(ls: Linha[]): TemplateResult {
  const d = ls.filter((l) => l.rend !== null).slice(-12);
  if (!d.length) return html`<p class="tip">Ainda não há meses suficientes.</p>`;
  const BW = 520, BH = 160, TOP = 8;
  const max = Math.max(1, ...d.map((l) => Math.max(l.mes.aporte || 0, l.rend!, 0)));
  const min = Math.min(0, ...d.map((l) => Math.min(l.rend!, -(l.mes.retirada || 0))));
  const span = max - min;
  const Y = (v: number) => TOP + (BH - TOP) * ((max - v) / span);
  const z = Y(0);
  const slot = BW / d.length, b = Math.min(14, slot * 0.3);
  const tip = (e: Event, i: number) => {
    const chart = (e.currentTarget as Element).closest<HTMLElement>('.chart')!;
    const l = d[i];
    mostrarTT(chart, slot * i + slot / 2, Math.min(Y(Math.max(l.mes.aporte, l.rend!, 0)), z) + 10,
      `<b>${esc(mesLongo(l.mes.data))}</b>Aporte ${brl(l.mes.aporte)}${l.mes.retirada ? `<br>Retirada ${brl(l.mes.retirada)}` : ''}<br>Rendimento ${brlS(l.rend)}`,
      BW, BH + 24);
  };
  const out = (e: Event) => esconderTT((e.currentTarget as Element).closest('.chart')!);
  return html`
    <div class="legend" style="margin-top:0">
      <span><span class="sq" style="background:var(--c-aporte)"></span>Aporte</span>
      <span><span class="sq" style="background:var(--c-rend)"></span>Rendimento</span>
      <span><span class="sq" style="background:var(--c-neg)"></span>Rendimento negativo</span>
    </div>
    <div class="chart" style="margin-top:8px">
      <svg viewBox="0 0 ${BW} ${BH + 24}" role="img" aria-label=${`Aportes e rendimento dos últimos ${d.length} fechamentos`}>
        <line x1="0" x2=${BW} y1=${z} y2=${z} stroke="var(--line)"/>
        ${d.map((l, i) => {
          const cx = slot * i + slot / 2;
          const ya = Y(l.mes.aporte || 0), yr = Y(l.rend!);
          const neg = l.rend! < 0;
          return svg`
            <rect x=${cx - b - 1} y=${Math.min(ya, z)} width=${b} height=${Math.abs(z - ya)} rx="2" fill="var(--c-aporte)"/>
            <rect x=${cx + 1} y=${Math.min(yr, z)} width=${b} height=${Math.max(Math.abs(z - yr), neg || l.rend ? 1 : 0)} rx="2" fill=${neg ? 'var(--c-neg)' : 'var(--c-rend)'}/>
            <text class="axis" x=${cx} y=${BH + 18} text-anchor="middle">${d.length > 12 ? mesCurto(l.mes.data) : mesSigla(l.mes.data)}</text>
            <rect x=${slot * i} y="0" width=${slot} height=${BH} fill="transparent" tabindex="0"
              aria-label=${`${mesLongo(l.mes.data)}: aporte ${brl(l.mes.aporte)}, rendimento ${brlS(l.rend)}`}
              style="outline:none" @pointerenter=${(e: Event) => tip(e, i)} @pointerleave=${out} @focus=${(e: Event) => tip(e, i)} @blur=${out}/>`;
        })}
      </svg>
      <div class="tt" hidden></div>
    </div>`;
}

/* ---------- Anual: de onde veio o crescimento ---------- */

export function anualChart(anos: Ano[]): TemplateResult {
  if (!anos.length) return html``;
  const BW = 820, BH = 220, TOP = 16;
  const pos = anos.map((a) => Math.max(0, a.aportes - a.retiradas) + Math.max(0, a.rendimento));
  const neg = anos.map((a) => Math.min(0, a.aportes - a.retiradas) + Math.min(0, a.rendimento));
  const max = Math.max(1, ...pos), min = Math.min(0, ...neg);
  const Y = (v: number) => TOP + (BH - TOP) * ((max - v) / (max - min));
  const z = Y(0);
  const slot = BW / anos.length, b = Math.min(56, slot * 0.45);
  const tip = (e: Event, i: number) => {
    const a = anos[i];
    mostrarTT((e.currentTarget as Element).closest('.chart')!, slot * i + slot / 2, Y(pos[i]) + 20,
      `<b>${a.ano}${a.emAndamento ? ' (em andamento)' : ''}</b>Aportes líquidos ${brlS(a.aportes - a.retiradas)}<br>Rendimento ${brlS(a.rendimento)}<br>Patrimônio no fim ${brl(a.fim)}`,
      BW, BH + 24);
  };
  const out = (e: Event) => esconderTT((e.currentTarget as Element).closest('.chart')!);
  return html`
    <div class="legend" style="margin-top:0">
      <span><span class="sq" style="background:var(--c-aporte)"></span>Aportes líquidos</span>
      <span><span class="sq" style="background:var(--c-rend)"></span>Rendimento</span>
      <span><span class="sq" style="background:var(--c-neg)"></span>Negativo</span>
    </div>
    <div class="chart" style="margin-top:8px">
      <svg viewBox="0 0 ${BW} ${BH + 24}" role="img" aria-label="Crescimento de cada ano dividido entre aportes e rendimento">
        <line x1="0" x2=${BW} y1=${z} y2=${z} stroke="var(--line)"/>
        ${anos.map((a, i) => {
          const cx = slot * i + slot / 2;
          const ap = a.aportes - a.retiradas, rd = a.rendimento;
          // empilha: aporte a partir do zero, rendimento em cima (ou abaixo, se negativo)
          const segs: [number, number, string][] = [];
          let topo = 0, fundo = 0;
          for (const [v, cor] of [[ap, 'var(--c-aporte)'], [rd, 'var(--c-rend)']] as [number, string][]) {
            if (v >= 0) { segs.push([topo, topo + v, cor]); topo += v; }
            else { segs.push([fundo + v, fundo, 'var(--c-neg)']); fundo += v; }
          }
          return svg`
            ${segs.map(([de, ate, cor]) => svg`<rect x=${cx - b / 2} y=${Y(ate)} width=${b} height=${Math.max(0, Y(de) - Y(ate) - 2)} rx="3" fill=${cor}/>`)}
            <text class="axis" x=${cx} y=${BH + 18} text-anchor="middle">${a.ano}</text>
            <rect x=${slot * i} y="0" width=${slot} height=${BH} fill="transparent" tabindex="0" style="outline:none"
              aria-label=${`${a.ano}: aportes líquidos ${brlS(ap)}, rendimento ${brlS(rd)}`}
              @pointerenter=${(e: Event) => tip(e, i)} @pointerleave=${out} @focus=${(e: Event) => tip(e, i)} @blur=${out}/>`;
        })}
      </svg>
      <div class="tt" hidden></div>
    </div>`;
}
