import { html } from 'lit-html';
import { CLASSES, totalMes } from '../calc';
import { salvarAtivo } from '../store';
import type { Ativo, ClasseId } from '../types';
import { pref, setPref, type Ctx } from './ctx';
import { toast } from './feedback';
import { brl, lerNum, mesLongo, num, pct, uid } from './format';
import { ic } from './icons';

/* Cadastro dos investimentos: o que vocês têm, em que classe, e a posição no último fechamento. */

function editar(c: Ctx, a: Ativo | null, classe: ClasseId) {
  const k = CLASSES.find((x) => x.id === (a?.classe ?? classe))!;
  const d = document.createElement('dialog');
  d.innerHTML = `
    <form method="dialog">
      <h2>${a ? 'Editar ativo' : `Novo ativo em ${k.nome}`}</h2>
      <div class="form-grid" style="margin-top:14px">
        <div class="field" style="grid-column:1/-1"><label for="a-nome">Nome</label>
          <div class="inp"><input id="a-nome" name="nome" required autocomplete="off" placeholder="${k.cotada ? 'ex.: PETR4…' : 'ex.: CDB Banco X 110% CDI…'}"></div></div>
        ${k.cotada ? `
        <div class="field"><label for="a-tk">Código <span class="hint">para cotação automática</span></label>
          <div class="inp"><input id="a-tk" name="ticker" autocomplete="off" spellcheck="false"></div></div>
        <div class="field"><label for="a-q">${k.id === 'dolar' ? 'Quantidade em US$' : 'Quantidade atual'}</label>
          <div class="inp"><input id="a-q" name="q" class="num" inputmode="decimal"></div></div>` : ''}
        ${k.id === 'cdb' ? `
        <div class="field"><label for="a-cdi">Rende quanto do CDI? <span class="hint">para a sugestão no fechamento</span></label>
          <div class="inp"><input id="a-cdi" name="cdi" class="num" inputmode="decimal" placeholder="100"><span class="suf">%</span></div></div>` : ''}
        <div class="field"><label for="a-cls">Classe</label>
          <div class="inp"><select id="a-cls" name="classe">${CLASSES.map((x) => `<option value="${x.id}">${x.nome}</option>`).join('')}</select></div></div>
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" value="cancel">Cancelar</button>
        <button type="submit" class="btn" value="ok">Salvar</button>
      </div>
    </form>`;
  const f = d.querySelector('form')!;
  (f.elements.namedItem('nome') as HTMLInputElement).value = a?.nome ?? '';
  (f.elements.namedItem('classe') as HTMLSelectElement).value = k.id;
  const tk = f.elements.namedItem('ticker') as HTMLInputElement | null;
  const q = f.elements.namedItem('q') as HTMLInputElement | null;
  if (tk) tk.value = a?.ticker ?? '';
  const cdiEl = f.elements.namedItem('cdi') as HTMLInputElement | null;
  if (cdiEl && a?.taxaCdi) cdiEl.value = num(a.taxaCdi, a.taxaCdi % 1 ? 1 : 0);
  if (q) q.value = a?.q ? num(a.q, a.q % 1 ? 8 : 0).replace(/(,\d*?)0+$/, '$1').replace(/,$/, '') : '';
  d.querySelector<HTMLButtonElement>('button[value=cancel]')!.onclick = () => d.close();
  f.onsubmit = (e) => {
    e.preventDefault();
    const nome = (f.elements.namedItem('nome') as HTMLInputElement).value.trim();
    if (!nome) return;
    const cl = (f.elements.namedItem('classe') as HTMLSelectElement).value as ClasseId;
    const novo: Ativo = {
      ...(a ?? { id: uid(), criadoEm: Date.now() }),
      nome, classe: cl,
      ticker: tk ? tk.value.trim().toUpperCase() || undefined : a?.ticker,
      q: q ? lerNum(q.value) : a?.q,
      taxaCdi: cdiEl ? lerNum(cdiEl.value) || undefined : a?.taxaCdi,
    };
    void salvarAtivo(novo);
    toast(a ? 'Ativo atualizado.' : `${nome} adicionado à carteira.`);
    d.close();
  };
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  c.redesenhar();
}

