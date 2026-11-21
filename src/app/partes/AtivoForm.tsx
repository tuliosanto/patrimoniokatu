import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CLASSES, classe as classeDe } from '@/domain/classes';
import { corretorasDe } from '../textos';
import type { Ativo, ClasseId } from '@/domain/tipos';
import { novoId, salvarAtivo, useEstado } from '@/data/store';
import { dataBr, lerNumero, paraCampo } from '@/lib/formato';
import { CampoNumero, CampoSeletor, CampoTexto } from './Campo';

const txt = (n?: number) => (n == null ? '' : paraCampo(n));

/* Cadastro e edição de um ativo. Para CDB, também banco, taxa, vencimento e liquidez. */
export function AtivoForm({ aberto, onFechar, ativo, classeInicial, onSalvo }:
  { aberto: boolean; onFechar: () => void; ativo?: Ativo; classeInicial?: ClasseId; onSalvo?: (a: Ativo) => void }) {
  const estado = useEstado();
  const [classe, setClasse] = useState<ClasseId>(ativo?.classe ?? classeInicial ?? 'acoes');
  const [nome, setNome] = useState(ativo?.nome ?? '');
  const [ticker, setTicker] = useState(ativo?.ticker ?? '');
  const [corretora, setCorretora] = useState(ativo?.corretora ?? '');
  const [pm, setPm] = useState(txt(ativo?.pmBase));
  const [q, setQ] = useState(txt(ativo?.qBase));
  const [banco, setBanco] = useState(ativo?.cdb?.banco ?? '');
  const [aplicado, setAplicado] = useState(txt(ativo?.cdb?.aplicado));
  const [dataAplic, setDataAplic] = useState(ativo?.cdb?.dataAplicacao ?? '');
  const [tipoTaxa, setTipoTaxa] = useState<'cdi' | 'pre'>(ativo?.cdb?.tipoTaxa ?? 'cdi');
  const [taxa, setTaxa] = useState(txt(ativo?.cdb?.taxa));
  const [venc, setVenc] = useState(ativo?.cdb?.vencimento ?? '');
  const [liquidez, setLiquidez] = useState<'diaria' | 'vencimento'>(ativo?.cdb?.liquidez ?? 'vencimento');
  const corretoras = corretorasDe(estado.ativos);
  // Mesma regra de ehCotada, para um ativo que ainda pode não estar salvo.
  const cotada = classeDe(classe).cotada && !ativo?.agregado;

  async function salvar() {
    const nomeFinal = nome.trim() || ticker.trim().toUpperCase();
    if (!nomeFinal) { toast.error('Dê um nome ao ativo.'); return; }
    const a: Ativo = {
      ...(ativo ?? { id: novoId(), criadoEm: Date.now() }),
      classe, nome: nomeFinal,
      ticker: ticker.trim().toUpperCase() || undefined,
      corretora: corretora.trim() || undefined,
      pmBase: lerNumero(pm) ?? undefined,
      qBase: cotada ? (lerNumero(q) ?? ativo?.qBase) : ativo?.qBase,
      dataBase: ativo?.dataBase,
      cdb: classe === 'cdb' ? {
        banco: banco.trim() || undefined, aplicado: lerNumero(aplicado) ?? undefined, dataAplicacao: dataAplic || undefined,
        tipoTaxa, taxa: lerNumero(taxa) ?? undefined, vencimento: venc || undefined, liquidez,
      } : undefined,
    };
    try {
      await salvarAtivo(a);
      toast.success(ativo ? 'Ativo atualizado.' : 'Ativo criado.');
      onSalvo?.(a);
      onFechar();
    } catch { toast.error('Não foi possível salvar. Tente de novo.'); }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle className="marco text-2xl font-normal italic">{ativo ? ativo.nome : 'Novo ativo'}</DialogTitle>
        <DialogDescription className="text-rotulo">
          {ativo ? 'Ajuste os dados do ativo. O histórico dos fechamentos não muda.' : 'Cadastre um investimento para lançar e acompanhar.'}
        </DialogDescription>
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoSeletor rotulo="Classe" valor={classe} onChange={(v) => setClasse(v as ClasseId)}>
            {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </CampoSeletor>
          <CampoTexto rotulo={classe === 'cdb' ? 'Nome' : 'Código'} valor={classe === 'cdb' || classe === 'caixa' ? nome : ticker}
            onChange={classe === 'cdb' || classe === 'caixa' ? setNome : setTicker}
            dica={classe === 'cripto' ? 'BTC, ETH, SOL…' : classe === 'dolar' ? 'USD' : classe === 'cdb' ? undefined : 'Como na B3: BBAS3, TAEE11…'} />
          {classe !== 'cdb' && classe !== 'caixa' && <CampoTexto rotulo="Nome (opcional)" valor={nome} onChange={setNome} />}
          <CampoTexto rotulo="Corretora ou banco" valor={corretora} onChange={setCorretora} lista={corretoras} />
          {cotada && <>
            <CampoNumero rotulo={classe === 'dolar' ? 'Saldo em US$ na data-base' : 'Quantidade na data-base'} valor={q} onChange={setQ}
              dica={ativo?.dataBase ? `Data-base: ${dataBr(ativo.dataBase)}. Lançamentos depois dela somam a esta quantidade.` : 'Quantidade que vocês têm hoje, antes de novos lançamentos.'} />
            <CampoNumero rotulo="Preço médio (R$)" valor={pm} onChange={setPm} casas={6}
              dica="Copie da Área do Investidor da B3 ou da corretora. Daqui em diante o app recalcula sozinho." />
          </>}
          {classe === 'cdb' && <>
            <CampoTexto rotulo="Banco" valor={banco} onChange={setBanco} lista={corretoras} />
            <CampoNumero rotulo="Valor aplicado (R$)" valor={aplicado} onChange={setAplicado} casas={2} />
            <CampoTexto rotulo="Data da aplicação" tipo="date" valor={dataAplic} onChange={setDataAplic} />
            <CampoSeletor rotulo="Tipo de taxa" valor={tipoTaxa} onChange={(v) => setTipoTaxa(v as 'cdi' | 'pre')}>
              <option value="cdi">% do CDI</option>
              <option value="pre">Prefixada (% ao ano)</option>
            </CampoSeletor>
            <CampoNumero rotulo={tipoTaxa === 'cdi' ? 'Taxa (% do CDI)' : 'Taxa (% ao ano)'} valor={taxa} onChange={setTaxa} casas={2} dica={tipoTaxa === 'cdi' ? 'Ex.: 110' : 'Ex.: 12,5'} />
            <CampoTexto rotulo="Vencimento" tipo="date" valor={venc} onChange={setVenc} />
            <CampoSeletor rotulo="Liquidez" valor={liquidez} onChange={(v) => setLiquidez(v as 'diaria' | 'vencimento')}>
              <option value="vencimento">No vencimento</option>
              <option value="diaria">Diária</option>
            </CampoSeletor>
          </>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Button onClick={salvar}>Salvar</Button>
          {ativo && !ativo.arquivado && (
            <Button variant="rotulo" size="texto" onClick={async () => { await salvarAtivo({ ...ativo, arquivado: true }); toast.success('Ativo arquivado. O histórico continua.'); onFechar(); }}>
              Arquivar
            </Button>
          )}
          {ativo?.arquivado && (
            <Button variant="rotulo" size="texto" onClick={async () => { await salvarAtivo({ ...ativo, arquivado: false }); toast.success('Ativo de volta à carteira.'); onFechar(); }}>
              Reativar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
