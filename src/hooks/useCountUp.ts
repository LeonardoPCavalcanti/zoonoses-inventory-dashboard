import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Anima um número até `target` (de mount e a cada mudança), com easing.
 * Respeita prefers-reduced-motion (assume o valor final na hora).
 * Retorna `{ value, changed }` — `changed` fica true por ~1s após uma
 * mudança de valor pós-mount (usado para o realce de tempo real).
 */
export function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target);
  const [changed, setChanged] = useState(false);
  const fromRef = useRef(target);
  const firstRef = useRef(true);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    // Sinaliza mudança (exceto no primeiro render) para o pulse.
    if (!firstRef.current) {
      setChanged(true);
      const t = setTimeout(() => setChanged(false), 1100);
      // limpa no cleanup abaixo
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (prefersReducedMotion()) {
        setValue(target);
        fromRef.current = target;
        return () => clearTimeout(t);
      }
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setValue(Math.round(from + (target - from) * eased));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
        else fromRef.current = target;
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        clearTimeout(t);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    // Primeiro render: count-up de 0 → target (sem marcar "changed").
    firstRef.current = false;
    if (prefersReducedMotion()) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const start = performance.now();
    const begin = 0;
    setValue(0);
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(begin + (target - begin) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return { value, changed };
}
