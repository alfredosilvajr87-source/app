import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Truck, Plus, Eye, XCircle } from 'lucide-react';
import ItemLines, { emptyLine, linesTotal } from '../components/store/ItemLines';
import { apiError, formatDateTime, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const PurchasesPage = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState({ supplier: '', supplier_doc: '', notes: '' });
  const [lines, setLines] = useState([emptyLine()]);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, prodRes] = await Promise.all([
        axios.get(`${API}/purchases`),
        axios.get(`${API}/products`, { params: { include_inactive: false } }),
      ]);
      setPurchases(pRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar compras'));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setHeader({ supplier: '', supplier_doc: '', notes: '' });
    setLines([emptyLine()]);
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.post(`${API}/purchases`, {
        ...header,
        tz_offset: tzOffset(),
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: parseInt(l.quantity),
          unit_cost: parseFloat(l.price) || 0,
        })),
      });
      toast.success(`Compra ${res.data.number} registrada — estoque atualizado`);
      setFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao registrar compra'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      const res = await axios.post(`${API}/purchases/${cancelling.id}/cancel`);
      toast.success(res.data.message);
      setCancelling(null);
      setViewing(null);
      fetchData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="purchases-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Compras</h1>
          <p className="text-slate-500 mt-1">Entrada de mercadoria — cada compra soma ao estoque</p>
        </div>
        <Button onClick={openNew} disabled={products.length === 0} data-testid="new-purchase-btn">
          <Plus className="h-4 w-4 mr-2" /> Nova compra
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : purchases.length === 0 ? (
            <div className="py-16 text-center">
              <Truck className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">
                {products.length === 0 ? 'Cadastre produtos antes de registrar compras' : 'Nenhuma compra registrada'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Número</th><th>Data</th><th>Fornecedor</th><th className="text-right">Itens</th>
                    <th className="text-right">Total</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className={p.status === 'cancelada' ? 'opacity-50' : ''}>
                      <td className="font-mono font-medium">{p.number}</td>
                      <td className="text-sm">{formatDateTime(p.created_at)}</td>
                      <td>{p.supplier || '—'}</td>
                      <td className="text-right font-mono">{p.items.reduce((s, i) => s + i.quantity, 0)}</td>
                      <td className="text-right font-mono">{money(p.total)}</td>
                      <td>
                        <span className={p.status === 'cancelada' ? 'status-critical' : 'status-ok'}>
                          {p.status === 'cancelada' ? 'Cancelada' : 'Concluída'}
                        </span>
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewing(p)}>
                          <Eye className="h-4 w-4 text-slate-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nova compra */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova compra</DialogTitle>
            <DialogDescription>
              Os itens entram no estoque ao salvar. O custo do produto é atualizado pelo custo médio.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Input value={header.supplier} onChange={(e) => setHeader({ ...header, supplier: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Nº da nota do fornecedor</Label>
                <Input value={header.supplier_doc}
                  onChange={(e) => setHeader({ ...header, supplier_doc: e.target.value })} />
              </div>
            </div>
            <ItemLines
              products={products}
              lines={lines}
              setLines={setLines}
              priceLabel="Custo unitário"
              defaultPrice={(p) => p.cost_price}
              money={money}
            />
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea rows={2} value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-slate-500">Total da compra</span>
              <span className="font-heading text-2xl font-bold">{money(linesTotal(lines))}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Registrar compra'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhes */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Compra {viewing?.number}</DialogTitle>
            <DialogDescription>
              {viewing && formatDateTime(viewing.created_at)} · {viewing?.supplier || 'Sem fornecedor'}
              {viewing?.supplier_doc && ` · Nota ${viewing.supplier_doc}`} · por {viewing?.created_by_name}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <>
              <table className="data-table">
                <thead>
                  <tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Custo</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {viewing.items.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.product_name}</td>
                      <td className="text-right font-mono">{i.quantity}</td>
                      <td className="text-right font-mono">{money(i.unit_cost)}</td>
                      <td className="text-right font-mono">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewing.notes && <p className="text-sm text-slate-600">Obs.: {viewing.notes}</p>}
              <div className="flex justify-between items-center">
                <span className="font-heading text-xl font-bold">{money(viewing.total)}</span>
                {isAdmin && viewing.status !== 'cancelada' && (
                  <Button variant="outline" className="text-red-700 border-red-300" onClick={() => setCancelling(viewing)}>
                    <XCircle className="h-4 w-4 mr-2" /> Cancelar compra
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar compra {cancelling?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              As quantidades desta compra serão retiradas do estoque. Não é possível cancelar se os
              itens já tiverem sido vendidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">Cancelar compra</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PurchasesPage;
