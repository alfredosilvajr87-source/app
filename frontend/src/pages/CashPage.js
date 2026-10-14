import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Calculator, ChevronLeft, ChevronRight, Lock, LockOpen, AlertTriangle, Banknote, ShoppingCart, Package, Wallet,
} from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { apiError, formatDateTime, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const shiftDay = (day, delta) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};
const brDate = (day) => day.split('-').reverse().join('/');
const weekday = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' });

const CashPage = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
  const [day, setDay] = useState(today());
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [dRes, hRes] = await Promise.all([
        axios.get(`${API}/cash/day`, { params: { date: day, tz_offset: tzOffset() } }),
        axios.get(`${API}/cash/closings`),
      ]);
      setData(dRes.data);
      setHistory(hRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar o caixa'));
    }
  }, [day]);

  useEffect(() => {
    fetchAll();
    setCounted('');
    setNotes('');
  }, [fetchAll]);

  const closeCash = async () => {
    try {
      const res = await axios.post(`${API}/cash/close`, {
        date: day, tz_offset: tzOffset(), notes,
        counted_cash: counted === '' ? null : parseFloat(counted) || 0,
      });
      toast.success(res.data.message);
      setConfirmOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const reopen = async () => {
    try {
      await axios.delete(`${API}/cash/close`, { params: { date: day } });
      toast.success('Caixa reaberto');
      fetchAll();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const isFuture = day > today();
  const diff = counted === '' || !data ? null : (parseFloat(counted) || 0) - data.cash_sales;

  return (
    <div className="space-y-6" data-testid="cash-page">
      <PageHeader icon={Calculator} title="Caixa" subtitle="Conferência e fechamento do caixa do dia">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <Button variant="ghost" size="icon" onClick={() => setDay(shiftDay(day, -1))} title="Dia anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Input type="date" value={day} max={today()} onChange={(e) => e.target.value && setDay(e.target.value)}
            className="w-40 border-0 bg-transparent text-center" />
          <Button variant="ghost" size="icon" onClick={() => setDay(shiftDay(day, 1))} disabled={day >= today()} title="Próximo dia">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </PageHeader>

      {data && (
        <>
          {/* Situação do caixa */}
          <div className={`kpi-card ${data.closed ? 'kpi-amber' : 'kpi-teal'}`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="kpi-icon">{data.closed ? <Lock className="h-6 w-6" /> : <LockOpen className="h-6 w-6" />}</div>
                <div>
                  <p className="kpi-label">{weekday(day).replace(/^./, (c) => c.toUpperCase())}, {brDate(day)}</p>
                  <p className="kpi-value mt-1">{data.closed ? 'Caixa fechado' : 'Caixa aberto'}</p>
                  <p className="kpi-sub mt-1">
                    {data.closed
                      ? `Fechado em ${formatDateTime(data.closed_at)} por ${data.closed_by_name}. Vendas e compras deste dia estão travadas.`
                      : 'Vendas e compras do dia ainda podem ser editadas e canceladas.'}
                  </p>
                </div>
              </div>
              {data.closed && isAdmin && (
                <Button variant="outline" onClick={reopen}><LockOpen className="h-4 w-4 mr-2" /> Reabrir caixa</Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="kpi-card kpi-purple">
              <div className="flex items-center gap-3"><div className="kpi-icon"><ShoppingCart className="h-5 w-5" /></div><span className="kpi-label">Vendas do dia</span></div>
              <p className="kpi-value mt-3">{money(data.sales_total)}</p>
              <p className="kpi-sub mt-1">{data.sales_count} venda(s){data.discounts ? ` · descontos ${money(data.discounts)}` : ''}</p>
            </div>
            <div className="kpi-card kpi-teal">
              <div className="flex items-center gap-3"><div className="kpi-icon"><Banknote className="h-5 w-5" /></div><span className="kpi-label">Dinheiro na gaveta</span></div>
              <p className="kpi-value mt-3">{money(data.cash_sales)}</p>
              <p className="kpi-sub mt-1">Esperado pelas vendas em dinheiro</p>
            </div>
            <div className="kpi-card kpi-amber">
              <div className="flex items-center gap-3"><div className="kpi-icon"><Wallet className="h-5 w-5" /></div><span className="kpi-label">Comissões do dia</span></div>
              <p className="kpi-value mt-3">{money(data.commissions)}</p>
            </div>
            <div className="kpi-card kpi-blue">
              <div className="flex items-center gap-3"><div className="kpi-icon"><Package className="h-5 w-5" /></div><span className="kpi-label">Compras do dia</span></div>
              <p className="kpi-value mt-3">{money(data.purchases_total)}</p>
              <p className="kpi-sub mt-1">{data.purchases_count} compra(s)</p>
            </div>
          </div>

          {(data.unreviewed_sales > 0 || data.unreviewed_purchases > 0 || data.cancelled_count > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 flex gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div className="space-y-1">
                {data.unreviewed_sales > 0 && (
                  <p>{data.unreviewed_sales} venda(s) ainda não revisada(s). <Link to="/sales" className="underline">Revisar vendas</Link></p>
                )}
                {data.unreviewed_purchases > 0 && (
                  <p>{data.unreviewed_purchases} compra(s) ainda não revisada(s). <Link to="/purchases" className="underline">Revisar compras</Link></p>
                )}
                {data.cancelled_count > 0 && (
                  <p>{data.cancelled_count} venda(s) cancelada(s) no dia ({money(data.cancelled_total)}).</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg text-foreground">Por forma de pagamento</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.by_method.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Nenhuma venda no dia</p>
                ) : (
                  <table className="data-table">
                    <tbody>
                      {data.by_method.map((m) => (
                        <tr key={m.method}>
                          <td>{m.label}<span className="block text-xs text-slate-500">{m.count} venda(s)</span></td>
                          <td className="text-right font-mono">{money(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-heading text-lg text-foreground">Por vendedor</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.by_seller.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Nenhuma venda no dia</p>
                ) : (
                  <table className="data-table">
                    <tbody>
                      {data.by_seller.map((s) => (
                        <tr key={s.name}>
                          <td>{s.name}<span className="block text-xs text-slate-500">{s.count} venda(s) · comissão {money(s.commission)}</span></td>
                          <td className="text-right font-mono">{money(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-heading text-lg text-foreground">{data.closed ? 'Conferência' : 'Fechar o caixa'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {data.closed ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Esperado em dinheiro</span><span className="font-mono">{money(data.cash_sales)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Contado na gaveta</span>
                      <span className="font-mono">{data.counted_cash == null ? 'não informado' : money(data.counted_cash)}</span></div>
                    {data.cash_difference != null && (
                      <div className="flex justify-between font-semibold">
                        <span>Diferença</span>
                        <span className={`font-mono ${data.cash_difference === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {data.cash_difference > 0 ? '+' : ''}{money(data.cash_difference)}
                        </span>
                      </div>
                    )}
                    {data.notes && <p className="text-slate-400 pt-2">Obs.: {data.notes}</p>}
                  </div>
                ) : isFuture ? (
                  <p className="text-slate-400 text-sm">Não dá para fechar um dia futuro.</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label>Dinheiro contado na gaveta (opcional)</Label>
                      <Input type="number" min="0" step="0.01" value={counted} placeholder={money(data.cash_sales)}
                        onChange={(e) => setCounted(e.target.value)} />
                      {diff !== null && (
                        <p className={`text-xs ${Math.abs(diff) < 0.005 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {Math.abs(diff) < 0.005 ? 'Bateu certinho' : `${diff > 0 ? 'Sobrando' : 'Faltando'} ${money(Math.abs(diff))}`}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Observação</Label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: troco inicial de R$ 50" />
                    </div>
                    <button className="btn-brand w-full justify-center" onClick={() => setConfirmOpen(true)}>
                      <Lock className="h-5 w-5" /> Fechar caixa do dia
                    </button>
                    <p className="text-xs text-slate-500">
                      Depois de fechado, as vendas e compras deste dia não podem mais ser editadas, canceladas ou excluídas.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader><CardTitle className="font-heading text-lg text-foreground">Últimos fechamentos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="text-center text-slate-400 py-8">Nenhum caixa fechado ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Dia</th><th className="text-right">Vendas</th><th className="text-right">Total</th><th className="text-right">Diferença</th><th>Fechado por</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date} className="cursor-pointer" onClick={() => setDay(h.date)}>
                      <td className="font-mono">{brDate(h.date)}</td>
                      <td className="text-right font-mono">{h.sales_count}</td>
                      <td className="text-right font-mono">{money(h.sales_total)}</td>
                      <td className={`text-right font-mono ${h.cash_difference ? 'text-rose-400' : 'text-slate-400'}`}>
                        {h.cash_difference == null ? '—' : money(h.cash_difference)}
                      </td>
                      <td className="text-sm text-slate-400">{h.closed_by_name} · {formatDateTime(h.closed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o caixa de {brDate(day)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {data && `${data.sales_count} venda(s) somando ${money(data.sales_total)}. `}
              Depois de fechado, as vendas e compras deste dia ficam travadas: não podem ser editadas, canceladas
              nem excluídas, e não dá para lançar novas vendas nesta data.
              {data && data.unreviewed_sales + data.unreviewed_purchases > 0 &&
                ` Atenção: ainda há ${data.unreviewed_sales + data.unreviewed_purchases} lançamento(s) sem revisão.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={closeCash}>Fechar caixa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CashPage;
