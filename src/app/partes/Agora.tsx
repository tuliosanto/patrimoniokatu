import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ehCotada } from '@/domain/carteira';
import { estimarAgora } from '@/domain/agora';
import type { Estado, Fechamento } from '@/domain/tipos';
import { atualizarCotacoes, fresca, useCotacoesSalvas } from '@/data/cotacoesSalvas';
import { brl, comSinal, dataBr, hojeIso, num } from '@/lib/formato';
import { rotuloAtivo } from '../textos';

const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const quando = (ms: number) => (new Date(ms).toISOString().slice(0, 10) === hojeIso() ? `hoje, ${hora(ms)}` : `${dataBr(new Date(ms).toISOString().slice(0, 10))}, ${hora(ms)}`);

/* Patrimônio de agora, estimado: quantidades de hoje × última cotação guardada de cada ativo;
   o resto (CDB, caixa, classes sem detalhe) como no último fechamento, mais os lançamentos desde então.
   Ao abrir, busca só as cotações velhas (mais de 30 min) ou que faltaram. */
export function Agora({ e, ultimo, totalFechado }: { e: Estado; ultimo: Fechamento; totalFechado: number }) {
  const salvas = useCotacoesSalvas();
  const [buscando, setBuscando] = useState(false);
  const [falhas, setFalhas] = useState<Record<string, string>>({});
  const hoje = hojeIso();

  const precos = useMemo(() => Object.fromEntries(Object.entries(salvas).map(([id, c]) => [id, c.p])), [salvas]);
  const { total: estimado, qtd } = useMemo(() => estimarAgora(e, ultimo, precos), [e, ultimo, precos]);
  const cotados = e.ativos.filter((a) => !a.arquivado && ehCotada(a) && qtd[a.id] > 0);

  const velhas = cotados.filter((a) => !fresca(salvas[a.id], hoje)).length;
  async function atualizar() {
    setBuscando(true);
    setFalhas(await atualizarCotacoes(e, hojeIso(), undefined, cotados.map((a) => a.id)));
    setBuscando(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (velhas > 0) void atualizar(); }, []);

  const maisRecente = Math.max(0, ...cotados.map((a) => salvas[a.id]?.em ?? 0));
  const nFalhas = Object.keys(falhas).length;

  return (
    <section aria-label="Patrimônio agora, estimado" className="mt-8">
      <p className="rotulo">Agora, estimado</p>
      <p className="flex flex-wrap items-baseline gap-x-4">
        <span className="text-[28px] tabular-nums">{brl(estimado)}</span>
        <span className="text-rotulo">{comSinal(estimado - totalFechado)} desde o fechamento</span>
      </p>
      <p className="text-sm text-rotulo" aria-live="polite">
        {buscando ? 'Atualizando cotações…' : maisRecente ? `Cotações até ${quando(maisRecente)}` : 'Sem cotações guardadas ainda'}
        {!buscando && nFalhas > 0 && ` · ${nFalhas} não ${nFalhas > 1 ? 'vieram' : 'veio'}`}
        {' · '}
        <Button variant="texto" size="texto" disabled={buscando} onClick={() => void atualizar()}>{velhas || nFalhas ? `buscar ${velhas || nFalhas} que falta${(velhas || nFalhas) > 1 ? 'm' : ''}` : 'tudo em dia'}</Button>
      </p>
      <details className="mt-2 max-w-2xl text-sm">
        <summary className="cursor-pointer text-rotulo">Última atualização de cada ativo</summary>
        <table className="mt-2 w-full">
          <thead className="rotulo"><tr><th className="text-left font-medium">Ativo</th><th className="text-right font-medium">Cotação</th><th className="text-right font-medium">Atualizada</th></tr></thead>
          <tbody>{cotados.map((a) => {
            const c = salvas[a.id];
            return (
              <tr key={a.id}>
                <td>{rotuloAtivo(a)}</td>
                <td className="text-right tabular-nums">{c ? num(c.p, c.p < 10 ? 4 : 2) : '—'}</td>
                <td className="text-right text-rotulo">{falhas[a.id] ? <span className="text-erro">{falhas[a.id]}</span> : c ? `${quando(c.em)}${c.d !== c.para ? ` (pregão de ${dataBr(c.d)})` : ''}` : 'nunca'}</td>
              </tr>
            );
          })}</tbody>
        </table>
        <p className="mt-2 text-rotulo">CDBs, caixa, FIIs e ETFs sem detalhe entram com o valor do último fechamento mais os lançamentos desde então.</p>
      </details>
    </section>
  );
}
