import { html } from 'lit-html';
import { anual, CLASSES, LACUNA_DIAS, totalPorClasse } from '../calc';
import { excluirMes, salvarMes } from '../store';
import { anualChart } from './charts';
import { pref, setPref, type Ctx } from './ctx';
import { confirmar, toast } from './feedback';
import { brl, brlS, mesLongo, pctS, sinal } from './format';
import { ic } from './icons';

function baixar(nome: string, conteudo: string, tipo: string) {
  const u = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = u; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export function exportarCSV(c: Ctx) {
  const cab = ['Data', ...CLASSES.map((k) => k.nome), 'Total', 'Aporte', 'Retirada', 'Dividendos', 'Variação', 'Rendimento', 'Observação'];
  const n = (v: number | null) => (v == null ? '' : v.toFixed(2).replace('.', ','));
  const linhas = c.ls.map((l) => {
    const pc = totalPorClasse(l.mes, c.s.estado.ativos);
    return [l.mes.data, ...CLASSES.map((k) => n(pc[k.id])), n(l.total), n(l.mes.aporte), n(l.mes.retirada), n(l.mes.dividendos), n(l.varMes), n(l.rend),
      `"${(l.mes.obs || '').replace(/"/g, '""')}"`].join(';');
  });
  baixar(`nosso-patrimonio-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [cab.join(';'), ...linhas].join('\n'), 'text/csv');
}

async function excluir(c: Ctx, id: string) {
  const m = c.s.estado.meses.find((x) => x.id === id);
  if (!m) return;
  const ok = await confirmar('Excluir fechamento?', `O fechamento de ${mesLongo(m.data).toLowerCase()} será removido.`, 'Excluir', true);
  if (!ok) return;
  void excluirMes(id);
  toast(`Fechamento de ${mesLongo(m.data).toLowerCase()} excluído.`, { desfazer: () => void salvarMes(m) });
}

function verNota(titulo: string, texto: string) {
  const d = document.createElement('dialog');
  const h = document.createElement('h2'); h.textContent = titulo;
  const p = document.createElement('p'); p.textContent = texto; p.style.whiteSpace = 'pre-line';
  const acts = document.createElement('div'); acts.className = 'actions';
  const b = document.createElement('button'); b.className = 'btn ghost'; b.type = 'button'; b.textContent = 'Fechar'; b.onclick = () => d.close();
  acts.append(b); d.append(h, p, acts);
  d.addEventListener('close', () => d.remove());
  document.body.append(d); d.showModal();
}

export function relatorios(c: Ctx) {
  const aba = c.rota[1] === 'anual' ? 'anual' : 'historico';
  return html`
    <div class="page-head">
      <div><div class="eyebrow">Relatórios</div><h1>${aba === 'anual' ? 'Ano a ano' : 'Histórico mês a mês'}</h1></div>
      <div class="actions">
        <div class="seg" role="group" aria-label="Relatório">
          <button type="button" aria-pressed=${aba === 'historico'} @click=${() => c.ir('relatorios')}>Histórico</button>
          <button type="button" aria-pressed=${aba === 'anual'} @click=${() => c.ir('relatorios/anual')}>Ano a ano</button>
        </div>
        <button type="button" class="btn ghost sm" @click=${() => exportarCSV(c)}>Exportar planilha</button>
      </div>
    </div>
    ${aba === 'anual' ? anualView(c) : historico(c)}`;
}

function historico(c: Ctx) {
  const anos = [...new Set(c.ls.map((l) => l.mes.data.slice(0, 4)))].sort().reverse();
  const ano = pref<string>('histAno', 'todos');
  const rows = c.ls.slice().reverse().filter((l) => ano === 'todos' || l.mes.data.startsWith(ano));
  return html`
    <div style="display:flex;gap:10px;align-items:center">
      <label for="h-ano" class="muted" style="font-size:13px">Ano</label>
      <div class="inp" style="width:140px;min-height:38px"><select id="h-ano" @change=${(e: Event) => { setPref('histAno', (e.target as HTMLSelectElement).value); c.redesenhar(); }}>
        <option value="todos" ?selected=${ano === 'todos'}>Todos</option>
        ${anos.map((y) => html`<option value=${y} ?selected=${ano === y}>${y}</option>`)}
      </select></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Mês</th><th scope="col">Patrimônio</th><th scope="col">Variação</th><th scope="col">Retorno</th><th scope="col">Aporte</th><th scope="col">Retirada</th><th scope="col">Rendimento</th><th scope="col">Dividendos</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map((l) => {
            const gap = (l.dias ?? 0) > LACUNA_DIAS ? Math.round(l.dias! / 30.4) - 1 : 0;
            return html`<tr>
              <th scope="row" style="text-align:left;font-weight:500;background:none;text-transform:none;letter-spacing:0;font-size:14px;color:var(--ink);border-bottom:1px solid var(--line-soft)">
                ${mesLongo(l.mes.data)}${gap > 0 ? html`<span class="flag" title="Intervalo longo desde o fechamento anterior">${gap === 1 ? '1 mês' : `${gap} meses`} sem dados</span>` : ''}</th>
              <td>${brl(l.total)}</td>
              <td class=${sinal(l.varMes)}>${l.varMes === null ? '—' : brlS(l.varMes)}</td>
              <td class=${sinal(l.retorno)}>${pctS(l.retorno, 2)}</td>
              <td>${brl(l.mes.aporte)}</td>
              <td>${l.mes.retirada ? brl(l.mes.retirada) : html`<span class="muted">—</span>`}</td>
              <td class=${sinal(l.rend)}>${l.rend === null ? '—' : brlS(l.rend)}</td>
              <td>${brl(l.mes.dividendos)}</td>
              <td><span class="acts">
                ${l.mes.obs ? html`<button type="button" class="icon-btn" aria-label=${`Ver observação de ${mesLongo(l.mes.data)}`} @click=${() => verNota(`Observação — ${mesLongo(l.mes.data)}`, l.mes.obs)}>${ic.nota()}</button>` : ''}
                <a class="icon-btn" href=${`#/fechar/${l.mes.id}`} aria-label=${`Editar ${mesLongo(l.mes.data)}`}>${ic.editar()}</a>
                <button type="button" class="icon-btn del" aria-label=${`Excluir ${mesLongo(l.mes.data)}`} @click=${() => excluir(c, l.mes.id)}>${ic.lixo()}</button>
              </span></td>
            </tr>`;
          }) : html`<tr><td colspan="9"><div class="empty">Nenhum fechamento neste período.</div></td></tr>`}
        </tbody>
      </table>
    </div>
    <p class="tip">Retorno = rendimento ÷ patrimônio anterior, descontando aportes e retiradas. Retiradas não contam como prejuízo.</p>`;
}

function anualView(c: Ctx) {
  const anos = anual(c.ls);
  return html`
    <section class="card" aria-labelledby="h-an">
      <h2 id="h-an">De onde veio o crescimento</h2>
      <p class="cap">Em cada ano, quanto foi dinheiro novo e quanto a carteira rendeu</p>
      ${anualChart(anos)}
    </section>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Ano</th><th scope="col">Patrimônio no fim</th><th scope="col">Crescimento</th><th scope="col">%</th><th scope="col">Aportes</th><th scope="col">Retiradas</th><th scope="col">Rendimento</th><th scope="col">Dividendos</th></tr></thead>
        <tbody>
          ${anos.slice().reverse().map((a) => html`<tr>
            <td><span class="chip">${a.ano}</span>${a.emAndamento ? html` <span class="muted" style="font-size:12.5px">em andamento</span>` : ''}
              <div class="muted" style="font-size:12px">até ${mesLongo(a.ate).toLowerCase()}</div></td>
            <td>${brl(a.fim)}</td>
            <td class=${sinal(a.ganho)}>${a.ganho === null ? '—' : brlS(a.ganho)}</td>
            <td class=${sinal(a.perc)}>${pctS(a.perc)}</td>
            <td>${brl(a.aportes)}</td>
            <td>${a.retiradas ? brl(a.retiradas) : html`<span class="muted">—</span>`}</td>
            <td class=${sinal(a.rendimento)}>${brlS(a.rendimento)}</td>
            <td>${brl(a.dividendos)}</td>
          </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="tip">Crescimento = patrimônio no último fechamento do ano − último fechamento do ano anterior.</p>`;
}
