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
import { Receipt, Plus, Eye, XCircle, FileText, Search, ShoppingCart, Pencil, BadgeCheck } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import ItemLines, { SELECT_CLASS, emptyLine, linesTotal } from '../components/store/ItemLines';
import DocStatus, { canEdit } from '../components/store/DocStatus';
import {
  PAYMENT_METHODS, apiError, formatDateTime, openInvoice, paymentLabel, tzOffset,
} from '../lib/store';

import { API_URL as API } from '../config';

const EMPTY_HEADER = {
  customer_name: '', customer_doc: '', customer_phone: '', payment_method: 'dinheiro', discount: '', notes: '',
  seller_id: '',
};

const commissionText = (l, money) =>
  l.commission_type === 'percent' ? `${l.commission_rate}%` : `${money(l.commission_rate)}/un`;

const SalesPage = () => {
  const { user, isAdmin } = useAuth();
  const { money } = useStore();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);       // venda em edição (null = nova)
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [lines, setLines] = useState([emptyLine()]);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [sellers, setSellers] = useState([]);

  const [todayClosed, setTodayClosed] = useState(false);

  useEffect(() => {
    fetchData();
    axios.get(`${API}/cash/day`, { params: { tz_offset: tzOffset() } })
      .then((r) => setTodayClosed(r.data.closed)).catch(() => {});
  }, []);

  const fetchData = async () => {
    try {
      const [sRes, prodRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/products`, { params: { include_inactive: false } }),
      ]);
      setSales(sRes.data);
      setProducts(prodRes.data);
      if (isAdmin) setSellers((await axios.get(`${API}/users`)).data.filter((u) => u.active !== false));
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar vendas'));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setHeader(EMPTY_HEADER);
    setLines([emptyLine()]);
    setFormOpen(true);
  };

  const openEdit = (sale) => {
    setViewing(null);
    setEditing(sale);
    setHeader({
      customer_name: sale.customer_name || '', customer_doc: sale.customer_doc || '',
      customer_phone: sale.customer_phone || '', payment_method: sale.payment_method,
      discount: sale.discount ? String(sale.discount) : '', notes: sale.notes || '',
      seller_id: sale.seller_id || '',
    });
    setLines(sale.items.map((l) => ({
      product_id: l.product_id, quantity: String(l.quantity), price: String(l.unit_price),
      commission_type: l.commission_type || 'fixed',
      commission_value: String(l.commission_rate ?? ''),
    })));
    setFormOpen(true);
  };

  const subtotal = linesTotal(lines);
  const discount = parseFloat(header.discount) || 0;

  // Na edição, o estoque disponível inclui o que a própria venda já tinha baixado
  const stockBonus = {};
  (editing?.items || []).forEach((l) => { stockBonus[l.product_id] = (stockBonus[l.product_id] || 0) + l.quantity; });

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
    const payload = {
      ...header,
      seller_id: header.seller_id || null,
      discount,
      tz_offset: tzOffset(),
      items: lines.map((l) => ({
        product_id: l.product_id,
        quantity: parseInt(l.quantity),
        unit_price: parseFloat(l.price) || 0,
        commission_value: l.commission_value === '' ? null : parseFloat(l.commission_value) || 0,
      })),
    };
    try {
      if (editing) {
        const res = await axios.put(`${API}/sales/${editing.id}`, payload);
        toast.success(`Venda ${res.data.number} atualizada`);
      } else {
        const res = await axios.post(`${API}/sales`, payload);
        toast.success(`Venda ${res.data.number} registrada — estoque baixado`, {
          action: { label: 'Abrir fatura', onClick: () => showInvoice(res.data) },
          duration: 10000,
        });
      }
      setFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao salvar a venda'));
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

  const handleReview = async () => {
    try {
      const res = await axios.post(`${API}/sales/${reviewing.id}/review`);
      toast.success(res.data.message);
      setReviewing(null);
      setViewing(null);
      fetchData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const term = search.toLowerCase();
  const visible = sales.filter((s) =>
    [s.number, s.customer_name, s.customer_doc, s.seller_name].some((v) => (v || '').toLowerCase().includes(term))
  );
  const available = products.filter((p) => p.stock > 0 || stockBonus[p.id]);
  const formCommission = lines.reduce((sum, l) => {
    const qty = parseInt(l.quantity) || 0;
    const val = parseFloat(l.commission_value) || 0;
    return sum + (l.commission_type === 'percent' ? qty * (parseFloat(l.price) || 0) * val / 100 : qty * val);
  }, 0);

  return (
    <div className="space-y-6" data-testid="sales-page">
      <PageHeader icon={ShoppingCart} title="Vendas" subtitle="Cada venda baixa o estoque e gera uma fatura em PDF">
        <Button onClick={openNew} disabled={todayClosed || products.filter((p) => p.stock > 0).length === 0} data-testid="new-sale-btn">
          <Plus className="h-4 w-4 mr-2" /> Nova venda
        </Button>
      </PageHeader>

      {todayClosed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          O caixa de hoje já foi fechado. Novas vendas só depois que um administrador reabrir o caixa.
        </p>
      )}

      {!loading && products.filter((p) => p.stock > 0).length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Nenhum produto com estoque. Registre uma compra para poder vender.
        </p>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Buscar por fatura, cliente, CPF/NIF ou vendedor"
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
                    <th>Fatura</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th>
                    <th className="text-right">Total</th><th>Situação</th><th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} className={s.status === 'cancelada' ? 'opacity-50' : ''}>
                      <td className="font-mono font-medium">{s.number}</td>
                      <td className="text-sm whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                      <td>{s.customer_name || 'Consumidor final'}</td>
                      <td className="text-sm">{s.seller_name || s.created_by_name}</td>
                      <td className="text-sm">{paymentLabel(s.payment_method)}</td>
                      <td className="text-right font-mono">{money(s.total)}</td>
                      <td><DocStatus doc={s} /></td>
                      <td className="text-right whitespace-nowrap">
                        {canEdit(s, user, isAdmin) && (
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4 text-slate-400" />
                          </Button>
                        )}
                        {isAdmin && s.status === 'concluida' && !s.reviewed && (
                          <Button variant="ghost" size="icon" title="Revisar" onClick={() => setReviewing(s)}>
                            <BadgeCheck className="h-4 w-4 text-sky-400" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Fatura PDF" onClick={() => showInvoice(s)}>
                          <FileText className="h-4 w-4 text-slate-400" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setViewing(s)}>
                          <Eye className="h-4 w-4 text-slate-400" />
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

      {/* Nova venda / edição */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? `Editar venda ${editing.number}` : 'Nova venda'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'O estoque é ajustado pela diferença entre os itens antigos e os novos. Depois de revisada, a venda não pode mais ser editada.'
                : 'Os itens saem do estoque ao salvar. A comissão de cada item vem do cadastro do produto e pode ser ajustada aqui.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ItemLines
              products={available}
              lines={lines}
              setLines={setLines}
              priceLabel="Preço unit."
              defaultPrice={(p) => p.sale_price}
              showStock
              showCommission
              stockBonus={stockBonus}
              money={money}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {isAdmin && sellers.length > 1 && (
                <div className="space-y-1 sm:col-span-3">
                  <Label>Vendedor (recebe a comissão)</Label>
                  <select className={SELECT_CLASS} value={header.seller_id || editing?.seller_id || user?.id}
                    onChange={(e) => setHeader({ ...header, seller_id: e.target.value })}>
                    {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.job_title ? ` — ${s.job_title}` : ''}</option>)}
                  </select>
                </div>
              )}
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
              <div className="flex justify-between text-sm text-slate-500">
                <span>Comissão do vendedor</span><span className="font-mono">{money(formCommission)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total</span>
                <span className="font-heading text-2xl font-bold">{money(subtotal - discount)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Finalizar venda'}
              </Button>
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
              {' · '}{viewing && paymentLabel(viewing.payment_method)} · vendedor: {viewing?.seller_name || viewing?.created_by_name}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <>
              <DocStatus doc={viewing} />
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Preço</th>
                      <th className="text-right">Total</th><th className="text-right">Comissão</th></tr>
                  </thead>
                  <tbody>
                    {viewing.items.map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.product_name}</td>
                        <td className="text-right font-mono">{i.quantity}</td>
                        <td className="text-right font-mono">{money(i.unit_price)}</td>
                        <td className="text-right font-mono">{money(i.total)}</td>
                        <td className="text-right font-mono whitespace-nowrap">
                          {i.commission != null ? (
                            <>{money(i.commission)}<span className="block text-[11px] text-slate-500">{commissionText(i, money)}</span></>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                {viewing.discount > 0 && <p>Desconto: {money(viewing.discount)}</p>}
                <p>Comissão total: {money(viewing.commission || 0)}</p>
                {isAdmin && <p>Lucro estimado (após comissão): {money(viewing.profit)}</p>}
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
                    <Button variant="outline" onClick={() => setReviewing(viewing)}><BadgeCheck className="h-4 w-4 mr-2" /> Revisar</Button>
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

      <AlertDialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revisar venda {reviewing?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme que itens, valores, pagamento e comissão estão corretos ({reviewing && money(reviewing.total)}).
              Depois de revisada, a venda <b>não poderá mais ser editada</b>.
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
            <AlertDialogTitle>Cancelar venda {cancelling?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos voltam para o estoque e a fatura passa a aparecer como CANCELADA. Depois que o caixa
              do dia for fechado, não será mais possível cancelar.
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
