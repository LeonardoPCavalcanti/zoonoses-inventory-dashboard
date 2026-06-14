import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { Nucleo } from './types';

export function useNucleos() {
  return useQuery({
    queryKey: qk.nucleos,
    queryFn: async (): Promise<Nucleo[]> => {
      const { data, error } = await supabase.from('nucleos').select('*').order('nome');
      if (error) throw error;
      return data as Nucleo[];
    },
  });
}
