import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { AssinaturaCanvas, type AssinaturaCanvasHandle } from './AssinaturaCanvas';
import { PdfViewer } from './PdfViewer';
import { useAssinarPedido, useDocumentoUrl } from '@/data/pedidos';
import type { PedidoDocumento, PedidoItem } from '@/data/types';

interface Props {
  pedidoId: string;
  itens: PedidoItem[];
  original?: PedidoDocumento;
}

export function AssinarDialog({ pedidoId, itens, original }: Props) {
  const [open, setOpen] = useState(false);
  const [comentario, setComentario] = useState('');
  const padRef = useRef<AssinaturaCanvasHandle>(null);
  const assinar = useAssinarPedido();
  const originalUrl = useDocumentoUrl(original?.storage_path);

  async function confirmar() {
    const png = padRef.current?.toDataURL();
    if (!png) {
      toast.error('Assine no campo indicado antes de aprovar.');
      return;
    }
    try {
      await assinar.mutateAsync({
        pedidoId,
        assinaturaPng: png,
        itensAprovados: itens.map((it) => ({ item_id: it.id, qtd: it.qtd_solicitada })),
        comentario: comentario.trim() || null,
      });
      setOpen(false);
    } catch {
      /* toast tratado no hook */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Aprovar e assinar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aprovar pedido com assinatura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {original && originalUrl.data && (
            <div className="space-y-1.5">
              <Label>Documento comprobatório</Label>
              <PdfViewer url={originalUrl.data} filename={original.filename} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Comentário (opcional)</Label>
            <Textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Assinatura do responsável</Label>
            <AssinaturaCanvas ref={padRef} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={assinar.isPending} onClick={() => void confirmar()}>
            {assinar.isPending ? 'Assinando…' : 'Confirmar aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
