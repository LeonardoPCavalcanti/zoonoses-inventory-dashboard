import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Skeleton } from '@/components/ui/skeleton';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Renderiza a 1ª página de um PDF (signed URL) num canvas. Imagens caem no <img>. */
export function PdfViewer({ url, filename }: { url: string; filename: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const isImagem = /\.(png|jpe?g|webp|gif)$/i.test(filename);

  useEffect(() => {
    if (isImagem) {
      setCarregando(false);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const pdf = await pdfjs.getDocument({ url }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.2 });
        const canvas = canvasRef.current;
        if (!canvas || cancelado) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch (e) {
        if (!cancelado) setErro(String(e));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [url, isImagem]);

  if (isImagem) {
    return <img src={url} alt={filename} className="max-h-[60vh] w-full rounded-md border object-contain" />;
  }
  if (erro) {
    return <p className="text-sm text-destructive">Não foi possível pré-visualizar. Use o botão de download.</p>;
  }
  return (
    <div className="overflow-auto rounded-md border bg-muted/30 p-2">
      {carregando && <Skeleton className="h-64 w-full" />}
      <canvas ref={canvasRef} className={carregando ? 'hidden' : 'mx-auto'} />
    </div>
  );
}
