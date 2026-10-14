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
import { Link } from 'react-router-dom';
import { Truck, Plus, Eye, XCircle, Package, Pencil, BadgeCheck, Receipt, Boxes, Trash2 } from 'lucide-react';
import { SELECT_CLASS } from '../components/store/ItemLines';
import DocStatus, { canEdit } from '../components/store/DocStatus';
import PageHeader from '../components/layout/PageHeader';
import ItemLines, { emptyLine, linesTotal } from '../components/store/ItemLines';
import { apiError, formatDateTime, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const emptyExpense = () => ({ description: '', category: 'Energia', amount: '', date: localToday(), notes: '' });

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
  // Tipo do lançamento: mercadoria (entra no estoque) ou despesa (só admin; vai para o Financeiro)
  const [kind, setKind] = useState('mercadoria');
  const [tab, setTab] = useState('mercadoria');
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [expense, setExpense] = useState(emptyExpense());
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchData();
    axios.get(`${API}/cash/day`, { params: { tz_offset: tzOffset() } })
      .then((r) => setTodayClosed(r.data.closed)).catch(() => {});
    if (isAdmin) {
      axios.get(`${API}/finance/categories`).then((r) => setCategories(r.data)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [pRes, prodRes, eRes] = await Promise.all([
        axios.get(`${API}/purchases`),
        axios.get(`${API}/products`, { params: { include_inactive: false } }),
        isAdmin ? axios.get(`${API}/expenses`, { params: { tz_offset: tzOffset() } }) : null,
      ]);
      setPurchases(pRes.data);
      setProducts(prodRes.data);
      if (eRes) setExpenses(eRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar compras'));
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setKind(todayClosed || products.length === 0 ? (isAdmin ? 'despesa' : 'mercadoria') : 'mercadoria');
    setHeader({ supplier: '', supplier_doc: '', notes: '' });
    setLines([emptyLine()]);
    setExpense(emptyExpense());
    setFormOpen(true);
  };

  const saveExpense = async () => {
    const payload = {
      description: expense.description, category: expense.category, date: expense.date,
      notes: expense.notes || '', amount: parseFloat(expense.amount) || 0,
    };
    if (expense.id) {
      await axios.put(`${API}/expenses/${expense.id}`, payload);
      toast.success('Despesa atualizada');
    } else {
      const res = await axios.post(`${API}/expenses`, payload);
      toast.success(`Despesa "${res.data.description}" lançada no Financeiro`);
    }
  };

  const openEditExpense = (x) => {
    setEditing(null);
    setKind('despesa');
    setExpense({ ...x, amount: String(x.amount), notes: x.notes || '' });
    setFormOpen(true);
  };

  const handleDeleteExpense = async () => {
    try {
      await axios.delete(`${API}/expenses/${deletingExpense.id}`);
      toast.success('Despesa excluída');
      setDeletingExpense(null);
      fetchData();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao excluir a despesa'));
    }
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
    if (!editing && kind === 'despesa') {
      try {
        await saveExpense();
        setFormOpen(false);
        fetchData();
      } catch (err) {
        toast.error(apiError(err, 'Falha ao lançar a despesa'));
      } finally {
        setSaving(false);
      }
      return;
    }
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
      <PageHeader icon={Package} title="Compras"
        subtitle={isAdmin ? 'Mercadorias entram no estoque; despesas vão para o Financeiro' : 'Entrada de mercadoria — cada compra soma ao estoque'}>
        <Button onClick={openNew} disabled={!isAdmin && (todayClosed || products.length === 0)} data-testid="new-purchase-btn">
          <Plus className="h-4 w-4 mr-2" /> Nova compra
        </Button>
      </PageHeader>

      {todayClosed && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          O caixa de hoje já foi fechado. Novas compras de mercadoria só depois que um administrador reabrir o caixa.
          {isAdmin && ' Despesas continuam podendo ser lançadas.'}
        </p>
      )}

      {isAdmin && (
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit text-sm">
          {[['mercadoria', `Mercadorias (${purchases.length})`], ['despesa', `Despesas do mês (${expenses.length})`]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-md font-medium transition ${tab === key ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {isAdmin && tab === 'despesa' && (
        <Card>
          <CardContent className="p-0">
            {expenses.length === 0 ? (
              <div className="py-14 text-center">
                <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">Nenhuma despesa lançada neste mês</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="text-right">Valor</th><th className="text-right">Ações</th></tr></thead>
                  <tbody>
                    {expenses.map((x) => (
                      <tr key={x.id}>
                        <td className="text-sm whitespace-nowrap">{x.date.split('-').reverse().join('/')}</td>
                        <td>{x.description}{x.notes && <span className="block text-xs text-slate-500">{x.notes}</span>}</td>
                        <td className="text-sm text-slate-500">{x.category}</td>
                        <td className="text-right font-mono">{money(x.amount)}</td>
                        <td className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="Editar despesa" onClick={() => openEditExpense(x)}>
                            <Pencil className="h-4 w-4 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir despesa" onClick={() => setDeletingExpense(x)}>
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-slate-500 p-4">
              Despesas não mexem no estoque nem contam como venda: entram no resultado do mês. Também aparecem em{' '}
              <Link to="/finance" className="text-violet-500 underline">Financeiro → Despesas do mês</Link>.
            </p>
          </CardContent>
        </Card>
      )}

      {(!isAdmin || tab === 'mercadoria') && (
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
                      <td className="font-mono font-medium whitespace-nowrap">{p.number}</td>
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
      )}

      {/* Nova compra */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editing ? `Editar compra ${editing.number}` : expense.id && kind === 'despesa' ? 'Editar despesa' : 'Nova compra'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'O estoque é ajustado pela diferença. Não é possível reduzir itens que já foram vendidos. Depois de revisada, a compra não pode mais ser editada.'
                : kind === 'despesa'
                  ? 'Gasto da loja (energia, internet, gás, aluguel…). Não entra no estoque nem conta como venda: vai direto para o resultado do mês no Financeiro.'
                  : 'Os itens entram no estoque ao salvar. O custo do produto é atualizado pelo custo médio.'}
            </DialogDescription>
          </DialogHeader>

          {!editing && isAdmin && !expense.id && (
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
              <button type="button" onClick={() => setKind('mercadoria')}
                disabled={todayClosed || products.length === 0}
                className={`flex items-center justify-center gap-2 py-2 rounded-md font-medium transition disabled:opacity-40 ${
                  kind === 'mercadoria' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <Boxes className="h-4 w-4" /> Mercadoria (estoque)
              </button>
              <button type="button" onClick={() => setKind('despesa')}
                className={`flex items-center justify-center gap-2 py-2 rounded-md font-medium transition ${
                  kind === 'despesa' ? 'bg-primary text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                <Receipt className="h-4 w-4" /> Despesa
              </button>
            </div>
          )}

          {!editing && kind === 'despesa' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Descrição *</Label>
                <Input required value={expense.description} placeholder="Ex.: Conta de energia de outubro"
                  onChange={(e) => setExpense({ ...expense, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <select className={SELECT_CLASS} value={expense.category}
                    onChange={(e) => setExpense({ ...expense, category: e.target.value })}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Valor *</Label>
                  <Input type="number" min="0.01" step="0.01" required value={expense.amount}
                    onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Data *</Label>
                  <Input type="date" required value={expense.date}
                    onChange={(e) => setExpense({ ...expense, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Observação</Label>
                <Input value={expense.notes} onChange={(e) => setExpense({ ...expense, notes: e.target.value })} />
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-slate-500">Valor da despesa</span>
                <span className="font-heading text-xl font-bold">{money(parseFloat(expense.amount) || 0)}</span>
              </div>
              <p className="text-xs text-slate-500">
                Contas que se repetem todo mês (aluguel, internet…) podem ser cadastradas uma vez em
                Financeiro → Despesas fixas.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : expense.id ? 'Salvar alterações' : 'Lançar despesa'}</Button>
              </DialogFooter>
            </form>
          ) : (
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
          )}
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

      <AlertDialog open={!!deletingExpense} onOpenChange={(o) => !o && setDeletingExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingExpense?.description}" — {deletingExpense && money(deletingExpense.amount)}. Ela sai do
              resultado do mês no Financeiro. Despesas de um mês já fechado não podem ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
