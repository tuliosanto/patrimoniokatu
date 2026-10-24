import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { baseProjecao, CLASSES, mesesAte } from '../calc';
import { salvarConfig } from '../store';
import type { ClasseId } from '../types';
import { pref, setPref, type Ctx } from './ctx';
import { toast } from './feedback';
import { brl, lerNum, mesLongo, num, pct, pctS } from './format';

let alvoTxt = '';
let rendaTxt = '';
let taxaTxt = '0,33';
let metasTxt: Partial<Record<ClasseId, string>> | null = null;

const quando = (data: string, meses: number) => {
  const d = new Date(+data.slice(0, 4), +data.slice(5, 7) - 1 + meses, 1);
  return mesLongo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
};
const duracao = (m: number) => {
  const a = Math.floor(m / 12), r = m % 12;
  const p = (n: number, s: string, pl: string) => `${n} ${n === 1 ? s : pl}`;
  return a ? p(a, 'ano', 'anos') + (r ? ` e ${p(r, 'mês', 'meses')}` : '') : p(r, 'mês', 'meses');
};

export function metas(c: Ctx) {
  const per = pref<number>('projPeriodo', 24);
  const b = baseProjecao(c.ls, per);
  const alvo = lerNum(alvoTxt);
  const renda = lerNum(rendaTxt), taxa = lerNum(taxaTxt) / 100;
  const alvoRenda = renda && taxa ? renda / taxa : 0;

  const resultado = (valor: number) => {
    if (!b || !valor) return '';
    if (valor <= b.total) return html`<p class="big" style="font-size:22px">Vocês já passaram desse valor.</p>`;
    const m = mesesAte(b.total, valor, b.taxaMensal, b.aporteMensal);
    if (m === null) return html`<p class="neg">No ritmo do período escolhido, esse valor não seria atingido. Tente um período mais longo.</p>`;
    return html`<p class="big" style="font-size:24px;color:var(--accent)">${quando(b.data, m)}</p>
      <p class="tip">Daqui a cerca de ${duracao(m)}, mantendo o ritmo de aportes e rentabilidade do período escolhido.</p>`;
  };

  const cfg = c.s.estado.config;
  if (!metasTxt) metasTxt = Object.fromEntries(CLASSES.map((k) => [k.id, cfg.metas?.[k.id] ? num(cfg.metas[k.id]! * 100, 0) : '']));
  const somaMetas = CLASSES.reduce((t, k) => t + lerNum(metasTxt![k.id]), 0);

  return html`
    <div class="page-head"><div><div class="eyebrow">Metas</div><h1>Projeções e alocação</h1></div></div>
    <p class="tip" style="max-width:68ch">Estimativas baseadas no ritmo do passado. <b>Não são garantia</b>: o mercado varia, e o futuro pode ser melhor ou pior que a média.</p>

    <section class="card" aria-labelledby="h-base">
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
        <div><h2 id="h-base">Ritmo usado no cálculo</h2><p class="cap" style="margin-bottom:0">Média de aportes e rentabilidade do período</p></div>
        <div class="seg" role="group" aria-label="Período de referência" style="margin-left:auto">
          ${([['12 meses', 12], ['24 meses', 24], ['Tudo', 0]] as [string, number][]).map(([rot, m]) => html`
            <button type="button" aria-pressed=${per === m} @click=${() => { setPref('projPeriodo', m); c.redesenhar(); }}>${rot}</button>`)}
        </div>
      </div>
      ${b ? html`<div class="grid g4" style="margin-top:18px">
        <div class="kpi" style="padding:0"><div class="k">Aporte líquido por mês</div><div class="v">${brl(b.aporteMensal)}</div></div>
        <div class="kpi" style="padding:0"><div class="k">Rentabilidade por mês</div><div class="v">${pctS(b.taxaMensal, 2)}</div><div class="s">${pctS(Math.pow(1 + b.taxaMensal, 12) - 1)} ao ano</div></div>
        <div class="kpi" style="padding:0"><div class="k">Patrimônio atual</div><div class="v">${brl(b.total)}</div></div>
        <div class="kpi" style="padding:0"><div class="k">Período</div><div class="v">${Math.round(b.dias / 30.44)} meses</div><div class="s">contados pelo calendário</div></div>
      </div>` : html`<p class="tip" style="margin-top:12px">Histórico insuficiente no período (são precisos ao menos 2 meses).</p>`}
    </section>

    <div class="grid g2">
      <section class="card" aria-labelledby="h-alvo">
        <h2 id="h-alvo">Atingir um patrimônio</h2>
        <p class="cap">Nesse ritmo, quando vocês chegariam a um total?</p>
        <div class="field"><label for="m-alvo">Patrimônio alvo</label>
          <div class="inp"><span class="pre">R$</span><input id="m-alvo" class="num" inputmode="decimal" placeholder="1.000.000" .value=${live(alvoTxt)} @input=${(e: Event) => { alvoTxt = (e.target as HTMLInputElement).value; c.redesenhar(); }}></div></div>
        <div style="margin-top:16px">${resultado(alvo)}</div>
      </section>
      <section class="card" aria-labelledby="h-renda">
        <h2 id="h-renda">Viver de renda</h2>
        <p class="cap">Quanto é preciso para sacar uma renda mensal sem consumir o patrimônio?</p>
        <div class="form-grid">
          <div class="field"><label for="m-renda">Renda mensal</label>
            <div class="inp"><span class="pre">R$</span><input id="m-renda" class="num" inputmode="decimal" placeholder="10.000" .value=${live(rendaTxt)} @input=${(e: Event) => { rendaTxt = (e.target as HTMLInputElement).value; c.redesenhar(); }}></div></div>
          <div class="field"><label for="m-taxa">Retirada mensal <span class="hint">0,33% ≈ regra dos 4% ao ano</span></label>
            <div class="inp"><input id="m-taxa" class="num" inputmode="decimal" .value=${live(taxaTxt)} @input=${(e: Event) => { taxaTxt = (e.target as HTMLInputElement).value; c.redesenhar(); }}><span class="suf">%</span></div></div>
        </div>
        ${alvoRenda ? html`<p class="tip" style="margin-top:14px">É preciso ter <b>${brl(alvoRenda)}</b>.</p>` : ''}
        <div style="margin-top:8px">${resultado(alvoRenda)}</div>
      </section>
    </div>

    <section class="card" aria-labelledby="h-metas">
      <h2 id="h-metas">Metas de alocação</h2>
      <p class="cap">Quanto de cada classe vocês querem ter. Aparece como um traço no gráfico da tela inicial.</p>
      <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
        ${CLASSES.map((k) => html`<div class="field"><label for=${'meta-' + k.id}>${k.nome}</label>
          <div class="inp"><input id=${'meta-' + k.id} class="num" inputmode="decimal" placeholder="0" .value=${live(metasTxt![k.id] ?? '')}
            @input=${(e: Event) => { metasTxt![k.id] = (e.target as HTMLInputElement).value; c.redesenhar(); }}><span class="suf">%</span></div></div>`)}
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:16px;flex-wrap:wrap">
        <span class=${Math.abs(somaMetas - 100) < 0.5 || !somaMetas ? 'muted' : 'neg'} style="font-size:14px">Soma: ${pct(somaMetas / 100, 0)}${somaMetas && Math.abs(somaMetas - 100) >= 0.5 ? ' — o ideal é 100%' : ''}</span>
        <button type="button" class="btn" style="margin-left:auto" @click=${() => {
          const m = Object.fromEntries(CLASSES.map((k) => [k.id, lerNum(metasTxt![k.id]) / 100]).filter(([, v]) => v));
          void salvarConfig({ ...cfg, metas: m });
          toast('Metas salvas.');
        }}>Salvar metas</button>
      </div>
    </section>`;
}
