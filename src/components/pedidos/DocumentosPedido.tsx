import { useState } from 'react';
import { Download, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PdfViewer } from './PdfViewer';
import { useDocumentoUrl } from '@/data/pedidos';
import type { PedidoDocumento } from '@/data/types';

function DocLinha({ doc }: { doc: PedidoDocumento }) {
  const url = useDocumentoUrl(doc.storage_path);
  const aprovado = doc.tipo === 'APROVADO';
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        {aprovado ? (
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <FileText className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{aprovado ? 'Documento aprovado (assinado)' : doc.filename}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!url.data}>
              Ver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{aprovado ? 'Aval assinado' : doc.filename}</DialogTitle>
            </DialogHeader>
            {url.data && <PdfViewer url={url.data} filename={aprovado ? 'aval.pdf' : doc.filename} />}
          </DialogContent>
        </Dialog>
        <Button variant="ghost" size="icon" aria-label="Baixar" disabled={!url.data} asChild>
          <a href={url.data} target="_blank" rel="noreferrer" download>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </span>
    </div>
  );
}

export function DocumentosPedido({ documentos }: { documentos: PedidoDocumento[] }) {
  if (!documentos?.length) {
    return <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>;
  }
  const ordenados = [...documentos].sort((a, b) => a.tipo.localeCompare(b.tipo));
  return (
    <div className="space-y-2">
      {ordenados.map((d) => (
        <DocLinha key={d.id} doc={d} />
      ))}
    </div>
  );
}
