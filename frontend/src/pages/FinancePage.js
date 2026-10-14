import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Wallet, ChevronLeft, ChevronRight, Lock, LockOpen, Plus, Pencil, Trash2,
  TrendingUp, TrendingDown, Receipt, Repeat, Users, ArrowDownCircle, ArrowUpCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import PageHeader from '../components/layout/PageHeader';
import { SELECT_CLASS } from '../components/store/ItemLines';
import { useTheme, chartColors } from '../context/ThemeContext';
import { apiError, formatDateTime, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const shiftMonth = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthName = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[mo - 1]} de ${y}`;
};
const todayInMonth = (m) => {
  const now = new Date();
  const cur = thisMonth();
  return m === cur ? `${m}-${String(now.getDate()).padStart(2, '0')}` : `${m}-01`;
};

const EMPTY_EXPENSE = { description: '', category: 'Outros', amount: '', date: '', notes: '' };
const EMPTY_RECURRING = { description: '', category: 'Aluguel', amount: '', day_of_month: '5', active: true, start_month: '', end_month: '' };

// Linha da DRE: sinal, rótulo e valor
const Line = ({ sign, label, value, money, strong, hint }) => (
  <div className={`flex items-center justify-between gap-3 py-2.5 ${strong ? 'border-t border-slate-200 font-semibold' : ''}`}>
    <span className="flex items-center gap-2 min-w-0">
      <span className={`w-5 text-center font-mono ${sign === '+' ? 'text-emerald-400' : sign === '−' ? 'text-rose-400' : 'text-violet-300'}`}>{sign}</span>
      <span className={strong ? 'text-foreground' : 'text-slate-300'}>{label}</span>
      {hint && <span className="text-xs text-slate-500 hidden sm:inline">{hint}</span>}
    </span>
    <span className={`font-mono whitespace-nowrap ${strong ? 'text-foreground text-lg' : 'text-slate-200'}`}>{money(value)}</span>
  </div>
);

const HistoryTooltip = ({ active, payload, money }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-lg text-sm">
      <p className="text-xs text-slate-400 mb-1">{d.label}{d.closed ? ' · fechado' : ''}</p>
      <p className="text-slate-300">Faturamento: <span className="font-mono">{money(d.revenue)}</span></p>
      <p className="text-slate-300">Custos e despesas: <span className="font-mono">{money(d.costs)}</span></p>
      <p className={`font-semibold ${d.net_result >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {d.net_result >= 0 ? 'Lucro' : 'Prejuízo'}: <span className="font-mono">{money(Math.abs(d.net_result))}</span>
      </p>
    </div>
  );
};

