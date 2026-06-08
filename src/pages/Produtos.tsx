import { useMemo, useState } from 'react';
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/shared/states';
import { useEstoque, useProdutos, useProdutoMutations, type ProdutoInput } from '@/data/produtos';
import { useLotes, useLoteMutations } from '@/data/lotes';
import { useCategorias, useFornecedores, useSetores } from '@/data/cadastros';
import { diasAteValidade } from '@/data/dashboard';
import type { Produto } from '@/data/types';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

export default function Produtos() {
  const produtos = useProdutos();
  const estoque = useEstoque();
  const [busca, setBusca] = useState('');

  useRealtime([
    { table: 'produtos', keys: [qk.produtos, qk.estoque] },
    { table: 'lotes', keys: [qk.estoque, qk.lotes()] },
    { table: 'movimentacoes', keys: [qk.estoque] },
  ]);

  const estoqueMap = useMemo(
    () => new Map((estoque.data ?? []).map((e) => [e.produto_id, e])),
    [estoque.data],
  );

  if (produtos.isError) return <ErrorState error={produtos.error} />;

  const itens = (produtos.data ?? []).filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input
          placeholder="Buscar produto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <ProdutoDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {produtos.isLoading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : itens.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nenhum produto" hint="Cadastre o primeiro produto para começar." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="w-[120px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((p) => {
                  const e = estoqueMap.get(p.id);
                  const dias = diasAteValidade(e?.proxima_validade ?? null);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">{p.categoria?.nome ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.setor?.nome ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {e?.estoque_baixo ? (
                          <Badge variant="destructive">
                            {e.estoque_total} {p.unidade}
                          </Badge>
                        ) : (
                          <span className="text-sm">
                            {e?.estoque_total ?? 0} {p.unidade}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {dias === null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={dias <= 30 ? 'border-amber-500/40 text-amber-600 dark:text-amber-400' : ''}
                          >
                            {dias < 0 ? 'vencido' : `${dias} dias`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <LotesDialog produto={p} />
                          <ProdutoDialog produto={p} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const NENHUM = '__none__';

function ProdutoDialog({ produto }: { produto?: Produto }) {
  const editing = Boolean(produto);
  const [open, setOpen] = useState(false);
  const { criar, atualizar } = useProdutoMutations();
  const categorias = useCategorias();
  const fornecedores = useFornecedores();
  const setores = useSetores();

  const [form, setForm] = useState<ProdutoInput>({
    nome: produto?.nome ?? '',
    categoria_id: produto?.categoria_id ?? null,
    fornecedor_id: produto?.fornecedor_id ?? null,
    setor_id: produto?.setor_id ?? null,
    unidade: produto?.unidade ?? 'un',
    estoque_minimo: produto?.estoque_minimo ?? 0,
  });

  async function submit() {
    if (!form.nome.trim()) return;
    try {
      if (editing && produto) await atualizar.mutateAsync({ id: produto.id, ...form });
      else await criar.mutateAsync(form);
      setOpen(false);
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-1 h-4 w-4" /> Novo produto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PickField
              label="Categoria"
              value={form.categoria_id}
              onChange={(v) => setForm({ ...form, categoria_id: v })}
              options={(categorias.data ?? []).map((c) => ({ id: c.id, nome: c.nome }))}
            />
            <PickField
              label="Setor"
              value={form.setor_id}
              onChange={(v) => setForm({ ...form, setor_id: v })}
              options={(setores.data ?? []).map((s) => ({ id: s.id, nome: s.nome }))}
            />
          </div>
          <PickField
            label="Fornecedor"
            value={form.fornecedor_id}
            onChange={(v) => setForm({ ...form, fornecedor_id: v })}
            options={(fornecedores.data ?? []).map((f) => ({ id: f.id, nome: f.nome }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Estoque mínimo</Label>
              <Input
                type="number"
                min={0}
                value={form.estoque_minimo}
                onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={criar.isPending || atualizar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { id: string; nome: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ?? NENHUM} onValueChange={(v) => onChange(v === NENHUM ? null : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUM}>—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LotesDialog({ produto }: { produto: Produto }) {
  const [open, setOpen] = useState(false);
  const lotes = useLotes(open ? produto.id : undefined);
  const { criar, remover } = useLoteMutations();
  const [codigo, setCodigo] = useState('');
  const [validade, setValidade] = useState('');

  async function add() {
    try {
      await criar.mutateAsync({ produto_id: produto.id, codigo: codigo || null, validade: validade || null });
      setCodigo('');
      setValidade('');
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Lotes">
          <Boxes className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lotes — {produto.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {(lotes.data ?? []).map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>
                <span className="font-medium">{l.codigo || 'sem código'}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · saldo {l.quantidade}
                  {l.validade ? ` · val. ${new Date(l.validade).toLocaleDateString('pt-BR')}` : ''}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover lote"
                onClick={() => void remover.mutateAsync({ id: l.id, produto_id: produto.id })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {(lotes.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum lote. A quantidade vem das movimentações.</p>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 border-t pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Código</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: LOTE-2026" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Validade</Label>
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </div>
          <Button onClick={() => void add()} disabled={criar.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
