import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { classe as classeDe } from '@/domain/classes';
import { Escolha, Tela } from '../partes/Tela';
import { corretorasDe, nomeCompleto } from '../textos';
import { ehCotada, posicao, previaPm, r2 } from '@/domain/carteira';
import type { Ativo, ClasseId, Lancamento, TipoLancamento } from '@/domain/tipos';
import { cotacaoDoAtivo, motivo } from '@/data/cotacaoAtivo';
import { excluirDividendo, excluirLancamento, novoId, salvarDividendo, salvarLancamento, useEstado } from '@/data/store';
import { brl, comSinal, dataBr, hojeIso, lerNumero, mesExtenso, num, paraCampo } from '@/lib/formato';
import { AtivoForm } from '../partes/AtivoForm';
import { CampoNumero, CampoTexto } from '../partes/Campo';
import { EscolhaAtivo } from '../partes/EscolhaAtivo';
import { Para } from '../partes/Para';
import { ir, useParams } from '../rota';
import { Degrau } from '../partes/Degrau';

type Tipo = TipoLancamento | 'dividendo';
const TIPOS: { id: Tipo; nome: string; explica: string }[] = [
  { id: 'aporte', nome: 'Aporte', explica: 'Dinheiro novo entrando na carteira.' },
  { id: 'compra', nome: 'Compra', explica: 'Comprar um ativo com dinheiro que já estava investido (do Caixa, por exemplo).' },
  { id: 'venda', nome: 'Venda', explica: 'Vender um ativo; o dinheiro vai para o Caixa ou outro destino.' },
  { id: 'resgate', nome: 'Resgate', explica: 'Tirar dinheiro de um CDB.' },
  { id: 'transferencia', nome: 'Transferência', explica: 'Mover dinheiro entre investimentos, sem ser dinheiro novo.' },
  { id: 'retirada', nome: 'Retirada', explica: 'Dinheiro que sai da carteira para gastar.' },
  { id: 'dividendo', nome: 'Dividendo', explica: 'Pagamento recebido, do extrato. Informativo: não entra no patrimônio.' },
];


/* Quais ativos cabem em cada ponta do lançamento. */
const podeSerAtivo = (tipo: Tipo) => (a: Ativo) => !a.arquivado && (tipo === 'resgate' ? a.classe === 'cdb' : tipo === 'venda' ? classeDe(a.classe).cotada : true);
const podeSerContra = (a: Ativo) => !a.arquivado && (!classeDe(a.classe).cotada || a.classe === 'dolar');
const ehTipo = (t: string | null): t is Tipo => !!t && TIPOS.some((x) => x.id === t);

