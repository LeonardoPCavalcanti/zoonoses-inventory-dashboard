// Tipos do domínio — espelham o schema Postgres (supabase/migrations).

export type Papel = 'admin' | 'operador';
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste';

export interface Profile {
  id: string;
  nome: string;
  papel: Papel;
  created_at: string;
}

export interface Setor {
  id: string;
  nome: string;
  created_at: string;
}

export interface Categoria {
  id: string;
  nome: string;
  created_at: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  contato: string | null;
  created_at: string;
}

export interface Produto {
  id: string;
  nome: string;
  categoria_id: string | null;
  fornecedor_id: string | null;
  setor_id: string | null;
  unidade: string;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
  // joins opcionais
  categoria?: Pick<Categoria, 'id' | 'nome'> | null;
  fornecedor?: Pick<Fornecedor, 'id' | 'nome'> | null;
  setor?: Pick<Setor, 'id' | 'nome'> | null;
}

export interface Lote {
  id: string;
  produto_id: string;
  codigo: string | null;
  validade: string | null;
  quantidade: number;
  created_at: string;
}

export interface Movimentacao {
  id: string;
  produto_id: string;
  lote_id: string | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string | null;
  responsavel_id: string | null;
  created_at: string;
  // joins opcionais
  produto?: Pick<Produto, 'id' | 'nome' | 'unidade'> | null;
  responsavel?: Pick<Profile, 'id' | 'nome'> | null;
}

/** Linha da view vw_estoque_produto. */
export interface EstoqueProduto {
  produto_id: string;
  nome: string;
  unidade: string;
  estoque_minimo: number;
  setor_id: string | null;
  categoria_id: string | null;
  ativo: boolean;
  estoque_total: number;
  estoque_baixo: boolean;
  proxima_validade: string | null;
}
