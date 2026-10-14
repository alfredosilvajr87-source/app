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
import { Receipt, Plus, Eye, XCircle, FileText, Search } from 'lucide-react';
import ItemLines, { SELECT_CLASS, emptyLine, linesTotal } from '../components/store/ItemLines';
import {
  PAYMENT_METHODS, apiError, formatDateTime, openInvoice, paymentLabel, tzOffset,
} from '../lib/store';

import { API_URL as API } from '../config';

const EMPTY_HEADER = {
  customer_name: '', customer_doc: '', customer_phone: '', payment_method: 'dinheiro', discount: '', notes: '',
};

const SalesPage = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [lines, setLines] = useState([emptyLine()]);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sRes, prodRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/products`, { params: { include_inactive: false } }),
      ]);
      setSales(sRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar vendas'));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setHeader(EMPTY_HEADER);
    setLines([emptyLine()]);
    setFormOpen(true);
  };

  const subtotal = linesTotal(lines);
  const discount = parseFloat(header.discount) || 0;

  const showInvoice = async (sale) => {
    try {
      await openInvoice(sale);
    } catch (err) {
      toast.error('Falha ao gerar a fatura');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (discount > subtotal) {
      toast.error('O desconto é maior que o total');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/sales`, {
        ...header,
        discount,
        tz_offset: tzOffset(),
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: parseInt(l.quantity),
          unit_price: parseFloat(l.price) || 0,
        })),
      });
      toast.success(`Venda ${res.data.number} registrada — estoque baixado`, {
        action: { label: 'Abrir fatura', onClick: () => showInvoice(res.data) },
        duration: 10000,
      });
      setFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao registrar venda'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    try {
      const res = await axios.post(`${API}/sales/${cancelling.id}/cancel`);
      toast.success(res.data.message);
      setCancelling(null);
      setViewing(null);
      fetchData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const term = search.toLowerCase();
  const visible = sales.filter((s) =>
    [s.number, s.customer_name, s.customer_doc].some((v) => (v || '').toLowerCase().includes(term))
  );
  const available = products.filter((p) => p.stock > 0);

  return (
    <div className="space-y-6" data-testid="sales-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Vendas</h1>
          <p className="text-slate-500 mt-1">Cada venda baixa o estoque e gera uma fatura em PDF</p>
        </div>
        <Button onClick={openNew} disabled={available.length === 0} data-testid="new-sale-btn">
          <Plus className="h-4 w-4 mr-2" /> Nova venda
        </Button>
      </div>

      {!loading && available.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Nenhum produto com estoque. Registre uma compra para poder vender.
        </p>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por número da fatura, cliente ou CPF/NIF"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
            </div>
          ) : sales.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhuma venda registrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fatura</th><th>Data</th><th>Cliente</th><th>Pagamento</th>
                    <th className="text-right">Total</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} className={s.status === 'cancelada' ? 'opacity-50' : ''}>
                      <td className="font-mono font-medium">{s.number}</td>
                      <td className="text-sm">{formatDateTime(s.created_at)}</td>
                      <td>{s.customer_name || 'Consumidor final'}</td>
                      <td className="text-sm">{paymentLabel(s.payment_method)}</td>
                      <td className="text-right font-mono">{money(s.total)}</td>
                      <td>
                        <span className={s.status === 'cancelada' ? 'status-critical' : 'status-ok'}>
                          {s.status === 'cancelada' ? 'Cancelada' : 'Concluída'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="Fatura PDF" onClick={() => showInvoice(s)}>
                          <FileText className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewing(s)}>
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

      {/* Nova venda */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova venda</DialogTitle>
            <DialogDescription>Os itens saem do estoque ao salvar. Só aparecem produtos com estoque.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ItemLines
              products={available}
              lines={lines}
              setLines={setLines}
              priceLabel="Preço unitário"
              defaultPrice={(p) => p.sale_price}
              showStock
              money={money}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-3">
                <Label>Cliente (opcional)</Label>
                <Input value={header.customer_name} placeholder="Consumidor final"
                  onChange={(e) => setHeader({ ...header, customer_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>CPF/NIF</Label>
                <Input value={header.customer_doc}
                  onChange={(e) => setHeader({ ...header, customer_doc: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={header.customer_phone}
                  onChange={(e) => setHeader({ ...header, customer_phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Pagamento</Label>
                <select className={SELECT_CLASS} value={header.payment_method}
                  onChange={(e) => setHeader({ ...header, payment_method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Desconto</Label>
                <Input type="number" min="0" step="0.01" value={header.discount}
                  onChange={(e) => setHeader({ ...header, discount: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={1} value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
              </div>
            </div>
            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span><span className="font-mono">{money(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Desconto</span><span className="font-mono">- {money(discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="font-heading text-2xl font-bold">{money(subtotal - discount)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Finalizar venda'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalhes */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Fatura {viewing?.number}</DialogTitle>
            <DialogDescription>
              {viewing && formatDateTime(viewing.created_at)} · {viewing?.customer_name || 'Consumidor final'}
              {' · '}{viewing && paymentLabel(viewing.payment_method)} · por {viewing?.created_by_name}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <>
              <table className="data-table">
                <thead>
                  <tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Preço</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {viewing.items.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.product_name}</td>
                      <td className="text-right font-mono">{i.quantity}</td>
                      <td className="text-right font-mono">{money(i.unit_price)}</td>
                      <td className="text-right font-mono">{money(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-sm text-slate-600 space-y-1">
                {viewing.discount > 0 && <p>Desconto: {money(viewing.discount)}</p>}
                {isAdmin && <p>Lucro estimado: {money(viewing.profit)}</p>}
                {viewing.notes && <p>Obs.: {viewing.notes}</p>}
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="font-heading text-xl font-bold">{money(viewing.total)}</span>
                <div className="flex gap-2">
                  {isAdmin && viewing.status !== 'cancelada' && (
                    <Button variant="outline" className="text-red-700 border-red-300" onClick={() => setCancelling(viewing)}>
                      <XCircle className="h-4 w-4 mr-2" /> Cancelar venda
                    </Button>
                  )}
                  <Button onClick={() => showInvoice(viewing)}>
                    <FileText className="h-4 w-4 mr-2" /> Fatura PDF
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda {cancelling?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos voltam para o estoque e a fatura passa a aparecer como CANCELADA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">Cancelar venda</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesPage;
