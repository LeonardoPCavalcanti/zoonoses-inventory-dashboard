// Tipos do domínio — espelham o schema Postgres (supabase/migrations).

import type { Role } from '@/auth/roles';

export type { Role };
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'REJECTED';
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste';

export interface Profile {
  id: string;
  nome: string;
  role: Role | null;
  status: UserStatus;
  sector: string | null;
  nucleo_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

/** Linha do painel admin (profiles + e-mail de auth.users via RPC). */
export interface AdminUser {
  id: string;
  nome: string;
  email: string;
  role: Role | null;
  status: UserStatus;
  sector: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface UserAuditEntry {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  action: string;
  from_role: Role | null;
  to_role: Role | null;
  from_status: UserStatus | null;
  to_status: UserStatus | null;
  note: string | null;
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

export type PedidoStatus =
  | 'AGUARDANDO_ANALISE' | 'EM_REVISAO' | 'APROVADO' | 'REJEITADO'
  | 'ENVIADO' | 'CONCLUIDO' | 'CONCLUIDO_PARCIAL';
export type DocumentoTipo = 'ORIGINAL' | 'APROVADO';
export type PedidoEventoTipo =
  | 'CRIADO' | 'CRITICADO' | 'RESUBMETIDO' | 'APROVADO' | 'REJEITADO'
  | 'ENVIADO' | 'ENTREGA_CONFIRMADA' | 'CONCLUIDO';

export interface Nucleo {
  id: string;
  nome: string;
  codigo: string;
  created_at: string;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  produto_id: string;
  qtd_solicitada: number;
  qtd_aprovada: number | null;
  qtd_recebida: number | null;
  produto?: Pick<Produto, 'id' | 'nome' | 'unidade'> | null;
}

export interface PedidoCritica {
  id: string;
  pedido_id: string;
  autor_id: string | null;
  motivo: string;
  created_at: string;
  autor?: Pick<Profile, 'id' | 'nome'> | null;
}

export interface PedidoEvento {
  id: string;
  pedido_id: string;
  tipo: PedidoEventoTipo;
  ator_id: string | null;
  dados: Record<string, unknown> | null;
  created_at: string;
  ator?: Pick<Profile, 'id' | 'nome'> | null;
}

export interface Pedido {
  id: string;
  codigo: string;
  status: PedidoStatus;
  justificativa: string;
  nucleo_id: string;
  solicitante_id: string | null;
  analista_id: string | null;
  analisado_em: string | null;
  devolvido_em: string | null;
  enviado_por: string | null;
  enviado_em: string | null;
  entrega_remetente_por: string | null;
  entrega_remetente_em: string | null;
  entrega_destinatario_por: string | null;
  entrega_destinatario_em: string | null;
  created_at: string;
  updated_at: string;
  // joins opcionais
  nucleo?: Pick<Nucleo, 'id' | 'nome' | 'codigo'> | null;
  solicitante?: Pick<Profile, 'id' | 'nome'> | null;
  itens?: PedidoItem[];
  documentos?: PedidoDocumento[];
}

export type DocumentoTipoVal = 'ORIGINAL' | 'APROVADO';

export interface PedidoDocumento {
  id: string;
  pedido_id: string;
  tipo: DocumentoTipoVal;
  storage_path: string;
  filename: string;
  enviado_por: string | null;
  enviado_em: string;
  assinatura_png: string | null;
  hash_sha256: string | null;
}
