import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ErrorState, TableSkeleton } from '@/components/shared/states';
import { useProdutos } from '@/data/produtos';
import { useLotes } from '@/data/lotes';
import { useMovimentacoes, useRegistrarMovimentacao } from '@/data/movimentacoes';
import type { TipoMovimentacao } from '@/data/types';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

const TIPO_LABEL: Record<TipoMovimentacao, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
};

function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Movimentacoes() {
  const movs = useMovimentacoes();
  useRealtime([{ table: 'movimentacoes', keys: [qk.movimentacoes, qk.estoque] }]);

  if (movs.isError) return <ErrorState error={movs.error} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RegistrarDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {movs.isLoading ? (
            <TableSkeleton />
          ) : (
            <div className="divide-y">
              {(movs.data ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={m.tipo === 'saida' ? 'destructive' : m.tipo === 'entrada' ? 'default' : 'secondary'}
                    >
                      {TIPO_LABEL[m.tipo]}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{m.produto?.nome ?? 'Produto'}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.quantidade} {m.produto?.unidade ?? ''} · {m.motivo || 'sem motivo'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{dataHora(m.created_at)}</p>
                    <p>{m.responsavel?.nome ?? 'sistema'}</p>
                  </div>
                </div>
              ))}
              {(movs.data ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RegistrarDialog() {
  const [open, setOpen] = useState(false);
  const [produtoId, setProdutoId] = useState('');
  const [loteId, setLoteId] = useState('');
  const [tipo, setTipo] = useState<TipoMovimentacao>('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');

  const produtos = useProdutos();
  const lotes = useLotes(produtoId || undefined);
  const registrar = useRegistrarMovimentacao();

  const loteAtual = useMemo(
    () => (lotes.data ?? []).find((l) => l.id === loteId),
    [lotes.data, loteId],
  );

  function reset() {
    setProdutoId('');
    setLoteId('');
    setTipo('entrada');
    setQuantidade('');
    setMotivo('');
  }

  async function submit() {
    const qtd = Number(quantidade);
    if (!produtoId || !loteId || !qtd || qtd <= 0) return;
    try {
      await registrar.mutateAsync({
        produto_id: produtoId,
        lote_id: loteId,
        tipo,
        quantidade: qtd,
        motivo: motivo || null,
      });
      setOpen(false);
      reset();
    } catch {
      /* toast tratado no hook */
    }
  }

  const icon =
    tipo === 'entrada' ? <ArrowDownToLine className="mr-1 h-4 w-4" /> : tipo === 'saida' ? <ArrowUpFromLine className="mr-1 h-4 w-4" /> : <SlidersHorizontal className="mr-1 h-4 w-4" />;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Registrar movimentação</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select
              value={produtoId}
              onValueChange={(v) => {
                setProdutoId(v);
                setLoteId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {(produtos.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Lote</Label>
            <Select value={loteId} onValueChange={setLoteId} disabled={!produtoId}>
              <SelectTrigger>
                <SelectValue placeholder={produtoId ? 'Selecione o lote' : 'Escolha um produto'} />
              </SelectTrigger>
              <SelectContent>
                {(lotes.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.codigo || 'sem código'} · saldo {l.quantidade}
                    {l.validade ? ` · val. ${new Date(l.validade).toLocaleDateString('pt-BR')}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMovimentacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste (define saldo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
          </div>

          {loteAtual && tipo === 'saida' && (
            <p className="text-xs text-muted-foreground">Saldo atual do lote: {loteAtual.quantidade}</p>
          )}

          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: campanha, consumo, correção" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={registrar.isPending || !loteId || !quantidade}>
            {icon}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
