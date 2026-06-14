import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useProdutos } from '@/data/produtos';
import { useNucleos } from '@/data/nucleos';
import { useCriarPedido } from '@/data/pedidos';
import { useAuth } from '@/auth/AuthProvider';

interface LinhaItem {
  produto_id: string;
  quantidade: string;
}

export default function NovoPedido() {
  const navigate = useNavigate();
  const { role, profile } = useAuth();
  const produtos = useProdutos();
  const nucleos = useNucleos();
  const criar = useCriarPedido();

  const [justificativa, setJustificativa] = useState('');
  const [nucleoId, setNucleoId] = useState('');
  const [itens, setItens] = useState<LinhaItem[]>([{ produto_id: '', quantidade: '' }]);

  const isAdmin = role === 'ADMIN';

  function setItem(i: number, patch: Partial<LinhaItem>) {
    setItens((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  const itensValidos = itens
    .filter((it) => it.produto_id && Number(it.quantidade) > 0)
    .map((it) => ({ produto_id: it.produto_id, quantidade: Number(it.quantidade) }));

  const podeSalvar = justificativa.trim().length > 0 && itensValidos.length > 0 && (!isAdmin || !!nucleoId);

  async function submit() {
    try {
      const rows = await criar.mutateAsync({
        justificativa,
        itens: itensValidos,
        nucleo_id: isAdmin ? nucleoId : undefined,
      });
      const novoId = rows?.[0]?.id;
      navigate(novoId ? `/pedidos/${novoId}` : '/pedidos');
    } catch {
      /* toast tratado no hook */
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Novo pedido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isAdmin ? (
            <div className="space-y-1.5">
              <Label>Nucleo solicitante</Label>
              <Select value={nucleoId} onValueChange={setNucleoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o nucleo" /></SelectTrigger>
                <SelectContent>
                  {(nucleos.data ?? []).map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nucleo: <span className="font-medium text-foreground">{profile?.sector ?? 'seu nucleo'}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label>Itens</Label>
            {itens.map((it, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Select value={it.produto_id} onValueChange={(v) => setItem(i, { produto_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                    <SelectContent>
                      {(produtos.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1.5">
                  <Input
                    type="number" min={1} placeholder="Qtd"
                    value={it.quantidade}
                    onChange={(e) => setItem(i, { quantidade: e.target.value })}
                  />
                </div>
                <Button
                  variant="ghost" size="icon" aria-label="Remover item"
                  disabled={itens.length === 1}
                  onClick={() => setItens((arr) => arr.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItens((arr) => [...arr, { produto_id: '', quantidade: '' }])}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Justificativa</Label>
            <Textarea
              rows={4} value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva a necessidade do pedido"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/pedidos')}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={!podeSalvar || criar.isPending}>
              Criar pedido
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
