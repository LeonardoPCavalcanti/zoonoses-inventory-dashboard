import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/states';
import { Spinner } from '@/components/shared/states';
import {
  useCadastroMutations,
  useCategorias,
  useFornecedores,
  useSetores,
} from '@/data/cadastros';
import { useAuth } from '@/auth/AuthProvider';
import { useRealtime } from '@/hooks/useRealtime';
import { qk } from '@/lib/queryKeys';

interface Item {
  id: string;
  nome: string;
  contato?: string | null;
}

function ListaCadastro({
  tabela,
  itens,
  loading,
  comContato = false,
}: {
  tabela: 'setores' | 'categorias' | 'fornecedores';
  itens: Item[];
  loading: boolean;
  comContato?: boolean;
}) {
  const { isAdmin } = useAuth();
  const { criar, remover } = useCadastroMutations(tabela);
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');

  async function add() {
    if (!nome.trim()) return;
    const payload: Record<string, unknown> = { nome };
    if (comContato) payload.contato = contato || null;
    try {
      await criar.mutateAsync(payload);
      setNome('');
      setContato('');
    } catch {
      /* toast no hook */
    }
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex flex-wrap items-end gap-2">
          <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="max-w-xs" />
          {comContato && (
            <Input placeholder="Contato" value={contato} onChange={(e) => setContato(e.target.value)} className="max-w-xs" />
          )}
          <Button onClick={() => void add()} disabled={criar.isPending}>
            {criar.isPending ? <Spinner /> : <Plus className="mr-1 h-4 w-4" />} Adicionar
          </Button>
        </div>
      )}
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Apenas administradores podem editar os cadastros base.</p>
      )}

      {loading ? (
        <Spinner />
      ) : itens.length === 0 ? (
        <EmptyState title="Nada cadastrado" />
      ) : (
        <div className="space-y-2">
          {itens.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <span className="text-sm font-medium">{it.nome}</span>
                {comContato && it.contato && (
                  <span className="ml-2 text-xs text-muted-foreground">{it.contato}</span>
                )}
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover"
                  onClick={() => void remover.mutateAsync(it.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Cadastros() {
  const setores = useSetores();
  const categorias = useCategorias();
  const fornecedores = useFornecedores();

  useRealtime([
    { table: 'setores', keys: [qk.setores] },
    { table: 'categorias', keys: [qk.categorias] },
    { table: 'fornecedores', keys: [qk.fornecedores] },
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cadastros base</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="setores">
          <TabsList>
            <TabsTrigger value="setores">Setores</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          </TabsList>
          <TabsContent value="setores" className="pt-4">
            <ListaCadastro tabela="setores" itens={setores.data ?? []} loading={setores.isLoading} />
          </TabsContent>
          <TabsContent value="categorias" className="pt-4">
            <ListaCadastro tabela="categorias" itens={categorias.data ?? []} loading={categorias.isLoading} />
          </TabsContent>
          <TabsContent value="fornecedores" className="pt-4">
            <ListaCadastro
              tabela="fornecedores"
              itens={fornecedores.data ?? []}
              loading={fornecedores.isLoading}
              comContato
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
