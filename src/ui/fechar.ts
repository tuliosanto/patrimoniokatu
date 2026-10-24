import { html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { CLASSES, mesesPendentes, totalMes, totalPorClasse } from '../calc';
import { idLegado } from '../migrate';
import { excluirMes, salvarAtivo, salvarMes } from '../store';
import type { Ativo, ClasseId, Mes, Posicao } from '../types';
import type { Ctx } from './ctx';
import { brl, brlS, lerNum, mesLongo, nomeMes, num, paraCampo, pctS, sinal, uid } from './format';
import { confirmar, toast } from './feedback';
import { ic } from './icons';

/* Rascunho do fechamento: guarda o texto como foi digitado (para o cursor
   nunca pular) e só converte para número ao calcular ou salvar. */
interface Rascunho {
  chave: string;
  alvo: string;            // AAAA-MM
  editando?: string;       // id do mês, se for edição
  data: string;
  v: Record<string, string>;
  q: Record<string, string>;
  p: Record<string, string>;
  /** Classes que ainda têm valor "não detalhado": o total da classe é digitado e o resto é calculado. */
  totCls: Partial<Record<ClasseId, string>>;
  aporte: string; retirada: string; dividendos: string; obs: string;
  copiadoDe?: string;
  sujo: boolean;
  erro?: string;
  novo: Partial<Record<ClasseId, { nome: string; q: string }>>;
}
let r: Rascunho | null = null;
export const fechamentoSujo = () => !!r?.sujo;
export const descartarFechamento = () => { r = null; };

const hojeISO = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => hojeISO().slice(0, 7);
function ultimoDia(id: string) {
  const d = new Date(Date.UTC(+id.slice(0, 4), +id.slice(5, 7), 0));
  return d.toISOString().slice(0, 10);
}

function alvoDaRota(c: Ctx): string {
  const pedido = c.rota[1];
  if (pedido && /^\d{4}-\d{2}$/.test(pedido)) return pedido;
  return mesesPendentes(c.s.estado.meses)[0] ?? mesAtual();
}

function iniciar(c: Ctx, alvo: string): Rascunho {
  const meses = c.s.estado.meses;
  const existente = meses.find((m) => m.id === alvo);
  const anterior = [...meses].filter((m) => m.id < alvo).pop();
  const base: Mes | undefined = existente ?? anterior;
  const ativos = c.s.estado.ativos;
  const rr: Rascunho = {
    chave: (existente ? 'ed:' : 'novo:') + alvo,
    alvo,
    editando: existente?.id,
    data: existente?.data ?? (alvo < mesAtual() ? ultimoDia(alvo) : hojeISO()),
    v: {}, q: {}, p: {}, totCls: {},
    aporte: existente ? paraCampo(existente.aporte) : '',
    retirada: existente ? paraCampo(existente.retirada) : '',
    dividendos: existente ? paraCampo(existente.dividendos) : '',
    obs: existente?.obs ?? '',
    copiadoDe: !existente && anterior ? anterior.id : undefined,
    sujo: false,
    novo: {},
  };
  for (const a of ativos) {
    if (a.legado) continue;
    const pos = base?.posicoes[a.id];
    const k = CLASSES.find((x) => x.id === a.classe)!;
    if (pos) rr.v[a.id] = paraCampo(pos.v);
    if (k.cotada) {
      const q = pos?.q ?? a.q;
      if (q) rr.q[a.id] = q % 1 ? num(q, 8).replace(/0+$/, '') : num(q, 0);
      const p = pos?.p ?? (pos?.v && q ? pos.v / q : undefined);
      if (p) rr.p[a.id] = paraCampo(p);
    }
  }
  if (base) {
    const porClasse = totalPorClasse(base, ativos);
    for (const k of CLASSES) {
      if ((base.posicoes[idLegado(k.id)]?.v ?? 0) > 0) rr.totCls[k.id] = paraCampo(porClasse[k.id]);
    }
  }
  return rr;
}

const visiveis = (ativos: Ativo[], classe: ClasseId, rr: Rascunho) =>
  ativos.filter((a) => a.classe === classe && !a.legado && (!a.arquivado || lerNum(rr.v[a.id])))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

function contas(c: Ctx, rr: Rascunho) {
  const ativos = c.s.estado.ativos;
  const cls = CLASSES.map((k) => {
    const lin = visiveis(ativos, k.id, rr);
    const soma = Math.round(lin.reduce((t, a) => t + lerNum(rr.v[a.id]), 0) * 100) / 100;
    const parcial = rr.totCls[k.id] !== undefined;
    const tot = parcial ? lerNum(rr.totCls[k.id]) : soma;
    return { k, lin, soma, parcial, tot, resto: parcial ? Math.round((tot - soma) * 100) / 100 : 0 };
  });
  const total = cls.reduce((t, x) => t + x.tot, 0);
  const anterior = [...c.s.estado.meses].filter((m) => m.data < rr.data && m.id !== rr.editando).pop();
  const totAnt = anterior ? totalMes(anterior) : null;
  const varMes = totAnt === null || !total ? null : total - totAnt;
  const fluxo = lerNum(rr.aporte) - lerNum(rr.retirada);
  return { cls, total, anterior, varMes, rend: varMes === null ? null : varMes - fluxo };
}

async function salvar(c: Ctx) {
  const rr = r!;
  const { cls, anterior, rend } = contas(c, rr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rr.data)) { rr.erro = 'Escolha a data do fechamento.'; return c.redesenhar(); }
  const id = rr.data.slice(0, 7);
  if (id !== rr.editando && c.s.estado.meses.some((m) => m.id === id)) {
    rr.erro = `Já existe o fechamento de ${mesLongo(id).toLowerCase()}. Para mudá-lo, abra-o em Relatórios → Histórico.`;
    return c.redesenhar();
  }
  const excede = cls.find((x) => x.resto < -0.004);
  if (excede) {
    rr.erro = `Em ${excede.k.nome}, os itens somam ${brl(excede.soma, 2)}, mais que o total da classe (${brl(excede.tot, 2)}). Ajuste o total ou os itens.`;
    return c.redesenhar();
  }
  // queda grande quase sempre é campo esquecido (ex.: zerou o "não detalhado" antes de preencher os preços)
  const totAnt = anterior ? totalMes(anterior) : 0;
  if (rend !== null && totAnt && rend < -0.1 * totAnt) {
    const ok = await confirmar('Conferir antes de salvar',
      `Este fechamento mostra rendimento de ${brlS(rend)} (${pctS(rend / totAnt)}). Se não houve uma queda real desse tamanho, provavelmente falta preencher algum valor.`,
      'Salvar assim mesmo');
    if (!ok) return;
  }
  const posicoes: Record<string, Posicao> = {};
  for (const x of cls) {
    for (const a of x.lin) {
      const v = lerNum(rr.v[a.id]);
      const q = lerNum(rr.q[a.id]);
      if (!v && !q) continue;
      const p = lerNum(rr.p[a.id]);
      posicoes[a.id] = { v: Math.round(v * 100) / 100, ...(x.k.cotada && q ? { q } : {}), ...(p ? { p } : {}) };
    }
    if (x.resto > 0.004) posicoes[idLegado(x.k.id)] = { v: x.resto };
  }
  const antigo = c.s.estado.meses.find((m) => m.id === rr.editando);
  const mes: Mes = {
    id, data: rr.data, posicoes,
    aporte: lerNum(rr.aporte), retirada: lerNum(rr.retirada), dividendos: lerNum(rr.dividendos),
    obs: rr.obs.trim(), cotacoes: antigo?.cotacoes ?? {},
    ...(antigo?.quantidades ? { quantidades: antigo.quantidades } : {}),
  };
  try {
    const gravacoes: Promise<unknown>[] = [salvarMes(mes)];
    if (rr.editando && rr.editando !== id) gravacoes.push(excluirMes(rr.editando));
    // fechamento mais recente: as quantidades digitadas viram a posição atual da carteira
    const maisRecente = c.s.estado.meses.every((m) => m.id <= id || m.id === rr.editando);
    if (maisRecente) {
      for (const a of c.s.estado.ativos) {
        const q = posicoes[a.id]?.q;
        if (q != null && q !== a.q) gravacoes.push(salvarAtivo({ ...a, q }));
      }
    }
    // offline, as promessas só resolvem ao sincronizar; o cache local já tem tudo
    void Promise.all(gravacoes).catch((e) => { console.error(e); toast('Falha ao sincronizar o fechamento. Ele continua salvo neste aparelho; tente de novo com internet.', { erro: true }); });
    toast(`Fechamento de ${nomeMes(id)} salvo.`);
    r = null;
    c.ir('inicio');
  } catch (e) {
    console.error(e);
    rr.erro = 'Não foi possível salvar. Tente de novo.';
    c.redesenhar();
  }
}

