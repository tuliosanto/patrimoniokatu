import { html, render } from 'lit-html';
import { linhas, mesesPendentes } from './calc';
import { aoMudarUsuario, entrar, iniciar, mensagemLogin, ouvir, snapshot, type Snapshot } from './store';
import './styles/app.css';
import { ajustes, aplicarTema } from './ui/ajustes';
import { carteira } from './ui/carteira';
import type { Ctx } from './ui/ctx';
import { descartarFechamento, fechamentoSujo, fechar } from './ui/fechar';
import { ic } from './ui/icons';
import { inicio } from './ui/inicio';
import { metas } from './ui/metas';
import { relatorios } from './ui/relatorios';

aplicarTema();
const raiz = document.getElementById('app')!;
// o lit-html acrescenta ao que existe: tira o "Carregando…" estático do index.html
raiz.textContent = '';

const TELAS = {
  inicio: { nome: 'Início', icone: ic.inicio, view: inicio },
  fechar: { nome: 'Fechar mês', icone: ic.fechar, view: fechar },
  carteira: { nome: 'Carteira', icone: ic.carteira, view: carteira },
  relatorios: { nome: 'Relatórios', icone: ic.relatorios, view: relatorios },
  metas: { nome: 'Metas', icone: ic.metas, view: metas },
  ajustes: { nome: 'Ajustes e backup', icone: ic.ajustes, view: ajustes },
} as const;
type Tela = keyof typeof TELAS;

const rota = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('/');
const ir = (r: string) => { location.hash = '#/' + r; };

/* ---------------- Login ---------------- */

let erroLogin = '';
let entrando = false;
function telaLogin() {
  const enviar = async (e: Event) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const email = (f.elements.namedItem('email') as HTMLInputElement).value.trim();
    const senha = (f.elements.namedItem('senha') as HTMLInputElement).value;
    if (!email || !senha) { erroLogin = 'Preencha e-mail e senha.'; return desenhar(); }
    entrando = true; erroLogin = ''; desenhar();
    try { await entrar(email, senha); }
    catch (err) { erroLogin = mensagemLogin((err as { code?: string }).code ?? ''); }
    finally { entrando = false; desenhar(); }
  };
  render(html`
    <main class="login">
      <form class="card" @submit=${enviar} novalidate style="padding:32px">
        <div class="brand"><span class="mark">${ic.logo()}</span>Nosso Patrimônio</div>
        <h1 style="font-size:22px">Entrar</h1>
        <div class="field"><label for="l-email">E-mail</label>
          <div class="inp"><input id="l-email" name="email" type="email" autocomplete="username" spellcheck="false" required></div></div>
        <div class="field"><label for="l-senha">Senha</label>
          <div class="inp"><input id="l-senha" name="senha" type="password" autocomplete="current-password" required></div></div>
        ${erroLogin ? html`<p class="err-msg" role="alert">${erroLogin}</p>` : ''}
        <button class="btn" type="submit" ?disabled=${entrando}>${entrando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>`, raiz);
}

/* ---------------- App ---------------- */

let logado = false;
function desenhar() {
  if (!logado) return telaLogin();
  const s: Snapshot = snapshot();
  const r = rota();
  const tela: Tela = (r[0] in TELAS ? r[0] : 'inicio') as Tela;
  const ctx: Ctx = { s, ls: linhas(s.estado.meses), rota: r, ir, redesenhar: desenhar };
  const pend = mesesPendentes(s.estado.meses).length;
  const syncTxt = { carregando: 'Carregando…', salvo: 'Salvo na nuvem', salvando: 'Salvando…', offline: 'Sem internet — salvo neste aparelho', erro: 'Erro de conexão' }[s.sync];

  const conteudo = s.sync === 'erro' && !s.pronto
    ? html`<div class="note err" role="alert">${ic.alerta()}<span>${s.erro}</span></div>`
    : !s.pronto ? html`<div class="empty">Carregando os dados…</div>`
    : TELAS[tela].view(ctx);

  render(html`
    <a class="skip" href="#conteudo">Pular para o conteúdo</a>
    <div class="shell">
      <nav class="side" aria-label="Principal">
        <div class="brand"><span class="mark">${ic.logo()}</span>Nosso Patrimônio</div>
        <div class="nav">
          ${(['inicio', 'fechar', 'carteira', 'relatorios', 'metas'] as Tela[]).map((t) => html`
            <a href=${'#/' + t} aria-current=${tela === t ? 'page' : 'false'}>${TELAS[t].icone()}${TELAS[t].nome}
              ${t === 'fechar' && pend ? html`<span class="badge" aria-label=${`${pend} meses pendentes`}>${pend}</span>` : ''}</a>`)}
        </div>
        <div class="side-foot">
          <div class="nav"><a href="#/ajustes" aria-current=${tela === 'ajustes' ? 'page' : 'false'}>${ic.ajustes()}Ajustes e backup</a></div>
          <div class="sync ${s.sync}" role="status" title=${s.erro ?? ''}>${syncTxt}</div>
        </div>
      </nav>
      <main id="conteudo" class="content" tabindex="-1">
        ${s.sync === 'erro' && s.pronto ? html`<div class="note err" role="alert">${ic.alerta()}<span>${s.erro}</span></div>` : ''}
        ${conteudo}
      </main>
    </div>`, raiz);
}

/* Sair do fechamento com alterações não salvas pede confirmação. */
let rotaAnterior = location.hash;
window.addEventListener('hashchange', () => {
  const saindo = rotaAnterior.startsWith('#/fechar') && !location.hash.startsWith(rotaAnterior.split('/').slice(0, 3).join('/'));
  if (saindo && fechamentoSujo()) {
    if (!confirm('O fechamento tem alterações não salvas. Sair e descartá-las?')) {
      history.replaceState(null, '', rotaAnterior);
      return;
    }
    descartarFechamento();
  }
  rotaAnterior = location.hash;
  desenhar();
  window.scrollTo({ top: 0 });
  document.getElementById('conteudo')?.focus({ preventScroll: true });
});
window.addEventListener('beforeunload', (e) => { if (fechamentoSujo()) e.preventDefault(); });

ouvir(() => desenhar());
aoMudarUsuario((u) => {
  logado = !!u;
  desenhar();
  if (u) void iniciar();
});
