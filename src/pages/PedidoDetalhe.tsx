import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/shared/states';
import { Skeleton } from '@/components/ui/skeleton';
import { PedidoStatusBadge } from '@/components/pedidos/PedidoStatusBadge';
import { PedidoTimeline } from '@/components/pedidos/PedidoTimeline';
import {
  usePedido, useCriticar, useRejeitar, useAprovar,
  useDespachar, useConfirmarEntrega, useConfirmarRecebimento, useResubmeter,
} from '@/data/pedidos';
import {
  canAnalisar, canDespachar, canConfirmarRemetente, canConfirmarDestinatario,
} from '@/pedidos/flow';
import { useAuth } from '@/auth/AuthProvider';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function PedidoDetalhe() {
  const { id } = useParams();
  const { role, profile } = useAuth();
  const pedido = usePedido(id);
  useRealtime([{ table: 'pedido_eventos', keys: id ? [qk.pedido(id), qk.pedidos] : [qk.pedidos] }]);

  const criticar = useCriticar();
  const rejeitar = useRejeitar();
  const aprovar = useAprovar();
  const despachar = useDespachar();
  const confirmarEntrega = useConfirmarEntrega();
  const confirmarRecebimento = useConfirmarRecebimento();
  const resubmeter = useResubmeter();

  const [motivo, setMotivo] = useState('');

  if (pedido.isError) return <ErrorState error={pedido.error} />;
  if (pedido.isLoading || !pedido.data) return <Skeleton className="h-64 w-full" />;

  const p = pedido.data;
  const isOwner = !!profile?.nucleo_id && profile.nucleo_id === p.nucleo_id;
  const remetenteJaConfirmou = !!p.entrega_remetente_em;
  const destinatarioJaConfirmou = !!p.entrega_destinatario_em;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Coluna principal */}
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-lg">{p.codigo}</CardTitle>
              <PedidoStatusBadge status={p.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {p.nucleo?.nome ?? '—'} · solicitado por {p.solicitante?.nome ?? '—'} · {dataHora(p.created_at)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Itens</h3>
              <div className="divide-y rounded-md border">
                {p.itens.map((it) => (
                  <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{it.produto?.nome ?? 'Produto'}</span>
                    <span className="text-muted-foreground">
                      pedido {it.qtd_solicitada}
                      {it.qtd_aprovada != null && ` · aprovado ${it.qtd_aprovada}`}
                      {it.qtd_recebida != null && ` · recebido ${it.qtd_recebida}`} {it.produto?.unidade ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold">Justificativa</h3>
              <p className="text-sm text-muted-foreground">{p.justificativa}</p>
            </div>

            {p.criticas.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Histórico de críticas</h3>
                <ol className="space-y-2">
                  {p.criticas.map((c) => (
                    <li key={c.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p>{c.motivo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.autor?.nome ?? '—'} · {dataHora(c.created_at)}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coluna lateral: timeline + ações */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Acompanhamento</CardTitle></CardHeader>
          <CardContent><PedidoTimeline pedido={p} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ações</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {canAnalisar(role, p.status) && (
              <>
                <Button
                  className="w-full"
                  disabled={aprovar.isPending}
                  onClick={() =>
                    void aprovar.mutateAsync({ id: p.id, p_itens_aprovados: [], p_comentario: null })
                  }
                >
                  Aprovar
                </Button>

                <AcaoMotivo
                  rotulo="Criticar"
                  titulo="Enviar crítica"
                  placeholder="Motivo da crítica (obrigatório)"
                  motivo={motivo}
                  setMotivo={setMotivo}
                  pending={criticar.isPending}
                  onConfirm={() => criticar.mutateAsync({ id: p.id, p_motivo: motivo }).then(() => setMotivo(''))}
                />
                <AcaoMotivo
                  rotulo="Rejeitar"
                  titulo="Rejeitar pedido"
                  placeholder="Motivo da rejeição (obrigatório)"
                  destructive
                  motivo={motivo}
                  setMotivo={setMotivo}
                  pending={rejeitar.isPending}
                  onConfirm={() => rejeitar.mutateAsync({ id: p.id, p_motivo: motivo }).then(() => setMotivo(''))}
                />
              </>
            )}

            {canDespachar(role, p.status) && (
              <Button className="w-full" disabled={despachar.isPending} onClick={() => void despachar.mutateAsync({ id: p.id })}>
                Despachar (baixa de estoque)
              </Button>
            )}

            {canConfirmarRemetente(role, p.status, remetenteJaConfirmou) && (
              <Button className="w-full" disabled={confirmarEntrega.isPending} onClick={() => void confirmarEntrega.mutateAsync({ id: p.id })}>
                Confirmar entrega (remetente)
              </Button>
            )}

            {canConfirmarDestinatario(role, p.status, isOwner, destinatarioJaConfirmou) && (
              <Button
                className="w-full"
                disabled={confirmarRecebimento.isPending}
                onClick={() =>
                  void confirmarRecebimento.mutateAsync({
                    id: p.id,
                    p_recebidos: p.itens.map((it) => ({ item_id: it.id, qtd: it.qtd_aprovada ?? it.qtd_solicitada })),
                  })
                }
              >
                Confirmar recebimento
              </Button>
            )}

            {p.status === 'EM_REVISAO' && isOwner && (
              <ResubmeterDialog
                justificativaAtual={p.justificativa}
                itens={p.itens.map((it) => ({ produto_id: it.produto_id, quantidade: String(it.qtd_solicitada) }))}
                pending={resubmeter.isPending}
                onConfirm={(justificativa, itens) =>
                  resubmeter.mutateAsync({ id: p.id, p_justificativa: justificativa, p_itens: itens })
                }
              />
            )}

            {p.status === 'ENVIADO' && (
              <p className="text-xs text-muted-foreground">
                {remetenteJaConfirmou ? 'Remetente confirmou. ' : 'Aguardando remetente. '}
                {destinatarioJaConfirmou ? 'Destinatário confirmou.' : 'Aguardando destinatário.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface AcaoMotivoProps {
  rotulo: string;
  titulo: string;
  placeholder: string;
  destructive?: boolean;
  motivo: string;
  setMotivo: (v: string) => void;
  pending: boolean;
  onConfirm: () => Promise<unknown>;
}

function AcaoMotivo({ rotulo, titulo, placeholder, destructive, motivo, setMotivo, pending, onConfirm }: AcaoMotivoProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={destructive ? 'destructive' : 'outline'} className="w-full">{rotulo}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Motivo</Label>
          <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={placeholder} />
        </div>
        <DialogFooter>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending || motivo.trim().length === 0}
            onClick={async () => { await onConfirm(); setOpen(false); }}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResubmeterDialogProps {
  justificativaAtual: string;
  itens: { produto_id: string; quantidade: string }[];
  pending: boolean;
  onConfirm: (justificativa: string, itens: { produto_id: string; quantidade: number }[]) => Promise<unknown>;
}

function ResubmeterDialog({ justificativaAtual, itens: itensIniciais, pending, onConfirm }: ResubmeterDialogProps) {
  const [open, setOpen] = useState(false);
  const [justificativa, setJustificativa] = useState(justificativaAtual);
  const [itens, setItens] = useState(itensIniciais);

  const validos = itens
    .filter((it) => it.produto_id && Number(it.quantidade) > 0)
    .map((it) => ({ produto_id: it.produto_id, quantidade: Number(it.quantidade) }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Editar e resubmeter</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar e resubmeter</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Justificativa</Label>
            <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Quantidades</Label>
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="number" min={1} className="w-24"
                  value={it.quantidade}
                  onChange={(e) => setItens((arr) => arr.map((x, idx) => (idx === i ? { ...x, quantidade: e.target.value } : x)))}
                />
                <span className="text-sm text-muted-foreground">item {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || justificativa.trim().length === 0 || validos.length === 0}
            onClick={async () => { await onConfirm(justificativa, validos); setOpen(false); }}
          >
            Resubmeter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
