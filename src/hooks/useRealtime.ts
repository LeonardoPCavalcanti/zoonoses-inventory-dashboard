import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface RealtimeBinding {
  /** Nome da tabela em `public`. */
  table: string;
  /** queryKeys a invalidar quando a tabela mudar. */
  keys: readonly unknown[][];
  /** Callback opcional (ex.: toast) ao receber um evento. */
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

/**
 * Assina `postgres_changes` das tabelas informadas e invalida os caches
 * correspondentes — é o que faz o estoque atualizar ao vivo em todos os
 * clientes abertos. Um único canal por instância do hook.
 */
export function useRealtime(bindings: RealtimeBinding[]) {
  const qc = useQueryClient();
  // Mantém o callback mais recente sem recriar o canal.
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    const channel = supabase.channel('estoque-realtime');
    for (const b of ref.current) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: b.table },
        (payload) => {
          const binding = ref.current.find((x) => x.table === b.table);
          binding?.keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
          binding?.onChange?.(payload as RealtimePostgresChangesPayload<Record<string, unknown>>);
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Canal montado uma vez; bindings lidos via ref.
  }, [qc]);
}