export function fechar(c: Ctx) {
  if (!c.s.pronto) return html``;
  const alvo = alvoDaRota(c);
  const chave = (c.s.estado.meses.some((m) => m.id === alvo) ? 'ed:' : 'novo:') + alvo;
  if (!r || r.alvo !== alvo || (r.chave !== chave && !r.sujo)) r = iniciar(c, alvo);
  const rr = r;
  const conta = contas(c, rr);
  const set = (fn: () => void) => { fn(); rr.sujo = true; rr.erro = undefined; c.redesenhar(); };
  const txt = (e: Event) => (e.target as HTMLInputElement).value;

  const cotacao = (a: Ativo, campo: 'q' | 'p' | 'v', val: string) => set(() => {
    rr[campo][a.id] = val;
    const q = lerNum(rr.q[a.id]);
    if (campo === 'v') { const v = lerNum(val); rr.p[a.id] = q && v ? paraCampo(v / q) : ''; }
    else { const p = lerNum(rr.p[a.id]); if (q && p) rr.v[a.id] = paraCampo(q * p); else if (campo === 'q' && !q) rr.v[a.id] = ''; }
  });

  const adicionar = async (classe: ClasseId) => {
    const n = rr.novo[classe];
    const nome = n?.nome.trim();
    if (!nome) return;
    const k = CLASSES.find((x) => x.id === classe)!;
    const a: Ativo = { id: uid(), nome, classe, criadoEm: Date.now(), ...(k.cotada ? { ticker: nome.toUpperCase(), q: lerNum(n!.q) } : {}) };
    if (k.cotada && a.q) rr.q[a.id] = n!.q;
    rr.novo[classe] = { nome: '', q: '' };
    rr.sujo = true;
    void salvarAtivo(a);
    c.redesenhar();
  };

  const titulo = rr.editando ? `Editando ${mesLongo(rr.alvo).toLowerCase()}` : `Fechamento de ${mesLongo(rr.alvo).toLowerCase()}`;

  return html`
    <div class="page-head">
      <div><div class="eyebrow">Fechar mês</div><h1>${titulo}</h1></div>
    </div>
    ${rr.copiadoDe ? html`<p class="tip">Valores copiados de ${mesLongo(rr.copiadoDe).toLowerCase()}. Ajuste só o que mudou.</p>` : ''}

    <div class="card" style="padding:20px 24px">
      <div class="form-grid">
        <div class="field" style="max-width:240px">
          <label for="f-data">Data do fechamento</label>
          <div class="inp"><input id="f-data" type="date" .value=${live(rr.data)} @input=${(e: Event) => set(() => (rr.data = txt(e)))}></div>
        </div>
      </div>
    </div>

    <section aria-label="Onde está o dinheiro">
      ${conta.cls.map((x) => {
        const cot = x.k.cotada;
        const n = rr.novo[x.k.id] ?? { nome: '', q: '' };
        const status = !x.parcial ? null
          : x.resto > 0.004 ? html`<span class="status falta">falta separar ${brl(x.resto, 2)}</span>`
          : x.resto < -0.004 ? html`<span class="status excede">itens excedem ${brl(-x.resto, 2)}</span>`
          : html`<span class="status ok">tudo detalhado</span>`;
        return html`
          <div class="cls">
            <div class="cls-head">
              <h3>${x.k.nome}</h3>${status}
              <span class="tot">${brl(x.tot, 2)}</span>
            </div>
            <div class="cls-body">
              ${x.lin.length ? html`
                <div class="row-h ${cot ? 'cot' : ''}" aria-hidden="true"><span>Ativo</span>${cot ? html`<span>Qtd</span><span>Preço</span>` : ''}<span>Valor</span></div>
                ${x.lin.map((a) => html`
                  <div class="row-a ${cot ? 'cot' : ''}">
                    <span class="nome" title=${a.nome}>${a.nome}${a.arquivado ? html`<small>arquivado</small>` : ''}</span>
                    ${cot ? html`
                      <div class="inp"><input class="num" inputmode="decimal" aria-label=${`Quantidade de ${a.nome}`} .value=${live(rr.q[a.id] ?? '')} @input=${(e: Event) => cotacao(a, 'q', txt(e))}></div>
                      <div class="inp"><span class="pre">R$</span><input class="num" inputmode="decimal" placeholder="0,00" aria-label=${`Preço de ${a.nome}`} .value=${live(rr.p[a.id] ?? '')} @input=${(e: Event) => cotacao(a, 'p', txt(e))}></div>` : ''}
                    <div class="inp"><span class="pre">R$</span><input class="num" inputmode="decimal" placeholder="0,00" aria-label=${`Valor de ${a.nome}`} .value=${live(rr.v[a.id] ?? '')} @input=${(e: Event) => (cot ? cotacao(a, 'v', txt(e)) : set(() => (rr.v[a.id] = txt(e))))}></div>
                  </div>`)}` : ''}
              ${x.parcial ? html`
                <div class="row-a ${cot ? 'cot' : ''} legado">
                  <span class="nome">Não detalhado</span>${cot ? html`<span></span><span></span>` : ''}
                  <div class="inp ro"><span class="pre">R$</span><input class="num" readonly tabindex="-1" aria-label=${`${x.k.nome} não detalhado`} .value=${num(x.resto, 2)}></div>
                </div>
                <div class="row-a" style="margin-top:4px">
                  <label class="nome" for=${'tot-' + x.k.id} style="color:var(--ink-2)">Total da classe <small>o que está na corretora ou no banco</small></label>
                  <div class="inp"><span class="pre">R$</span><input id=${'tot-' + x.k.id} class="num" inputmode="decimal" .value=${live(rr.totCls[x.k.id] ?? '')} @input=${(e: Event) => set(() => (rr.totCls[x.k.id] = txt(e)))}></div>
                </div>` : ''}
              <div class="cls-foot">
                <div class="inp" style="flex:1 1 200px;min-height:36px"><input placeholder=${cot ? 'Novo papel (ex.: PETR4)…' : `Novo item de ${x.k.nome} (ex.: CDB Banco X)…`}
                  aria-label=${`Nome do novo ativo de ${x.k.nome}`} .value=${live(n.nome)}
                  @input=${(e: Event) => { rr.novo[x.k.id] = { ...n, nome: txt(e) }; }}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(x.k.id); } }}></div>
                ${cot ? html`<div class="inp" style="flex:0 1 110px;min-height:36px"><input class="num" placeholder="Qtd" inputmode="decimal" aria-label="Quantidade" .value=${live(n.q)} @input=${(e: Event) => { rr.novo[x.k.id] = { ...n, q: txt(e) }; }}></div>` : ''}
                <button type="button" class="btn sm ghost" @click=${() => adicionar(x.k.id)}>${ic.mais(14)}Adicionar</button>
                ${x.parcial && x.resto > 0.004 && x.lin.length ? html`<button type="button" class="btn link" @click=${() => set(() => (rr.totCls[x.k.id] = paraCampo(x.soma)))}>Já detalhei tudo: zerar “não detalhado”</button>` : ''}
              </div>
            </div>
          </div>`;
      })}
    </section>

    <section class="card" aria-labelledby="h-mov">
      <h2 id="h-mov">Movimentação do mês</h2>
      <p class="cap">Separar aportes e retiradas é o que permite saber quanto a carteira rendeu sozinha.</p>
      <div class="form-grid">
        <div class="field"><label for="f-ap">Aporte <span class="hint">dinheiro novo investido</span></label>
          <div class="inp"><span class="pre">R$</span><input id="f-ap" class="num" inputmode="decimal" placeholder="0,00" .value=${live(rr.aporte)} @input=${(e: Event) => set(() => (rr.aporte = txt(e)))}></div></div>
        <div class="field"><label for="f-ret">Retirada <span class="hint">dinheiro que saiu da carteira</span></label>
          <div class="inp"><span class="pre">R$</span><input id="f-ret" class="num" inputmode="decimal" placeholder="0,00" .value=${live(rr.retirada)} @input=${(e: Event) => set(() => (rr.retirada = txt(e)))}></div></div>
        <div class="field"><label for="f-div">Dividendos recebidos</label>
          <div class="inp"><span class="pre">R$</span><input id="f-div" class="num" inputmode="decimal" placeholder="0,00" .value=${live(rr.dividendos)} @input=${(e: Event) => set(() => (rr.dividendos = txt(e)))}></div></div>
      </div>
      <div class="field" style="margin-top:16px"><label for="f-obs">Observação <span class="hint">opcional — ex.: resgatei para uma viagem…</span></label>
        <div class="inp"><textarea id="f-obs" rows="2" .value=${live(rr.obs)} @input=${(e: Event) => set(() => (rr.obs = txt(e)))}></textarea></div></div>
    </section>

    ${rr.erro ? html`<div class="note err" role="alert">${ic.alerta()}<span>${rr.erro}</span></div>` : ''}

    <div class="resumo" aria-live="polite">
      <div class="it"><div class="k">Total</div><div class="v">${brl(conta.total)}</div></div>
      <div class="it"><div class="k">Variação${conta.anterior ? ` desde ${nomeMes(conta.anterior.id)}` : ''}</div><div class="v ${sinal(conta.varMes)}">${conta.varMes === null ? '—' : brlS(conta.varMes)}</div></div>
      <div class="it"><div class="k">Rendimento</div><div class="v ${sinal(conta.rend)}">${conta.rend === null ? '—' : brlS(conta.rend)}</div></div>
      <div class="actions">
        ${rr.editando ? html`<a class="btn ghost" href="#/relatorios" @click=${() => { r = null; }}>Cancelar</a>` : ''}
        <button type="button" class="btn" @click=${() => salvar(c)}>Salvar fechamento</button>
      </div>
    </div>`;
}
