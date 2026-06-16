import type { PedidoStatus } from '@/data/types';
import type { Role } from '@/auth/roles';

/** Remove acentos e normaliza para um nome de arquivo seguro em Storage. */
export function slugFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clean}${ext.toLowerCase()}`;
}

export function storagePath(pedidoId: string, kind: 'original' | 'aprovado', filename: string): string {
  return `pedidos/${pedidoId}/${kind}/${slugFilename(filename)}`;
}

export function blocoAval(p: { nome: string; cargo: string; quando: string; hash: string }): string {
  const data = new Date(p.quando).toLocaleString('pt-BR');
  return [
    'APROVAÇÃO — Plataforma Zoonoses',
    `Aprovado por: ${p.nome}`,
    `Cargo: ${p.cargo}`,
    `Data e hora: ${data}`,
    `Hash de verificação: ${p.hash}`,
  ].join('\n');
}

export function canAssinar(role: Role | null | undefined, status: PedidoStatus): boolean {
  if (status !== 'AGUARDANDO_ANALISE') return false;
  return role === 'ADMIN' || role === 'FINANCIAL_MANAGER';
}
