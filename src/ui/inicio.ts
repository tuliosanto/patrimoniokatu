import { html } from 'lit-html';
import { CLASSES, janela, mesesPendentes, totalPorClasse, twr } from '../calc';
import { aportesRend, evolucao } from './charts';
import { pref, setPref, type Ctx } from './ctx';
import { brl, brlS, mesLongo, nomeMes, num, pct, pctS, sinal } from './format';
import { ic } from './icons';

const PERIODOS: [string, number][] = [['1a', 12], ['2a', 24], ['5a', 60], ['Tudo', 0]];

export function inicio(c: Ctx) {
  const { ls, s } = c;
  const hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const pend = mesesPendentes(s.estado.meses);
  const ult = ls[ls.length - 1];

  const cabecalho = html`
    <div class="page-head">
      <div><div class="eyebrow">${hoje[0].toUpperCase() + hoje.slice(1)}</div><h1>Visão geral</h1></div>
      <div class="actions">
        <a class="btn" href="#/fechar">${ic.mais()}Fechar ${pend.length ? nomeMes(pend[0]) : 'o mês'}</a>
      </div>
    </div>`;

  if (!ult) {
    return html`${cabecalho}
      <div class="card empty">
        <p>Nenhum fechamento ainda.</p>
        <p><a href="#/fechar">Fazer o primeiro fechamento</a> ou <a href="#/ajustes">restaurar um backup</a>.</p>
      </div>`;
  }

  const periodo = pref<number>('periodo', 24);
  const vis = janela(ls, periodo);
  const rendTotal = ult.total - ult.aportado;

  // Ano corrente (do último fechamento)
  const ano = ult.mes.data.slice(0, 4);
  const doAno = ls.filter((l) => l.mes.data.startsWith(ano));
  const rendAno = doAno.reduce((t, l) => t + (l.rend ?? 0), 0);
  const twrAno = twr(doAno);
  const aporteAno = doAno.reduce((t, l) => t + (l.mes.aporte || 0), 0);
  const retAno = doAno.reduce((t, l) => t + (l.mes.retirada || 0), 0);
  const divAno = doAno.reduce((t, l) => t + (l.mes.dividendos || 0), 0);
  const t12 = twr(janela(ls, 12));

  // Alocação
  const porClasse = totalPorClasse(ult.mes, s.estado.ativos);
  const metas = s.estado.config.metas ?? {};
  const temMetas = Object.values(metas).some((v) => v);
  const aloc = CLASSES.map((k) => ({ ...k, v: porClasse[k.id], p: ult.total ? porClasse[k.id] / ult.total : 0, m: metas[k.id] ?? 0 }))
    .filter((x) => x.v || x.m)
    .sort((a, b) => b.v - a.v);
  const escala = Math.max(...aloc.map((x) => Math.max(x.p, x.m)), 0.01) * 1.1;
  const abaixo = temMetas ? aloc.filter((x) => x.m - x.p > 0.01).sort((a, b) => (b.m - b.p) - (a.m - a.p)).slice(0, 2) : [];

  const [inteiro, cents] = num(ult.total, 2).split(',');

  return html`${cabecalho}
    ${pend.length ? html`
      <div class="note" role="note">${ic.relogio()}
        <span><b>Último fechamento: ${nomeMes(ult.mes.data)}${ult.mes.data.slice(0, 4) !== String(new Date().getFullYear()) ? ` de ${ult.mes.data.slice(0, 4)}` : ''}.</b>
        ${pend.length === 1 ? `Falta ${nomeMes(pend[0])}.` : `Faltam ${pend.length} meses (${pend.map(nomeMes).join(', ')}).`}</span>
        <a class="end" href="#/fechar">Começar por ${nomeMes(pend[0])}</a>
      </div>` : ''}

    <section class="card" aria-labelledby="h-pat">
      <div class="hero-top">
        <div>
          <div id="h-pat" class="eyebrow muted" style="font-size:13px;font-weight:500">Patrimônio em ${mesLongo(ult.mes.data).toLowerCase()}</div>
          <div class="big">R$&nbsp;${inteiro}<span class="cents">,${cents}</span></div>
          <div class="hero-sub">
            ${ult.varMes !== null ? html`<span class=${sinal(ult.varMes)} style="font-weight:600">${ult.varMes >= 0 ? '▲' : '▼'} ${brl(Math.abs(ult.varMes))} desde ${nomeMes(ls[ls.length - 2].mes.data)}</span>` : ''}
            <span>${brl(rendTotal)} de rendimento sobre ${brl(ult.aportado)} aportados</span>
          </div>
        </div>
        <div class="seg" role="group" aria-label="Período do gráfico">
          ${PERIODOS.map(([rot, m]) => html`<button type="button" aria-pressed=${periodo === m}
            @click=${() => { setPref('periodo', m); c.redesenhar(); }}>${rot}</button>`)}
        </div>
      </div>
      ${evolucao(vis)}
    </section>

    <div class="grid g4">
      <div class="card kpi">
        <div class="k">Rendimento em ${ano}</div>
        <div class="v ${sinal(rendAno)}">${brlS(rendAno)}</div>
        <div class="s">${twrAno ? `${pctS(twrAno.total)} no ano` : '—'}</div>
      </div>
      <div class="card kpi">
        <div class="k">Aportado em ${ano}</div>
        <div class="v">${brl(aporteAno)}</div>
        <div class="s">${retAno ? `${brl(retAno)} retirados` : 'dinheiro novo investido'}</div>
      </div>
      <div class="card kpi">
        <div class="k">Dividendos em ${ano}</div>
        <div class="v">${brl(divAno)}</div>
        <div class="s">${doAno.length ? `${brl(divAno / doAno.length)} por fechamento` : '—'}</div>
      </div>
      <div class="card kpi">
        <div class="k">Rentabilidade média</div>
        <div class="v">${t12 ? pctS(t12.mensal, 2) : '—'}</div>
        <div class="s">ao mês, nos últimos 12 meses</div>
      </div>
    </div>

    <div class="grid g2">
      <section class="card" aria-labelledby="h-aloc">
        <h2 id="h-aloc">Onde está o dinheiro</h2>
        <p class="cap">${temMetas ? 'Barra = hoje · traço = meta de vocês' : html`Composição hoje · <a href="#/metas">definir metas de alocação</a>`}</p>
        <div class="aloc">
          ${aloc.map((x) => html`
            <div class="aloc-row">
              <span>${x.nome}</span>
              <div class="bar" role="img" aria-label=${`${x.nome}: ${pct(x.p, 0)}${x.m ? `, meta ${pct(x.m, 0)}` : ''}`}>
                <i style="width:${(x.p / escala) * 100}%"></i>
                ${x.m ? html`<u style="left:${(x.m / escala) * 100}%"></u>` : ''}
              </div>
              <span class="r"><b>${pct(x.p, 0)}</b>${x.m ? ` · meta ${pct(x.m, 0)}` : html` · ${brl(x.v)}`}</span>
            </div>`)}
        </div>
        ${abaixo.length ? html`<p class="foot-note">Para se aproximar das metas, o próximo aporte iria para ${abaixo.map((x, i) => html`${i ? ' e ' : ''}<b>${x.nome}</b>`)}.</p>` : ''}
      </section>
      <section class="card" aria-labelledby="h-ap">
        <h2 id="h-ap">Aportes e rendimento</h2>
        <p class="cap">Últimos 12 fechamentos</p>
        ${aportesRend(ls)}
      </section>
    </div>`;
}
