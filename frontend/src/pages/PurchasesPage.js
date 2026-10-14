import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Plus, Trash2, Truck, Eye, XCircle } from 'lucide-react';

import { API_URL as API } from '../config';
import { formatBRL, formatQty, formatDateTime } from '../lib/format';

const emptyLine = () => ({ product_id: '', quantity: 1, unit_cost: 0 });

const PurchasesPage = () => {
  const { isAdmin } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [pur, prod] = await Promise.all([
        axios.get(`${API}/purchases`),
        axios.get(`${API}/products`),
      ]);
      setPurchases(pur.data);
      setProducts(prod.data);
    } catch (err) {
      toast.error('Erro ao carregar as compras');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setSupplier('');
    setNotes('');
    setLines([emptyLine()]);
    setDialogOpen(true);
  };

  const updateLine = (index, changes) => {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...changes } : l)));
  };

  const selectProduct = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    updateLine(index, { product_id: productId, unit_cost: product?.cost_price || 0 });
  };

  const lineTotal = (l) => (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_cost) || 0);
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const items = lines
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id,
        quantity: parseFloat(l.quantity) || 0,
        unit_cost: parseFloat(l.unit_cost) || 0,
      }));
    if (items.length === 0) {
      toast.error('Escolha ao menos um produto');
      return;
    }
    if (items.some((i) => i.quantity <= 0)) {
      toast.error('A quantidade precisa ser maior que zero');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/purchases`, { supplier, notes, items });
      toast.success(`Compra ${res.data.purchase_number} registrada e estoque atualizado`);
      setDialogOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Não foi possível registrar a compra');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (purchase) => {
    if (!window.confirm(`Cancelar a compra ${purchase.purchase_number}? Os itens serão retirados do estoque.`)) return;
    try {
      await axios.delete(`${API}/purchases/${purchase.id}`);
      toast.success('Compra cancelada');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Não foi possível cancelar');
    }
  };

  const activeProducts = products.filter((p) => p.active);

  return (
    <div className="space-y-8" data-testid="purchases-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Compras</h1>
          <p className="text-slate-500 mt-1">Entrada de mercadoria no estoque</p>
        </div>
        <Button onClick={openNew} data-testid="new-purchase-btn">
          <Plus className="h-4 w-4 mr-2" />
          Nova compra
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-slate-500">Carregando...</p>
          ) : purchases.length === 0 ? (
            <div className="py-16 text-center">
              <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-6">Nenhuma compra registrada</p>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Registrar compra</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.purchase_number}</TableCell>
                    <TableCell>{formatDateTime(p.created_at)}</TableCell>
                    <TableCell>{p.supplier || '-'}</TableCell>
                    <TableCell className="text-right">
                      {formatQty(p.items.reduce((s, i) => s + i.quantity, 0))}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatBRL(p.total)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" title="Ver itens" onClick={() => setViewing(p)}>
                        <Eye className="h-4 w-4 text-slate-500" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" title="Cancelar compra" onClick={() => handleCancel(p)}>
                          <XCircle className="h-4 w-4 text-slate-500" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Nova compra */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova compra</DialogTitle>
            <DialogDescription>Os itens entram no estoque assim que a compra é registrada.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500">
                <span className="col-span-6">Produto</span>
                <span className="col-span-2">Qtd.</span>
                <span className="col-span-2">Custo unit. (R$)</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              {lines.map((l, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-6">
                    <Select value={l.product_id} onValueChange={(v) => selectProduct(index, v)}>
                      <SelectTrigger><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.flavor ? `· ${p.flavor}` : ''} (estoque {formatQty(p.stock_quantity)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input className="col-span-4 sm:col-span-2" type="number" min="1" step="any"
                    value={l.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                  <Input className="col-span-4 sm:col-span-2" type="number" min="0" step="0.01"
                    value={l.unit_cost} onChange={(e) => updateLine(index, { unit_cost: e.target.value })} />
                  <div className="col-span-3 sm:col-span-1 text-right text-sm">{formatBRL(lineTotal(l))}</div>
                  <Button type="button" variant="ghost" size="icon" className="col-span-1"
                    disabled={lines.length === 1}
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar item
              </Button>
            </div>

            <div className="flex justify-end text-lg font-semibold">Total: {formatBRL(total)}</div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Registrar compra'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhes */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Compra {viewing?.purchase_number}</DialogTitle>
            <DialogDescription>
              {formatDateTime(viewing?.created_at)}
              {viewing?.supplier ? ` · ${viewing.supplier}` : ''}
              {viewing?.created_by_name ? ` · por ${viewing.created_by_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Custo unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewing?.items.map((i) => (
                <TableRow key={i.product_id}>
                  <TableCell>{i.product_name}</TableCell>
                  <TableCell className="text-right">{formatQty(i.quantity)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.unit_cost)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {viewing?.notes && <p className="text-sm text-slate-500">Obs.: {viewing.notes}</p>}
          <div className="flex justify-end text-lg font-semibold">Total: {formatBRL(viewing?.total)}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesPage;