export function Lancar() {
  const e = useEstado();
  const params = useParams();
  const [tipo, setTipo] = useState<Tipo>(() => (ehTipo(params.get('tipo')) ? params.get('tipo') as Tipo : 'aporte'));
  const [data, setData] = useState(hojeIso());
  const [ativoId, setAtivoId] = useState('');
  const [contraId, setContraId] = useState('');
  const [q, setQ] = useState('');
  const [preco, setPreco] = useState('');
  const [valor, setValor] = useState('');
  const [corretora, setCorretora] = useState('');
  const [obs, setObs] = useState('');
  const [cotInfo, setCotInfo] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [novoPara, setNovoPara] = useState<'ativo' | 'contra' | null>(null);
  const [apagar, setApagar] = useState<{ id: string; dividendo: boolean; texto: string } | null>(null);
  const [classeSugerida, setClasseSugerida] = useState<ClasseId | undefined>();

  // Chegando por um atalho (Carteira, Metas, Mês a mês): já vem com o tipo, o ativo e/ou o valor.
  const chave = params.toString();
  useEffect(() => {
    const t = params.get('tipo'), a = params.get('ativo'), v = params.get('valor'), c = params.get('classe');
    if (ehTipo(t)) setTipo(t);
    if (v) setValor(v);
    setClasseSugerida((c as ClasseId) || undefined);
    if (a && e.ativos.some((x) => x.id === a)) escolherAtivo(a, 'ativo', ehTipo(t) ? t : tipo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const ativo = e.ativos.find((a) => a.id === ativoId);
  const cotada = !!ativo && ehCotada(ativo);
  const usaQtd = cotada && tipo !== 'dividendo' && tipo !== 'resgate' && tipo !== 'retirada';
  const nq = lerNumero(q), np = lerNumero(preco), nv = lerNumero(valor);
  const valorFinal = usaQtd && nq !== null && np !== null ? r2(nq * np) : nv;
  const caixa = e.ativos.find((a) => a.classe === 'caixa' && !a.arquivado);
  const pos = useMemo(() => (ativo ? posicao(ativo, e.lancamentos) : null), [ativo, e.lancamentos]);
  const corretoras = corretorasDe(e.ativos);

  const precisaContra = tipo === 'compra' || tipo === 'transferencia' || tipo === 'venda' || tipo === 'resgate';
  const contraRotulo = tipo === 'compra' || tipo === 'transferencia' ? 'De onde sai o dinheiro' : 'Para onde vai o dinheiro';
  const contraEfetivo = contraId || (precisaContra && caixa && caixa.id !== ativoId ? caixa.id : '');

  function escolherAtivo(id: string, para: 'ativo' | 'contra', t = tipo) {
    if (id === '__novo') { setNovoPara(para); return; }
    if (para === 'contra') { setContraId(id); return; }
    setAtivoId(id); setCotInfo('');
    const a = e.ativos.find((x) => x.id === id);
    if (a?.corretora) setCorretora(a.corretora);
    if (a && ehCotada(a) && t !== 'dividendo') void buscar(a, data);
  }

  // Os ativos lançados por último, para aparecerem primeiro no seletor.
  const usados = useMemo(() => [...new Set([...e.lancamentos].sort((a, b) => b.criadoEm - a.criadoEm).map((l) => l.ativoId).filter(Boolean) as string[])].slice(0, 5), [e.lancamentos]);

  async function buscar(a = ativo, d = data) {
    if (!a) return;
    setBuscando(true); setCotInfo('');
    try {
      const c = await cotacaoDoAtivo(a, d, e.config.brapiToken);
      setPreco(paraCampo(c.preco, 6));
      setCotInfo(`Cotação de ${dataBr(c.data)} · ${c.fonte}. Pode corrigir pelo preço da nota.`);
    } catch (x) { setCotInfo(`Sem cotação automática: ${motivo(x)}. Digite o preço.`); }
    finally { setBuscando(false); }
  }

  function limpar() { setQ(''); setPreco(''); setValor(''); setObs(''); setCotInfo(''); }

  async function salvar() {
    if (tipo === 'dividendo') {
      if (!nv || nv <= 0) { toast.error('Informe o valor recebido.'); return; }
      await salvarDividendo({ id: novoId(), data, ativoId: ativoId || undefined, valor: r2(nv), obs: obs.trim() || undefined, criadoEm: Date.now() });
      toast.success('Dividendo lançado.', ativoId ? { action: { label: 'Ver o ativo', onClick: () => ir('carteira', { ativo: ativoId }) } } : undefined); limpar(); return;
    }
    if (!ativo) { toast.error('Escolha o ativo.'); return; }
    if (!valorFinal || valorFinal <= 0) { toast.error('Informe o valor.'); return; }
    if (usaQtd && (!nq || nq <= 0)) { toast.error('Informe a quantidade.'); return; }
    if (tipo === 'venda' && pos && nq && nq > pos.q + 1e-9) { toast.error(`Vocês têm ${num(pos.q)}; não dá para vender ${num(nq)}.`); return; }
    const l: Lancamento = {
      id: novoId(), data, tipo, ativoId: ativo.id, valor: r2(valorFinal),
      contraparteId: precisaContra ? contraEfetivo || undefined : undefined,
      quantidade: usaQtd ? nq! : undefined, preco: usaQtd ? np! : undefined,
      corretora: corretora.trim() || undefined, obs: obs.trim() || undefined, criadoEm: Date.now(),
    };
    try { await salvarLancamento(l); toast.success('Lançamento salvo.', { action: { label: 'Ver o ativo', onClick: () => ir('carteira', { ativo: l.ativoId }) } }); limpar(); }
    catch { toast.error('Não foi possível salvar. Tente de novo.'); }
  }

  const pmDepois = pos && usaQtd && (tipo === 'aporte' || tipo === 'compra' || tipo === 'transferencia') && nq && valorFinal ? previaPm(pos, nq, valorFinal) : null;
  const lucroVenda = pos && tipo === 'venda' && pos.pm !== null && nq && np ? r2((np - pos.pm) * nq) : null;

  // Lista do mês: do mais antigo ao mais recente, terminando no "agora".
  const mes = data.slice(0, 7);
  const recentes = [
    ...e.lancamentos.filter((l) => l.data.slice(0, 7) === mes).map((l) => ({ id: l.id, data: l.data, criadoEm: l.criadoEm, dividendo: false, ativoId: l.ativoId,
      texto: `${TIPOS.find((t) => t.id === l.tipo)!.nome} · ${(() => { const a = e.ativos.find((x) => x.id === l.ativoId); return a ? nomeCompleto(a) : '—'; })()}${l.quantidade ? ` · ${num(l.quantidade)} × ${brl(l.preco ?? 0)}` : ''}`, valor: l.valor })),
    ...e.dividendos.filter((d) => d.data.slice(0, 7) === mes).map((d) => ({ id: d.id, data: d.data, criadoEm: d.criadoEm, dividendo: true, ativoId: d.ativoId,
      texto: `Dividendo · ${(() => { const a = e.ativos.find((x) => x.id === d.ativoId); return a ? nomeCompleto(a) : d.obs ?? 'sem ativo'; })()}`, valor: d.valor })),
  ].sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm - b.criadoEm);

  return (
    <Tela titulo="Lançar">

      <Degrau nivel={1} titulo="O que aconteceu" id="tipo">
        <Escolha rotulo="O que aconteceu" opcoes={TIPOS} valor={tipo} onChange={(t) => { setTipo(t); setContraId(''); setCotInfo(''); }} className="max-w-3xl gap-x-5" tamanho="text-[17px]" />
        <p className="mt-2 max-w-md text-sm text-rotulo">{TIPOS.find((t) => t.id === tipo)!.explica}</p>
      </Degrau>

      <div className="pausa grid items-start gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Degrau nivel={0} className="mt-0">
        <form className="grid max-w-2xl gap-6 sm:grid-cols-2" onSubmit={(x) => { x.preventDefault(); void salvar(); }}>
          <CampoTexto rotulo="Data" tipo="date" valor={data} onChange={(v) => { setData(v); if (cotada) void buscar(ativo, v); }} />
          <EscolhaAtivo rotulo={tipo === 'dividendo' ? 'Ativo que pagou' : tipo === 'retirada' ? 'De onde sai' : 'Ativo'} valor={ativoId} onChange={(v) => escolherAtivo(v, 'ativo')}
            ativos={e.ativos.filter(podeSerAtivo(tipo))} recentes={usados} classeInicial={classeSugerida}
            dica={pos && cotada ? `Hoje: ${num(pos.q)}${pos.pm !== null ? ` · preço médio ${brl(pos.pm)}` : ' · preço médio não informado'}` : undefined} />

          {usaQtd && <>
            <CampoNumero rotulo={ativo?.classe === 'dolar' ? 'Quantidade (US$)' : 'Quantidade'} valor={q} onChange={setQ} obrigatorio />
            <div className="grid gap-1">
              <CampoNumero rotulo={ativo?.classe === 'dolar' ? 'Cotação (R$ por US$)' : 'Preço unitário (R$)'} valor={preco} onChange={setPreco} casas={6}
                dica={buscando ? 'Buscando a cotação…' : cotInfo || undefined} />
              {!buscando && <Button type="button" variant="rotulo" size="texto" className="justify-self-start text-sm" onClick={() => void buscar()}>Buscar cotação de novo</Button>}
            </div>
          </>}

          {usaQtd
            ? <p className="sm:col-span-2 text-lg">Valor <b className="tabular-nums">{valorFinal ? brl(valorFinal) : '—'}</b>
                {pmDepois !== null && <span className="ml-4 text-rotulo">novo preço médio {brl(pmDepois)}</span>}
                {lucroVenda !== null && <span className="ml-4 text-rotulo">resultado {comSinal(lucroVenda)}</span>}</p>
            : <CampoNumero rotulo="Valor (R$)" valor={valor} onChange={setValor} casas={2} obrigatorio />}

          {precisaContra && (
            <EscolhaAtivo rotulo={contraRotulo} valor={contraEfetivo} onChange={(v) => escolherAtivo(v, 'contra')}
              ativos={e.ativos.filter((a) => a.id !== ativoId && podeSerContra(a))} />
          )}
          {tipo !== 'dividendo' && <CampoTexto rotulo="Corretora ou banco" valor={corretora} onChange={setCorretora} lista={corretoras} />}
          <CampoTexto rotulo="Observação" valor={obs} onChange={setObs} className="sm:col-span-2" />

          <div className="sm:col-span-2">
            <Button type="submit">Salvar lançamento</Button>
          </div>
        </form>
      </Degrau>

      <Degrau nivel={0} className="mt-0" id="lista">
        <h2 className="rotulo mb-2 flex flex-wrap justify-between gap-x-4 font-medium"><span>Lançados em {mesExtenso(mes, false)}</span>
          {e.fechamentos.some((f) => f.id === mes) && <Para tela="mes" params={{ m: mes }} className="text-[13px]">ver o mês inteiro</Para>}</h2>
        {recentes.length === 0 ? <p className="text-rotulo">Nada lançado neste mês ainda.</p> : (
          <ul className="grid gap-1">
            {recentes.map((x) => (
              <li key={x.id} className="grid grid-cols-[5.5rem_1fr_auto_auto] items-baseline gap-x-4">
                <span className="text-rotulo">{dataBr(x.data).slice(0, 5)}</span>
                <span>{x.ativoId ? <Para tela="carteira" params={{ ativo: x.ativoId }} discreto titulo="Abrir a ficha do ativo">{x.texto}</Para> : x.texto}</span>
                <span className="text-right tabular-nums">{brl(x.valor)}</span>
                <Button variant="rotulo" size="sm" aria-label={`Apagar: ${x.texto}`} onClick={() => setApagar(x)}>Apagar</Button>
              </li>
            ))}
          </ul>
        )}
      </Degrau>

      </div>

      {novoPara && (
        <AtivoForm aberto onFechar={() => setNovoPara(null)}
          onSalvo={(a) => { if (novoPara === 'contra') setContraId(a.id); else { setAtivoId(a.id); if (a.corretora) setCorretora(a.corretora); } }} />
      )}

      <AlertDialog open={!!apagar} onOpenChange={(v) => !v && setApagar(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="marco text-xl font-normal italic">Apagar este lançamento?</AlertDialogTitle>
          <AlertDialogDescription className="text-dado">{apagar?.texto}</AlertDialogDescription>
          <AlertDialogFooter className="flex-row gap-6">
            <AlertDialogCancel asChild><Button variant="texto" size="texto">Manter</Button></AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destrutivo" size="texto" onClick={async () => {
                if (!apagar) return;
                await (apagar.dividendo ? excluirDividendo(apagar.id) : excluirLancamento(apagar.id));
                toast.success('Lançamento apagado.');
                setApagar(null);
              }}>Apagar</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tela>
  );
}