function arquivar(a: Ativo, valor: boolean) {
  void salvarAtivo({ ...a, arquivado: valor });
  toast(valor ? `${a.nome} arquivado: sai dos próximos fechamentos, o histórico fica.` : `${a.nome} voltou para a carteira.`,
    { desfazer: () => void salvarAtivo({ ...a, arquivado: !valor }) });
}

export function carteira(c: Ctx) {
  const ult = c.ls[c.ls.length - 1]?.mes;
  const total = ult ? totalMes(ult) : 0;
  const verArq = pref('verArquivados', false);
  const ativos = c.s.estado.ativos;

  return html`
    <div class="page-head">
      <div><div class="eyebrow">Carteira</div><h1>O que vocês têm</h1></div>
      <div class="actions">
        <button type="button" class="btn ghost sm" aria-pressed=${verArq} @click=${() => { setPref('verArquivados', !verArq); c.redesenhar(); }}>
          ${verArq ? 'Esconder arquivados' : 'Mostrar arquivados'}</button>
      </div>
    </div>
    <p class="tip">Posições ${ult ? `do fechamento de ${mesLongo(ult.data).toLowerCase()}` : '—'}. Cada ativo ganha um campo próprio no fechamento do mês.</p>
    ${CLASSES.map((k) => {
      const xs = ativos.filter((a) => a.classe === k.id && (verArq || !a.arquivado || a.legado))
        .map((a) => ({ a, v: ult?.posicoes[a.id]?.v ?? 0, q: ult?.posicoes[a.id]?.q ?? a.q }))
        .filter((x) => !x.a.legado || x.v)
        .sort((x, y) => y.v - x.v || x.a.nome.localeCompare(y.a.nome, 'pt-BR'));
      const soma = xs.reduce((t, x) => t + x.v, 0);
      return html`
        <section class="card" aria-labelledby=${'cl-' + k.id} style="padding:18px 24px">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <h2 id=${'cl-' + k.id}>${k.nome}</h2>
            <span class="muted" style="font-size:13px">${((n) => (n === 1 ? '1 ativo' : `${n} ativos`))(xs.filter((x) => !x.a.legado).length)}</span>
            <span style="margin-left:auto;font-weight:600">${brl(soma)}</span>
            <span class="muted" style="font-size:13px;width:52px;text-align:right">${pct(total ? soma / total : 0, 0)}</span>
            <button type="button" class="btn sm ghost" @click=${() => editar(c, null, k.id)}>${ic.mais(14)}Adicionar</button>
          </div>
          ${xs.length ? html`<div style="margin-top:8px">
            ${xs.map(({ a, v, q }) => html`
              <div class="ativo-row">
                <span class="nm" title=${a.nome}>${a.legado ? html`<i class="muted">Não detalhado</i>` : a.nome}
                  ${a.ticker && a.ticker !== a.nome ? html`<small>${a.ticker}</small>` : ''}${a.arquivado ? html`<small>arquivado</small>` : ''}</span>
                <span class="r muted hide-sm">${k.cotada && q ? (k.id === 'dolar' ? `US$ ${num(q, 2)}` : `${num(q, q % 1 ? 4 : 0)} un.`) : ''}</span>
                <span class="r">${v ? brl(v) : html`<span class="muted">—</span>`}</span>
                <span class="r muted hide-sm">${total && v ? pct(v / total) : ''}</span>
                <span class="r">${a.legado ? html`<span class="muted" style="font-size:12.5px" title="Valor antigo ainda não separado em ativos. Separe no próximo fechamento.">separar no fechamento</span>` : html`
                  <button type="button" class="icon-btn" aria-label=${`Editar ${a.nome}`} @click=${() => editar(c, a, a.classe)}>${ic.editar()}</button>
                  <button type="button" class="icon-btn" aria-label=${a.arquivado ? `Desarquivar ${a.nome}` : `Arquivar ${a.nome}`} @click=${() => arquivar(a, !a.arquivado)}>${ic.arquivar()}</button>`}</span>
              </div>`)}</div>` : html`<p class="tip" style="margin-top:8px">Nenhum ativo cadastrado.</p>`}
        </section>`;
    })}`;
}
