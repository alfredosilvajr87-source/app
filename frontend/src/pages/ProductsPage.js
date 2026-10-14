import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Package, Plus, Pencil, Trash2, Search, SlidersHorizontal, History, Sparkles, Tags } from 'lucide-react';
import { apiError, formatDateTime, productLabel, stockStatus } from '../lib/store';

import { API_URL as API } from '../config';

const EMPTY_FORM = {
  name: '', brand: '', flavor: '', puffs: '', sku: '',
  cost_price: '', sale_price: '', min_stock: '', active: true,
};

const MOVEMENT_LABELS = { entrada: 'Entrada', saida: 'Saída', estorno: 'Estorno', ajuste: 'Ajuste' };

const ProductsPage = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleting, setDeleting] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ new_stock: '', reason: '' });
  const [historyOf, setHistoryOf] = useState(null);
  const [movements, setMovements] = useState([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('130');

  const handleBulkPrice = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/products/bulk-price`, { sale_price: parseFloat(bulkPrice) || 0 });
      toast.success(res.data.message);
      setBulkOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products`);
      setProducts(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar produtos'));
    } finally {
      setLoading(false);
    }
  };

  const seedVapers = async () => {
    try {
      const res = await axios.post(`${API}/products/seed-vapers`);
      toast.success(res.data.message);
      fetchProducts();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p, puffs: p.puffs || '' });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      flavor: form.flavor.trim(),
      puffs: parseInt(form.puffs) || 0,
      sku: form.sku.trim(),
      cost_price: parseFloat(form.cost_price) || 0,
      sale_price: parseFloat(form.sale_price) || 0,
      min_stock: parseInt(form.min_stock) || 0,
      active: form.active,
    };
    try {
      if (editing) {
        await axios.put(`${API}/products/${editing.id}`, payload);
        toast.success('Produto atualizado');
      } else {
        await axios.post(`${API}/products`, payload);
        toast.success('Produto cadastrado');
      }
      setFormOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao salvar produto'));
    }
  };

  const handleDelete = async () => {
    try {
      const res = await axios.delete(`${API}/products/${deleting.id}`);
      toast.success(res.data.message);
      setDeleting(null);
      fetchProducts();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const openAdjust = (p) => {
    setAdjusting(p);
    setAdjustForm({ new_stock: String(p.stock), reason: '' });
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/products/${adjusting.id}/adjust`, {
        new_stock: parseInt(adjustForm.new_stock) || 0,
        reason: adjustForm.reason,
      });
      toast.success('Estoque ajustado');
      setAdjusting(null);
      fetchProducts();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const openHistory = async (p) => {
    setHistoryOf(p);
    setMovements([]);
    try {
      const res = await axios.get(`${API}/stock-movements`, { params: { product_id: p.id } });
      setMovements(res.data);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const term = search.toLowerCase();
  const visible = products.filter((p) =>
    (showInactive || p.active) &&
    [p.name, p.brand, p.flavor, p.sku].some((v) => (v || '').toLowerCase().includes(term))
  );

  return (
    <div className="space-y-6" data-testid="products-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Produtos</h1>
          <p className="text-slate-500 mt-1">Cadastro de vapers, preços e estoque atual</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {products.length > 0 && (
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <Tags className="h-4 w-4 mr-2" /> Preço para todos
              </Button>
            )}
            <Button onClick={openNew} data-testid="new-product-btn">
              <Plus className="h-4 w-4 mr-2" /> Novo produto
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, marca, sabor ou SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          Mostrar inativos
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">Nenhum produto cadastrado ainda</p>
              {isAdmin && (
                <div className="flex justify-center gap-2 flex-wrap">
                  <Button onClick={seedVapers} variant="outline" data-testid="seed-vapers-btn">
                    <Sparkles className="h-4 w-4 mr-2" /> Carregar 10 vapers de exemplo
                  </Button>
                  <Button onClick={openNew}>Cadastrar manualmente</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>SKU</th>
                    <th className="text-right">Custo</th>
                    <th className="text-right">Venda</th>
                    <th className="text-right">Estoque</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const st = stockStatus(p);
                    return (
                      <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                        <td>
                          <p className="font-medium">{productLabel(p)}</p>
                          <p className="text-xs text-slate-500">
                            {[p.brand, p.puffs ? `${p.puffs.toLocaleString('pt-BR')} puffs` : null, !p.active && 'Inativo']
                              .filter(Boolean).join(' · ')}
                          </p>
                        </td>
                        <td className="font-mono text-slate-500 whitespace-nowrap">{p.sku}</td>
                        <td className="text-right font-mono">{money(p.cost_price)}</td>
                        <td className="text-right font-mono">{money(p.sale_price)}</td>
                        <td className="text-right font-mono font-semibold">
                          {p.stock}
                          <span className="text-xs text-slate-400 font-normal"> / mín {p.min_stock}</span>
                        </td>
                        <td><span className={`status-${st.key}`}>{st.label}</span></td>
                        <td className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="Histórico" onClick={() => openHistory(p)}>
                            <History className="h-4 w-4 text-slate-500" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" title="Ajustar estoque" onClick={() => openAdjust(p)}>
                                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(p)}>
                                <Pencil className="h-4 w-4 text-slate-500" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleting(p)}>
                                <Trash2 className="h-4 w-4 text-slate-500" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-8">Nenhum produto encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cadastro / edição */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>
              O estoque não é editado aqui: ele muda pelas compras, vendas ou pelo ajuste de estoque.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Ignite V80" required />
              </div>
              <div className="space-y-1">
                <Label>Marca</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Sabor</Label>
                <Input value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Puffs</Label>
                <Input type="number" min="0" value={form.puffs}
                  onChange={(e) => setForm({ ...form, puffs: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>SKU / código</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Preço de custo</Label>
                <Input type="number" min="0" step="0.01" value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Preço de venda *</Label>
                <Input type="number" min="0" step="0.01" value={form.sale_price} required
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Estoque mínimo</Label>
                <Input type="number" min="0" value={form.min_stock}
                  onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm pt-6">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                Ativo para venda
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preço único para todos */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Preço de venda para todos</DialogTitle>
            <DialogDescription>
              Define o mesmo preço de venda para todos os produtos ativos. Vendas já feitas não mudam.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkPrice} className="space-y-4">
            <div className="space-y-1">
              <Label>Novo preço de venda</Label>
              <Input type="number" min="0" step="0.01" required value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)} />
              <p className="text-xs text-slate-500">{money(parseFloat(bulkPrice) || 0)} por unidade</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>Cancelar</Button>
              <Button type="submit">Aplicar a todos</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ajuste de estoque */}
      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Ajustar estoque</DialogTitle>
            <DialogDescription>
              Use após uma contagem física. Estoque atual de {adjusting && productLabel(adjusting)}: {adjusting?.stock}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <div className="space-y-1">
              <Label>Quantidade contada</Label>
              <Input type="number" min="0" required value={adjustForm.new_stock}
                onChange={(e) => setAdjustForm({ ...adjustForm, new_stock: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={adjustForm.reason} placeholder="Ex.: contagem mensal, produto avariado"
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjusting(null)}>Cancelar</Button>
              <Button type="submit">Salvar ajuste</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Histórico de movimentações */}
      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Movimentações</DialogTitle>
            <DialogDescription>{historyOf && productLabel(historyOf)}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {movements.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Nenhuma movimentação</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Documento</th><th className="text-right">Qtd</th><th className="text-right">Saldo</th></tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-sm">{formatDateTime(m.created_at)}</td>
                      <td>{MOVEMENT_LABELS[m.type] || m.type}</td>
                      <td className="text-sm text-slate-500">{m.ref_number || m.note}</td>
                      <td className={`text-right font-mono ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="text-right font-mono">{m.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir "{deleting && productLabel(deleting)}"? Se ele já tiver compras ou vendas, será apenas
              desativado para manter o histórico e as faturas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductsPage;
