import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';

export interface AssinaturaCanvasHandle {
  toDataURL: () => string | null;
  clear: () => void;
}

/** Canvas de assinatura (mouse/touch) → PNG data URL. */
export const AssinaturaCanvas = forwardRef<AssinaturaCanvasHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { penColor: '#0f172a' });
    return () => padRef.current?.off();
  }, []);

  useImperativeHandle(ref, () => ({
    toDataURL: () => (padRef.current && !padRef.current.isEmpty() ? padRef.current.toDataURL('image/png') : null),
    clear: () => padRef.current?.clear(),
  }));

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-md border bg-white"
        aria-label="Área de assinatura"
      />
      <Button type="button" variant="ghost" size="sm" onClick={() => padRef.current?.clear()}>
        Limpar assinatura
      </Button>
    </div>
  );
});
AssinaturaCanvas.displayName = 'AssinaturaCanvas';
