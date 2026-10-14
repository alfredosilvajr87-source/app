import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Plus, Pencil, Trash2, Package, History, Search } from 'lucide-react';

import { API_URL as API } from '../config';
import { formatBRL, formatQty, formatDateTime } from '../lib/format';

const emptyForm = {
  name: '', brand: '', flavor: '', puffs: 0, nicotine: '', sku: '',
  cost_price: 0, sale_price: 0, minimum_stock: 0, active: true,
};

const movementLabels = {
  purchase: { label: 'Compra', className: 'bg-emerald-100 text-emerald-700' },
  sale: { label: 'Venda', className: 'bg-blue-100 text-blue-700' },
  adjustment: { label: 'Ajuste', className: 'bg-amber-100 text-amber-700' },
};

const ProductsPage = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [movements, setMovements] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products`);
      setProducts(res.data);
    } catch (err) {
      toast.error('Erro ao carregar os produtos');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setFormData({
      name: p.name, brand: p.brand, flavor: p.flavor, puffs: p.puffs, nicotine: p.nicotine,
      sku: p.sku, cost_price: p.cost_price, sale_price: p.sale_price,
      minimum_stock: p.minimum_stock, active: p.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      puffs: parseInt(formData.puffs, 10) || 0,
      cost_price: parseFloat(formData.cost_price) || 0,
      sale_price: parseFloat(formData.sale_price) || 0,
      minimum_stock: parseFloat(formData.minimum_stock) || 0,
    };
    try {
      if (editing) {
        await axios.put(`${API}/products/${editing.id}`, payload);
        toast.success('Produto atualizado');
      } else {
        await axios.post(`${API}/products`, payload);
        toast.success('Produto cadastrado');
      }
      setDialogOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Não foi possível salvar');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Excluir "${p.name}"?`)) return;
    try {
      await axios.delete(`${API}/products/${p.id}`);
      toast.success('Produto excluído');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Não foi possível excluir');
    }
  };

  const openHistory = async (p) => {
    setHistoryProduct(p);
    setMovements([]);
    try {
      const res = await axios.get(`${API}/stock-movements`, { params: { product_id: p.id } });
      setMovements(res.data);
    } catch (err) {
      toast.error('Erro ao carregar o histórico');
    }
  };

  const field = (key) => ({
    value: formData[key],
    onChange: (e) => setFormData({ ...formData, [key]: e.target.value }),
  });

  const filtered = products.filter((p) =>
    `${p.name} ${p.brand} ${p.flavor} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
  );
  const totalUnits = products.reduce((s, p) => s + (p.stock_quantity || 0), 0);
  const stockValue = products.reduce((s, p) => s + (p.stock_quantity || 0) * (p.cost_price || 0), 0);
  const lowStock = products.filter((p) => p.active && p.stock_quantity <= p.minimum_stock).length;

  return (
    <div className="space-y-8" data-testid="products-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Vapers</h1>
          <p className="text-slate-500 mt-1">Catálogo de produtos e estoque atual</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} data-testid="new-product-btn">
            <Plus className="h-4 w-4 mr-2" />
            Novo produto
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-sm text-slate-500">Unidades em estoque</p>
          <p className="text-2xl font-bold text-slate-900">{formatQty(totalUnits)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-slate-500">Valor do estoque (custo)</p>
          <p className="text-2xl font-bold text-slate-900">{formatBRL(stockValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-slate-500">Abaixo do mínimo</p>
          <p className={`text-2xl font-bold ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>{lowStock}</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por nome, marca, sabor ou código"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-slate-500">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum produto encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Sabor</TableHead>
                  <TableHead className="text-right">Puffs</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const low = p.stock_quantity <= p.minimum_stock;
                  return (
                    <TableRow key={p.id} className={p.active ? '' : 'opacity-50'}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.brand}{p.nicotine ? ` · ${p.nicotine}` : ''}</div>
                      </TableCell>
                      <TableCell>{p.flavor}</TableCell>
                      <TableCell className="text-right">{p.puffs ? formatQty(p.puffs) : '-'}</TableCell>
                      <TableCell className="text-right">{formatBRL(p.cost_price)}</TableCell>
                      <TableCell className="text-right">{formatBRL(p.sale_price)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={low ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}>
                          {formatQty(p.stock_quantity)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="Histórico de estoque" onClick={() => openHistory(p)}>
                          <History className="h-4 w-4 text-slate-500" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Excluir" onClick={() => handleDelete(p)}>
                              <Trash2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>
              O estoque não é editado aqui: ele entra pelas compras e sai pelas vendas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome</Label>
                <Input {...field('name')} required />
              </div>
              <div className="space-y-2"><Label>Marca</Label><Input {...field('brand')} /></div>
              <div className="space-y-2"><Label>Sabor</Label><Input {...field('flavor')} /></div>
              <div className="space-y-2"><Label>Puffs</Label><Input type="number" min="0" {...field('puffs')} /></div>
              <div className="space-y-2"><Label>Nicotina</Label><Input {...field('nicotine')} placeholder="ex.: 5%" /></div>
              <div className="space-y-2"><Label>Código (SKU)</Label><Input {...field('sku')} /></div>
              <div className="space-y-2"><Label>Estoque mínimo</Label><Input type="number" min="0" step="any" {...field('minimum_stock')} /></div>
              <div className="space-y-2"><Label>Preço de custo (R$)</Label><Input type="number" min="0" step="0.01" {...field('cost_price')} /></div>
              <div className="space-y-2"><Label>Preço de venda (R$)</Label><Input type="number" min="0" step="0.01" {...field('sale_price')} /></div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch checked={formData.active} onCheckedChange={(v) => setFormData({ ...formData, active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editing ? 'Salvar' : 'Cadastrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyProduct} onOpenChange={(open) => !open && setHistoryProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Histórico de estoque</DialogTitle>
            <DialogDescription>{historyProduct?.name}</DialogDescription>
          </DialogHeader>
          {movements.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Nenhuma movimentação ainda</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => {
                    const t = movementLabels[m.type] || { label: m.type, className: '' };
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{formatDateTime(m.created_at)}</TableCell>
                        <TableCell><Badge variant="secondary" className={t.className}>{t.label}</Badge></TableCell>
                        <TableCell className={`text-right font-medium ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {m.quantity > 0 ? '+' : ''}{formatQty(m.quantity)}
                        </TableCell>
                        <TableCell className="text-right">{formatQty(m.balance_after)}</TableCell>
                        <TableCell className="text-xs">{m.created_by_name}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsPage;
