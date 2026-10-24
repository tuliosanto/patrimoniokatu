import { html } from 'lit-html';
import { ehLegado, ehSeed, migrar } from '../migrate';
import { importarSeed, restaurar, sair, usuario } from '../store';
import type { Estado } from '../types';
import { pref, setPref, type Ctx } from './ctx';
import { confirmar, toast } from './feedback';
import { exportarCSV } from './relatorios';

export type Tema = 'sistema' | 'claro' | 'escuro';
export function aplicarTema(t: Tema = pref<Tema>('tema', 'sistema')) {
  const el = document.documentElement;
  if (t === 'sistema') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t === 'escuro' ? 'dark' : 'light');
}

function baixarBackup(e: Estado) {
  const u = URL.createObjectURL(new Blob([JSON.stringify({ formato: 'nosso-patrimonio', versao: 2, ...e }, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = u; a.download = `nosso-patrimonio-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
  toast('Backup baixado. Guarde-o fora do computador também (Drive, e-mail).');
}

const ehNovo = (x: any): x is Estado => x && Array.isArray(x.ativos) && Array.isArray(x.meses);

async function importar(c: Ctx, f: File) {
  let d: unknown;
  try { d = JSON.parse(await f.text()); } catch { return toast('Arquivo inválido: não é um JSON.', { erro: true }); }
  if (ehSeed(d)) {
    const n = await importarSeed(d);
    return toast(n ? `Histórico de quantidades aplicado a ${n} fechamentos.` : 'Nenhum fechamento com a mesma data foi encontrado.');
  }
  const estado = ehNovo(d) ? { ativos: d.ativos, meses: d.meses, config: d.config ?? { metas: {}, versao: 2 } } : ehLegado(d) ? migrar(d) : null;
  if (!estado) return toast('Arquivo não reconhecido como backup do Nosso Patrimônio.', { erro: true });
  const atual = c.s.estado.meses.length;
  const ok = await confirmar('Restaurar backup?',
    `Os ${atual} fechamentos atuais serão substituídos pelos ${estado.meses.length} do arquivo. Uma cópia do estado atual fica guardada na nuvem antes.`,
    'Restaurar', true);
  if (!ok) return;
  try {
    await restaurar(estado);
    toast(`Backup restaurado: ${estado.meses.length} fechamentos.`);
    c.ir('inicio');
  } catch (e) {
    console.error(e);
    toast('Não foi possível restaurar. Verifique a internet e tente de novo.', { erro: true });
  }
}

export function ajustes(c: Ctx) {
  const tema = pref<Tema>('tema', 'sistema');
  const temas: [Tema, string][] = [['sistema', 'Igual ao sistema'], ['claro', 'Claro'], ['escuro', 'Escuro']];
  return html`
    <div class="page-head"><div><div class="eyebrow">Ajustes</div><h1>Ajustes e backup</h1></div></div>

    <section class="card" aria-labelledby="h-tema">
      <h2 id="h-tema">Aparência</h2>
      <p class="cap">Vale só para este aparelho.</p>
      <div class="seg" role="group" aria-label="Tema">
        ${temas.map(([t, rot]) => html`<button type="button" aria-pressed=${tema === t} @click=${() => { setPref('tema', t); aplicarTema(t); c.redesenhar(); }}>${rot}</button>`)}
      </div>
    </section>

    <section class="card" aria-labelledby="h-bk">
      <h2 id="h-bk">Backup</h2>
      <p class="cap">Os dados ficam na nuvem, acessíveis só pelas contas de vocês, e uma cópia completa é guardada lá automaticamente todo mês. Mesmo assim, baixe um backup de vez em quando.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn" @click=${() => baixarBackup(c.s.estado)}>Baixar backup (.json)</button>
        <button type="button" class="btn ghost" @click=${() => exportarCSV(c)}>Exportar planilha (.csv)</button>
        <label class="btn ghost" style="position:relative">Restaurar ou importar arquivo…
          <input type="file" accept=".json,application/json" class="sr-only"
            @change=${(e: Event) => { const i = e.target as HTMLInputElement; const f = i.files?.[0]; i.value = ''; if (f) void importar(c, f); }}></label>
      </div>
      <p class="tip" style="margin-top:12px">Aceita backups deste app (novo ou antigo) e o arquivo de histórico original, que acrescenta as quantidades de ações por mês.</p>
    </section>

    <section class="card" aria-labelledby="h-conta">
      <h2 id="h-conta">Conta</h2>
      <p class="cap">Conectado como ${usuario()?.email ?? '—'}.</p>
      <button type="button" class="btn ghost" @click=${async () => { if (await confirmar('Sair da conta?', 'Neste aparelho será preciso entrar de novo. Os dados continuam na nuvem.', 'Sair')) await sair(); }}>Sair da conta</button>
    </section>`;
}
