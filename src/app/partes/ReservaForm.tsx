import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Reserva } from '@/domain/tipos';
import { excluirReserva, novoId, salvarReserva, useEstado } from '@/data/store';
import { lerNumero, paraCampo } from '@/lib/formato';
import { CampoNumero, CampoSeletor, CampoTexto } from './Campo';

export function ReservaForm({ reserva, onFechar }: { reserva?: Reserva; onFechar: () => void }) {
  const [nome, setNome] = useState(reserva?.nome ?? 'Viagem aos EUA');
  const [moeda, setMoeda] = useState<'USD' | 'BRL'>(reserva?.moeda ?? 'USD');
  const [valor, setValor] = useState(reserva ? paraCampo(reserva.valor, 2) : '');
  const [meta, setMeta] = useState(reserva?.meta != null ? paraCampo(reserva.meta, 2) : '');
  const [dentroDe, setDentroDe] = useState(reserva?.dentroDe ?? '');
  const estado = useEstado();
  const ondePode = estado.ativos.filter((a) => !a.arquivado && (moeda === 'USD' ? a.classe === 'dolar' : a.classe === 'caixa' || a.classe === 'cdb'));

  async function salvar() {
    const v = lerNumero(valor);
    if (v == null) { toast.error('Informe o valor guardado.'); return; }
    await salvarReserva({ id: reserva?.id ?? novoId(), criadoEm: reserva?.criadoEm ?? Date.now(), nome: nome.trim() || 'Reserva', moeda, valor: v, meta: lerNumero(meta) ?? undefined, dentroDe: dentroDe || undefined });
    toast.success('Reserva salva.');
    onFechar();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="marco text-2xl font-normal italic">{reserva ? reserva.nome : 'Nova reserva'}</DialogTitle>
        <DialogDescription className="text-rotulo">Dinheiro guardado para um objetivo. Aparece à parte e não entra no patrimônio investido.</DialogDescription>
        <div className="grid gap-5 sm:grid-cols-2">
          <CampoTexto rotulo="Nome" valor={nome} onChange={setNome} className="sm:col-span-2" />
          <CampoSeletor rotulo="Moeda" valor={moeda} onChange={(v) => setMoeda(v as 'USD' | 'BRL')}>
            <option value="USD">Dólar (US$)</option>
            <option value="BRL">Real (R$)</option>
          </CampoSeletor>
          <CampoNumero rotulo={`Valor guardado (${moeda === 'USD' ? 'US$' : 'R$'})`} valor={valor} onChange={setValor} casas={2} />
          <CampoNumero rotulo="Meta (opcional)" valor={meta} onChange={setMeta} casas={2} />
          <CampoSeletor rotulo="Onde está guardado" valor={dentroDe} onChange={setDentroDe} className="sm:col-span-2"
            dica={dentroDe ? 'Este valor é descontado desse investimento no patrimônio, como a planilha fazia.' : 'Em lugar separado, fora dos investimentos.'}>
            <option value="">Separado dos investimentos</option>
            {ondePode.map((a) => <option key={a.id} value={a.id}>Dentro de {a.nome}</option>)}
          </CampoSeletor>
        </div>
        <div className="mt-4 flex gap-6">
          <Button onClick={() => void salvar()}>Salvar</Button>
          {reserva && <Button variant="destrutivo" size="texto" onClick={async () => { await excluirReserva(reserva.id); toast.success('Reserva removida.'); onFechar(); }}>Remover</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
