import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { totalFechamento } from '@/domain/carteira';
import { ehArquivoHistorico, importarHistorico } from '@/domain/importar';
import type { Estado } from '@/domain/tipos';
import { auth, sair } from '@/data/firebase';
import { exportar, gravarTudo, salvarConfig, useEstado } from '@/data/store';
import { brl, hojeIso, mesExtenso } from '@/lib/formato';
import { Tela } from '../partes/Tela';
import { Campo } from '../partes/Campo';
import { Degrau } from '../partes/Degrau';
import { aplicarCores, CORES, type Cores } from '../cores';

type Pendente = { tipo: 'historico' | 'backup'; dados: Partial<Estado>; resumo: string };

export function Ajustes() {
  const [cores, setCores] = useState<Cores>(() => (document.documentElement.dataset.cores as Cores | undefined) ?? 'lilas');
  const e = useEstado();
  const [token, setToken] = useState(e.config.brapiToken ?? '');
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [gravando, setGravando] = useState(false);

  async function lerArquivo(f: File | undefined) {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (ehArquivoHistorico(j)) {
        const r = importarHistorico(j);
        const ult = r.fechamentos[r.fechamentos.length - 1];
        // Reimportar não apaga o que a família já completou: ativos existentes e meses fechados no app ficam como estão.
        const jaTem = new Set(e.ativos.map((a) => a.id));
        const fechadosNoApp = new Set(e.fechamentos.filter((f) => !f.importado).map((f) => f.id));
        setPendente({
          tipo: 'historico',
          dados: { ativos: r.ativos.filter((a) => !jaTem.has(a.id)), fechamentos: r.fechamentos.filter((f) => !fechadosNoApp.has(f.id)), dividendos: r.dividendos,
            config: { ...e.config, avisos: [...new Set([...(e.config.avisos ?? []), ...r.avisos])] } },
          resumo: `${r.fechamentos.length} fechamentos, de ${mesExtenso(r.fechamentos[0].id, false)} a ${mesExtenso(ult.id, false)} (${brl(totalFechamento(ult, r.ativos))}); ${r.ativos.length} ativos; ${r.dividendos.length} meses com dividendos.`,
        });
      } else if (j?.app === 'nosso-patrimonio' && j?.estado) {
        const s = j.estado as Estado;
        setPendente({ tipo: 'backup', dados: s, resumo: `Backup de ${new Date(j.exportadoEm).toLocaleString('pt-BR')}: ${s.fechamentos.length} fechamentos, ${s.lancamentos.length} lançamentos. Tudo o que foi registrado depois dele será apagado.` });
      } else toast.error('Arquivo não reconhecido. Use o histórico consolidado ou um backup do app.');
    } catch { toast.error('Não foi possível ler o arquivo.'); }
  }

  async function aplicar() {
    if (!pendente) return;
    setGravando(true);
    try {
      const n = await gravarTudo(pendente.dados, pendente.tipo === 'backup');
      toast.success(`${n} registros gravados.`);
      setPendente(null);
    } catch { toast.error('A gravação falhou. Verifique as regras do Firestore e a internet.'); }
    finally { setGravando(false); }
  }

  function baixarBackup() {
    const url = URL.createObjectURL(new Blob([exportar()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `nosso-patrimonio-${hojeIso()}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Tela titulo="Ajustes">
      <div className="painel pausa">
      <Degrau nivel={0} titulo="Cores" id="aj-cores">
        <div role="radiogroup" aria-label="Combinação de cores" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CORES.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={cores === c.id} onClick={() => { aplicarCores(c.id, true); setCores(c.id); }}
              style={{ background: c.fundo, color: c.dado }}
              className={cn('grid min-h-20 content-between justify-items-start p-3 text-left outline-offset-2 transition-shadow duration-150',
                cores === c.id ? 'shadow-[0_0_0_2px_var(--dado)]' : 'shadow-[0_0_0_1px_var(--traco)] hover:shadow-[0_0_0_1px_var(--rotulo)]')}>
              <span className="marco text-[19px] italic">{c.nome}</span>
              <span className="text-[13px]"><b style={{ color: c.agora }}>R$ 1.234</b> · {c.nota}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-rotulo">Cada um escolhe a sua: fica guardada neste aparelho.</p>
      </Degrau>
      {(e.config.avisos ?? []).length > 0 && (
      <Degrau nivel={0} titulo="Pendências" id="aj-av">
          <ul className="grid max-w-2xl gap-2">
            {e.config.avisos!.map((a) => (
              <li key={a} className="flex flex-wrap items-baseline justify-between gap-x-6">
                <span>{a}</span>
                <Button variant="rotulo" size="sm" onClick={() => void salvarConfig({ ...e.config, avisos: e.config.avisos!.filter((x) => x !== a) })}>Resolvido</Button>
              </li>
            ))}
          </ul>
        </Degrau>
      )}

      <Degrau nivel={0} titulo="Cotações da B3" id="aj-brapi">
        <p className="max-w-xl text-sm text-rotulo">Ações, FIIs, ETFs e o Ibovespa vêm do brapi.dev com um token gratuito. Ele fica guardado só na nuvem da família, nunca no código.</p>
        <div className="mt-3 flex max-w-xl flex-wrap items-end gap-6">
          <Campo rotulo="Token do brapi" className="min-w-64 flex-1">{(id) => <Input id={id} value={token} onChange={(x) => setToken(x.target.value)} autoComplete="off" spellCheck={false} />}</Campo>
          <Button onClick={async () => { await salvarConfig({ ...e.config, brapiToken: token.trim() || undefined }); toast.success('Token salvo.'); }}>Salvar</Button>
        </div>
      </Degrau>

      <Degrau nivel={0} titulo="Importar" id="aj-imp">
        <p className="max-w-xl text-sm text-rotulo">O histórico consolidado das planilhas (historico-consolidado.json) ou um backup baixado daqui. Os registros com o mesmo identificador são substituídos; nada é apagado.</p>
        <Campo rotulo="Arquivo" className="mt-3 max-w-md">{(id) => <input id={id} type="file" accept="application/json,.json" onChange={(x) => { void lerArquivo(x.target.files?.[0]); x.target.value = ''; }} className="min-h-11 text-[15px]" />}</Campo>
      </Degrau>

      <Degrau nivel={0} titulo="Backup" id="aj-bkp">
        <p className="max-w-xl text-sm text-rotulo">A cada fechamento confirmado, uma cópia completa fica guardada na nuvem e não pode ser alterada. Para ter uma cópia neste aparelho, baixe o arquivo.</p>
        <Button variant="texto" size="texto" onClick={baixarBackup}>Baixar backup completo</Button>
      </Degrau>

      <Degrau nivel={0} titulo="Conta" id="aj-conta">
        <p>{auth.currentUser?.email}</p>
        <Button variant="texto" size="texto" onClick={() => void sair()}>Sair</Button>
      </Degrau>

      </div>

      <AlertDialog open={!!pendente} onOpenChange={(v) => !v && !gravando && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="marco text-xl font-normal italic">{pendente?.tipo === 'historico' ? 'Importar o histórico?' : 'Restaurar o backup?'}</AlertDialogTitle>
          <AlertDialogDescription className="text-dado">{pendente?.resumo}</AlertDialogDescription>
          <AlertDialogFooter className="flex-row gap-6">
            <AlertDialogCancel asChild><Button variant="texto" size="texto" disabled={gravando}>Cancelar</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button disabled={gravando} onClick={(x) => { x.preventDefault(); void aplicar(); }}>{gravando ? 'Gravando…' : 'Gravar'}</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tela>
  );
}
