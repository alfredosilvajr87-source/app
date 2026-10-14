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
import { Truck, Plus, Eye, XCircle, Package, Pencil, BadgeCheck } from 'lucide-react';
import DocStatus, { canEdit } from '../components/store/DocStatus';
import PageHeader from '../components/layout/PageHeader';
import ItemLines, { emptyLine, linesTotal } from '../components/store/ItemLines';
import { apiError, formatDateTime, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const PurchasesPage = () => {
  const { user, isAdmin } = useAuth();
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
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const [todayClosed, setTodayClosed] = useState(false);

  useEffect(() => {
    fetchData();
    axios.get(`${API}/cash/day`, { params: { tz_offset: tzOffset() } })
      .then((r) => setTodayClosed(r.data.closed)).catch(() => {});
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
    setEditing(null);
    setHeader({ supplier: '', supplier_doc: '', notes: '' });
    setLines([emptyLine()]);
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setViewing(null);
    setEditing(p);
    setHeader({ supplier: p.supplier || '', supplier_doc: p.supplier_doc || '', notes: p.notes || '' });
    setLines(p.items.map((l) => ({ product_id: l.product_id, quantity: String(l.quantity), price: String(l.unit_cost) })));
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...header,
      tz_offset: tzOffset(),
      items: lines.map((l) => ({
        product_id: l.product_id,
        quantity: parseInt(l.quantity),
        unit_cost: parseFloat(l.price) || 0,
      })),
    };
    try {
      if (editing) {
        const res = await axios.put(`${API}/purchases/${editing.id}`, payload);
        toast.success(`Compra ${res.data.number} atualizada — estoque ajustado`);
      } else {
        const res = await axios.post(`${API}/purchases`, payload);
        toast.success(`Compra ${res.data.number} registrada — estoque atualizado`);
      }
      setFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao salvar a compra'));
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async () => {
    try {
      const res = await axios.post(`${API}/purchases/${reviewing.id}/review`);
      toast.success(res.data.message);
      setReviewing(null);
      setViewing(null);
      fetchData();
    } catch (err) {
      toast.error(apiError(err));
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
      <PageHeader icon={Package} title="Compras" subtitle="Entrada de mercadoria — cada compra soma ao estoque">
        <Button onClick={openNew} disabled={todayClosed || products.length === 0} data-testid="new-purchase-btn">
          <Plus className="h-4 w-4 mr-2" /> Nova compra
        </Button>
      </PageHeader>

      {todayClosed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          O caixa de hoje já foi fechado. Novas compras só depois que um administrador reabrir o caixa.
        </p>
      )}

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
                    <th className="text-right">Total</th><th>Situação</th><th />
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className={p.status === 'cancelada' ? 'opacity-50' : ''}>
                      <td className="font-mono font-medium">{p.number}</td>
                      <td className="text-sm whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                      <td>{p.supplier || '—'}</td>
                      <td className="text-right font-mono">{p.items.reduce((s, i) => s + i.quantity, 0)}</td>
                      <td className="text-right font-mono">{money(p.total)}</td>
                      <td><DocStatus doc={p} /></td>
                      <td className="text-right whitespace-nowrap">
                        {canEdit(p, user, isAdmin) && (
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4 text-slate-400" />
                          </Button>
                        )}
                        {isAdmin && p.status === 'concluida' && !p.reviewed && (
                          <Button variant="ghost" size="icon" title="Revisar" onClick={() => setReviewing(p)}>
                            <BadgeCheck className="h-4 w-4 text-sky-400" />
                          </Button>
                        )}
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
            <DialogTitle className="font-heading">{editing ? `Editar compra ${editing.number}` : 'Nova compra'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'O estoque é ajustado pela diferença. Não é possível reduzir itens que já foram vendidos. Depois de revisada, a compra não pode mais ser editada.'
                : 'Os itens entram no estoque ao salvar. O custo do produto é atualizado pelo custo médio.'}
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
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Registrar compra'}</Button>
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
              <DocStatus doc={viewing} />
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
              <div className="text-sm text-slate-400 space-y-1">
                {viewing.edited_at && <p>Editada em {formatDateTime(viewing.edited_at)} por {viewing.edited_by_name}</p>}
                {viewing.reviewed && <p>Revisada em {formatDateTime(viewing.reviewed_at)} por {viewing.reviewed_by_name}</p>}
                {viewing.notes && <p>Obs.: {viewing.notes}</p>}
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="font-heading text-xl font-bold">{money(viewing.total)}</span>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && viewing.status !== 'cancelada' && !viewing.cash_closed && (
                    <Button variant="outline" className="text-red-700 border-red-300" onClick={() => setCancelling(viewing)}>
                      <XCircle className="h-4 w-4 mr-2" /> Cancelar
                    </Button>
                  )}
                  {canEdit(viewing, user, isAdmin) && (
                    <Button variant="outline" onClick={() => openEdit(viewing)}><Pencil className="h-4 w-4 mr-2" /> Editar</Button>
                  )}
                  {isAdmin && viewing.status === 'concluida' && !viewing.reviewed && (
                    <Button onClick={() => setReviewing(viewing)}><BadgeCheck className="h-4 w-4 mr-2" /> Revisar</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revisar compra {reviewing?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme que itens, quantidades e custos batem com a nota do fornecedor ({reviewing && money(reviewing.total)}).
              Depois de revisada, a compra <b>não poderá mais ser editada</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReview}>Confirmar revisão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