const FinancePage = () => {
  const { money } = useStore();
  const { isDark } = useTheme();
  const cc = chartColors(isDark);
  const [month, setMonth] = useState(thisMonth());
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expenseForm, setExpenseForm] = useState(null);       // null = fechado
  const [recurringForm, setRecurringForm] = useState(null);
  const [deleting, setDeleting] = useState(null);             // { kind, item }
  const [confirmClose, setConfirmClose] = useState(false);

  const fetchAll = useCallback(async () => {
    const params = { month, tz_offset: tzOffset() };
    try {
      const [sRes, hRes, rRes] = await Promise.all([
        axios.get(`${API}/finance/summary`, { params }),
        axios.get(`${API}/finance/history`, { params: { months: 6, end: month, tz_offset: tzOffset() } }),
        axios.get(`${API}/recurring-expenses`),
      ]);
      setSummary(sRes.data);
      setHistory(hRes.data);
      setRecurring(rRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar o financeiro'));
    }
  }, [month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    axios.get(`${API}/finance/categories`).then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const saveExpense = async (e) => {
    e.preventDefault();
    const payload = { ...expenseForm, amount: parseFloat(expenseForm.amount) || 0 };
    delete payload.id;
    try {
      if (expenseForm.id) await axios.put(`${API}/expenses/${expenseForm.id}`, payload);
      else await axios.post(`${API}/expenses`, payload);
      toast.success('Despesa salva');
      setExpenseForm(null);
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const saveRecurring = async (e) => {
    e.preventDefault();
    const payload = {
      ...recurringForm,
      amount: parseFloat(recurringForm.amount) || 0,
      day_of_month: parseInt(recurringForm.day_of_month) || 1,
      start_month: recurringForm.start_month || null,
      end_month: recurringForm.end_month || null,
    };
    delete payload.id;
    try {
      if (recurringForm.id) await axios.put(`${API}/recurring-expenses/${recurringForm.id}`, payload);
      else await axios.post(`${API}/recurring-expenses`, payload);
      toast.success('Despesa fixa salva');
      setRecurringForm(null);
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const handleDelete = async () => {
    const { kind, item } = deleting;
    try {
      const url = kind === 'expense' ? `${API}/expenses/${item.id}` : `${API}/recurring-expenses/${item.id}`;
      const res = await axios.delete(url);
      toast.success(res.data.message);
      setDeleting(null);
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const closeMonth = async () => {
    try {
      const res = await axios.post(`${API}/finance/close`, null, { params: { month, tz_offset: tzOffset() } });
      toast.success(res.data.message);
      setConfirmClose(false);
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const reopenMonth = async () => {
    try {
      await axios.delete(`${API}/finance/close`, { params: { month } });
      toast.success('Mês reaberto');
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const s = summary;
  const isFuture = month > thisMonth();
  const profit = s && s.net_result >= 0;
  const maxCategory = s ? Math.max(...Object.values(s.expenses_by_category), 1) : 1;

  return (
    <div className="space-y-6" data-testid="finance-page">
      <PageHeader icon={Wallet} title="Financeiro" subtitle="Despesas, fechamento do mês e resultado da loja">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} title="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="px-2 min-w-[150px] text-center font-medium text-foreground">{monthName(month).replace(/^./, (c) => c.toUpperCase())}</span>
          <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} title="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </PageHeader>

      {s && (
        <>
          {/* Resultado do mês */}
          <div className={`kpi-card ${profit ? 'kpi-teal' : 'kpi-rose'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="kpi-icon">{profit ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}</div>
                <div>
                  <p className="kpi-label">
                    Resultado de {monthName(month)} {s.closed ? '· mês fechado' : isFuture ? '· mês futuro' : '· parcial'}
                  </p>
                  <p className="kpi-value mt-1">
                    {s.net_result === 0 ? 'Empate' : profit ? 'Lucro' : 'Prejuízo'} de {money(Math.abs(s.net_result))}
                  </p>
                  <p className="kpi-sub mt-1">
                    Margem líquida {s.net_margin}% · {s.sales_count} venda(s)
                    {s.closed && ` · fechado em ${formatDateTime(s.closed_at)} por ${s.closed_by_name}`}
                  </p>
                </div>
              </div>
              <div>
                {s.closed ? (
                  <Button variant="outline" onClick={reopenMonth}><LockOpen className="h-4 w-4 mr-2" /> Reabrir mês</Button>
                ) : !isFuture && (
                  <button className="btn-brand" onClick={() => setConfirmClose(true)}><Lock className="h-5 w-5" /> Fechar mês</button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="kpi-card kpi-teal">
              <p className="kpi-label">Faturamento</p>
              <p className="kpi-value mt-2">{money(s.revenue)}</p>
              <p className="kpi-sub mt-1">Descontos dados: {money(s.discounts)}</p>
            </div>
            <div className="kpi-card kpi-purple">
              <p className="kpi-label">Lucro bruto</p>
              <p className="kpi-value mt-2">{money(s.gross_profit)}</p>
              <p className="kpi-sub mt-1">Margem {s.gross_margin}% sobre o custo dos produtos</p>
            </div>
            <div className="kpi-card kpi-amber">
              <p className="kpi-label">Despesas e pessoal</p>
              <p className="kpi-value mt-2">{money(s.operating_expenses)}</p>
              <p className="kpi-sub mt-1">Comissões, salários, fixas e avulsas</p>
            </div>
            <div className="kpi-card kpi-blue">
              <p className="kpi-label">Saldo de caixa</p>
              <p className="kpi-value mt-2">{money(s.cash_balance)}</p>
              <p className="kpi-sub mt-1">Entradas − compras de estoque − despesas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* DRE */}
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle className="font-heading text-lg text-foreground">Demonstrativo do resultado</CardTitle>
              </CardHeader>
              <CardContent>
                <Line sign="+" label="Faturamento (vendas)" value={s.revenue} money={money} />
                <Line sign="−" label="Custo dos produtos vendidos" hint="(custo médio de compra)" value={s.cmv} money={money} />
                <Line sign="=" label="Lucro bruto" value={s.gross_profit} money={money} strong />
                <Line sign="−" label="Comissões" value={s.commissions} money={money} />
                <Line sign="−" label="Salários" value={s.salaries_total} money={money} />
                <Line sign="−" label="Despesas fixas" value={s.recurring_total} money={money} />
                <Line sign="−" label="Outras despesas" value={s.expenses_total} money={money} />
                <div className={`flex items-center justify-between gap-3 mt-2 rounded-xl px-4 py-3 ${
                  profit ? 'bg-emerald-100' : 'bg-rose-50'}`}>
                  <span className={`font-heading font-bold text-lg ${profit ? 'text-emerald-700' : 'text-rose-600'}`}>
                    = {profit ? 'Lucro' : 'Prejuízo'} do mês
                  </span>
                  <span className={`font-mono font-bold text-xl ${profit ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {money(s.net_result)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Fluxo de caixa + categorias */}
            <div className="xl:col-span-2 space-y-5">
              <Card>
                <CardHeader><CardTitle className="font-heading text-lg text-foreground">Fluxo de caixa</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-300"><ArrowDownCircle className="h-4 w-4 text-emerald-400" /> Entradas (vendas)</span>
                    <span className="font-mono text-emerald-400">{money(s.cash_in)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-300"><ArrowUpCircle className="h-4 w-4 text-rose-400" /> Compras de estoque ({s.purchases_count})</span>
                    <span className="font-mono text-rose-400">− {money(s.purchases_total)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2 text-slate-300"><ArrowUpCircle className="h-4 w-4 text-rose-400" /> Despesas e pessoal</span>
                    <span className="font-mono text-rose-400">− {money(s.operating_expenses)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-3 font-semibold">
                    <span className="text-foreground">Saldo</span>
                    <span className={`font-mono ${s.cash_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{money(s.cash_balance)}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    O resultado considera só o custo do que foi vendido; o caixa considera tudo o que foi pago
                    em compras no mês.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-heading text-lg text-foreground">Para onde foi o dinheiro</CardTitle></CardHeader>
                <CardContent>
                  {Object.keys(s.expenses_by_category).length === 0 ? (
                    <p className="text-center text-slate-400 py-4">Nenhuma despesa no mês</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {Object.entries(s.expenses_by_category).map(([cat, val]) => (
                        <li key={cat} className="text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-300">{cat}</span>
                            <span className="font-mono text-slate-200">{money(val)}</span>
                          </div>
                          <div className="h-1.5 mt-1 rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full bg-violet-500" style={{ width: `${(val / maxCategory) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Histórico 6 meses */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg text-foreground">Resultado dos últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={cc.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: cc.tick }} axisLine={{ stroke: cc.axis }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: cc.tick }} axisLine={false} tickLine={false} width={84}
                      domain={[(min) => Math.min(0, min), (max) => Math.max(0, max)]}
                      tickFormatter={(v) => money(v).replace(/,\d{2}$|\.\d{2}$/, '')} />
                    <ReferenceLine y={0} stroke={cc.axis} />
                    <Tooltip content={<HistoryTooltip money={money} />} cursor={{ fill: 'rgba(139,92,246,0.08)' }} />
                    <Bar dataKey="net_result" radius={[4, 4, 4, 4]} maxBarSize={56}>
                      {history.map((h) => (
                        <Cell key={h.month} fill={h.net_result >= 0 ? '#14b8a6' : '#f43f5e'}
                          fillOpacity={h.month === month ? 1 : 0.65} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-5 justify-center text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Lucro</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Prejuízo</span>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes */}
          <Tabs defaultValue="expenses">
            <TabsList>
              <TabsTrigger value="expenses"><Receipt className="h-4 w-4 mr-2" />Despesas do mês</TabsTrigger>
              <TabsTrigger value="recurring"><Repeat className="h-4 w-4 mr-2" />Despesas fixas</TabsTrigger>
              <TabsTrigger value="people"><Users className="h-4 w-4 mr-2" />Pessoal</TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="font-heading text-lg text-foreground">Despesas avulsas · {money(s.expenses_total)}</CardTitle>
                  <Button disabled={s.closed} onClick={() => setExpenseForm({ ...EMPTY_EXPENSE, date: todayInMonth(month) })}>
                    <Plus className="h-4 w-4 mr-2" /> Nova despesa
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {s.expenses.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">Nenhuma despesa avulsa neste mês</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="text-right">Valor</th><th /></tr></thead>
                        <tbody>
                          {s.expenses.map((e) => (
                            <tr key={e.id}>
                              <td className="text-sm whitespace-nowrap">{e.date.split('-').reverse().join('/')}</td>
                              <td>{e.description}{e.notes && <span className="block text-xs text-slate-500">{e.notes}</span>}</td>
                              <td className="text-sm text-slate-400">{e.category}</td>
                              <td className="text-right font-mono">{money(e.amount)}</td>
                              <td className="text-right whitespace-nowrap">
                                {!s.closed && (
                                  <>
                                    <Button variant="ghost" size="icon" title="Editar" onClick={() => setExpenseForm({ ...e, amount: String(e.amount) })}>
                                      <Pencil className="h-4 w-4 text-slate-400" />
                                    </Button>
                                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleting({ kind: 'expense', item: e })}>
                                      <Trash2 className="h-4 w-4 text-slate-400" />
                                    </Button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recurring" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="font-heading text-lg text-foreground">Despesas fixas mensais</CardTitle>
                    <p className="text-sm text-slate-400 mt-1">Entram sozinhas todo mês (aluguel, energia, internet…)</p>
                  </div>
                  <Button onClick={() => setRecurringForm(EMPTY_RECURRING)}><Plus className="h-4 w-4 mr-2" /> Nova despesa fixa</Button>
                </CardHeader>
                <CardContent className="p-0">
                  {recurring.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">Nenhuma despesa fixa cadastrada</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Vigência</th><th className="text-right">Valor</th><th /></tr></thead>
                        <tbody>
                          {recurring.map((r) => (
                            <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                              <td>{r.description}{!r.active && <span className="text-xs text-slate-500"> · pausada</span>}</td>
                              <td className="text-sm text-slate-400">{r.category}</td>
                              <td className="text-sm">dia {r.day_of_month}</td>
                              <td className="text-sm text-slate-400 whitespace-nowrap">
                                {r.start_month ? r.start_month.split('-').reverse().join('/') : 'sempre'} → {r.end_month ? r.end_month.split('-').reverse().join('/') : 'sem fim'}
                              </td>
                              <td className="text-right font-mono">{money(r.amount)}</td>
                              <td className="text-right whitespace-nowrap">
                                <Button variant="ghost" size="icon" title="Editar" onClick={() => setRecurringForm({
                                  ...r, amount: String(r.amount), day_of_month: String(r.day_of_month),
                                  start_month: r.start_month || '', end_month: r.end_month || '' })}>
                                  <Pencil className="h-4 w-4 text-slate-400" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleting({ kind: 'recurring', item: r })}>
                                  <Trash2 className="h-4 w-4 text-slate-400" />
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
            </TabsContent>

            <TabsContent value="people" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card>
                  <CardHeader><CardTitle className="font-heading text-lg text-foreground">Salários · {money(s.salaries_total)}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {s.salaries.length === 0 ? (
                      <p className="text-center text-slate-400 py-8">Nenhum salário cadastrado em Funcionários</p>
                    ) : (
                      <table className="data-table">
                        <tbody>
                          {s.salaries.map((p) => (
                            <tr key={p.name}>
                              <td>{p.name}<span className="block text-xs text-slate-500">{p.job_title}</span></td>
                              <td className="text-right font-mono">{money(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="font-heading text-lg text-foreground">Comissões · {money(s.commissions)}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {s.commissions_by_seller.length === 0 ? (
                      <p className="text-center text-slate-400 py-8">Nenhuma venda no mês</p>
                    ) : (
                      <table className="data-table">
                        <tbody>
                          {s.commissions_by_seller.map((c) => (
                            <tr key={c.name}>
                              <td>{c.name}<span className="block text-xs text-slate-500">{c.sales} venda(s)</span></td>
                              <td className="text-right font-mono">{money(c.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Despesa avulsa */}
      <Dialog open={!!expenseForm} onOpenChange={(o) => !o && setExpenseForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{expenseForm?.id ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
            <DialogDescription>Gasto que aconteceu uma vez (manutenção, embalagem, frete…)</DialogDescription>
          </DialogHeader>
          {expenseForm && (
            <form onSubmit={saveExpense} className="space-y-4">
              <div className="space-y-1">
                <Label>Descrição *</Label>
                <Input required value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <select className={SELECT_CLASS} value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Valor *</Label>
                  <Input type="number" min="0.01" step="0.01" required value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Data *</Label>
                  <Input type="date" required value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Observação</Label>
                  <Input value={expenseForm.notes || ''}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setExpenseForm(null)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Despesa fixa */}
      <Dialog open={!!recurringForm} onOpenChange={(o) => !o && setRecurringForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{recurringForm?.id ? 'Editar despesa fixa' : 'Nova despesa fixa'}</DialogTitle>
            <DialogDescription>Entra automaticamente em todos os meses da vigência (vazio = a partir deste mês). Meses já fechados não mudam.</DialogDescription>
          </DialogHeader>
          {recurringForm && (
            <form onSubmit={saveRecurring} className="space-y-4">
              <div className="space-y-1">
                <Label>Descrição *</Label>
                <Input required value={recurringForm.description} placeholder="Ex.: Aluguel da loja"
                  onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <select className={SELECT_CLASS} value={recurringForm.category}
                    onChange={(e) => setRecurringForm({ ...recurringForm, category: e.target.value })}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Valor mensal *</Label>
                  <Input type="number" min="0.01" step="0.01" required value={recurringForm.amount}
                    onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Dia do vencimento</Label>
                  <Input type="number" min="1" max="31" value={recurringForm.day_of_month}
                    onChange={(e) => setRecurringForm({ ...recurringForm, day_of_month: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm pt-6">
                  <Switch checked={recurringForm.active}
                    onCheckedChange={(v) => setRecurringForm({ ...recurringForm, active: v })} />
                  Ativa
                </label>
                <div className="space-y-1">
                  <Label>A partir de</Label>
                  <Input type="month" value={recurringForm.start_month}
                    onChange={(e) => setRecurringForm({ ...recurringForm, start_month: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Até (opcional)</Label>
                  <Input type="month" value={recurringForm.end_month}
                    onChange={(e) => setRecurringForm({ ...recurringForm, end_month: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRecurringForm(null)}>Cancelar</Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar {monthName(month)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os números do mês ficam congelados ({s && (profit ? 'lucro' : 'prejuízo')} de {s && money(Math.abs(s.net_result))})
              e as despesas desse mês não poderão mais ser alteradas. Você pode reabrir depois, se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={closeMonth}>Fechar mês</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleting?.kind === 'expense' ? 'despesa' : 'despesa fixa'}?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.item.description}" — {deleting && money(deleting.item.amount)}
              {deleting?.kind === 'recurring' && '. Ela deixa de entrar nos meses abertos; meses fechados não mudam.'}
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

export default FinancePage;
