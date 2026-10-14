import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { BarChart3, Wallet } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { apiError, formatDateTime, lastDays, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const CLASS_STYLE = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-slate-100 text-slate-600',
};

const CLASS_HINT = {
  A: 'Mais vendidos (até 80% do faturamento). Nunca deixe faltar.',
  B: 'Intermediários (próximos 15%). Reponha com atenção.',
  C: 'Pouca ou nenhuma venda. Compre pouco.',
};

const PRESETS = [7, 30, 90];

const ReportsPage = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
  const [period, setPeriod] = useState(lastDays(30));
  const [coverDays, setCoverDays] = useState(15);
  const [abc, setAbc] = useState(null);
  const [commissions, setCommissions] = useState(null);
  const [classFilter, setClassFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = { ...period, tz_offset: tzOffset() };
    try {
      const [abcRes, comRes] = await Promise.all([
        isAdmin ? axios.get(`${API}/reports/abc`, { params: { ...params, cover_days: coverDays } }) : null,
        axios.get(`${API}/reports/commissions`, { params }),
      ]);
      if (abcRes) setAbc(abcRes.data);
      setCommissions(comRes.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar relatórios'));
    } finally {
      setLoading(false);
    }
  }, [period, coverDays, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const abcRows = (abc?.rows || []).filter((r) => !classFilter || r.abc === classFilter);
  const toBuy = (abc?.rows || []).filter((r) => r.suggested_purchase > 0);

  return (
    <div className="space-y-6" data-testid="reports-page">
      <PageHeader icon={BarChart3} title="Relatórios"
        subtitle={isAdmin ? 'Curva ABC para repor o que mais vende e comissão dos funcionários' : 'Suas comissões'} />

      {/* Período */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={period.start} max={period.end}
              onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={period.end} min={period.start}
              onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
          <div className="flex gap-2">
            {PRESETS.map((d) => (
              <Button key={d} type="button" variant="outline" size="sm" onClick={() => setPeriod(lastDays(d))}>
                {d} dias
              </Button>
            ))}
          </div>
          {loading && <span className="text-sm text-slate-400">Carregando…</span>}
        </CardContent>
      </Card>

      <Tabs defaultValue={isAdmin ? 'abc' : 'commissions'}>
        <TabsList>
          {isAdmin && <TabsTrigger value="abc"><BarChart3 className="h-4 w-4 mr-2" />Curva ABC</TabsTrigger>}
          <TabsTrigger value="commissions"><Wallet className="h-4 w-4 mr-2" />Comissões</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="abc" className="space-y-6 mt-4">
            {abc && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {['A', 'B', 'C'].map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setClassFilter(classFilter === cls ? '' : cls)}
                      className={`text-left rounded-xl border p-4 bg-white transition ${
                        classFilter === cls ? 'ring-2 ring-blue-600' : 'hover:shadow'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded font-bold ${CLASS_STYLE[cls]}`}>Classe {cls}</span>
                        <span className="text-sm text-slate-500">{abc.summary[cls].count} produto(s)</span>
                      </div>
                      <p className="font-heading text-2xl font-bold mt-2 text-slate-900">{money(abc.summary[cls].revenue)}</p>
                      <p className="text-sm text-slate-500">{abc.summary[cls].share}% do faturamento</p>
                      <p className="text-xs text-slate-400 mt-1">{CLASS_HINT[cls]}</p>
                    </button>
                  ))}
                </div>

                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                    <CardTitle className="font-heading text-lg">
                      Curva ABC {classFilter && `— classe ${classFilter}`}
                      <span className="block text-sm font-normal text-slate-500">
                        {abc.sales_count} venda(s) · {money(abc.total_revenue)} em {abc.days} dia(s)
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                      <Label className="whitespace-nowrap">Repor para</Label>
                      <Input type="number" min="1" max="365" className="w-20" value={coverDays}
                        onChange={(e) => setCoverDays(Math.max(1, parseInt(e.target.value) || 1))} />
                      <span className="text-slate-500">dias</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Classe</th><th>Produto</th>
                            <th className="text-right">Vendidos</th><th className="text-right">Faturamento</th>
                            <th className="text-right">%</th><th className="text-right">% acum.</th>
                            <th className="text-right">Margem</th><th className="text-right">Estoque</th>
                            <th className="text-right">Dura</th><th className="text-right">Comprar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abcRows.map((r) => (
                            <tr key={r.product_id}>
                              <td><span className={`px-2 py-0.5 rounded text-xs font-bold ${CLASS_STYLE[r.abc]}`}>{r.abc}</span></td>
                              <td className="font-medium min-w-[13rem]">{r.name}</td>
                              <td className="text-right font-mono">{r.quantity}</td>
                              <td className="text-right font-mono">{money(r.revenue)}</td>
                              <td className="text-right font-mono">{r.share}%</td>
                              <td className="text-right font-mono text-slate-500">{r.cumulative}%</td>
                              <td className="text-right font-mono">{money(r.profit)}</td>
                              <td className="text-right font-mono">{r.stock}</td>
                              <td className="text-right font-mono text-sm whitespace-nowrap">
                                {r.coverage_days === null ? '—' : `${Math.floor(r.coverage_days)} dias`}
                              </td>
                              <td className={`text-right font-mono font-semibold ${r.suggested_purchase > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                                {r.suggested_purchase}
                              </td>
                            </tr>
                          ))}
                          {abcRows.length === 0 && (
                            <tr><td colSpan={10} className="text-center text-slate-400 py-8">Nenhum produto</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500 p-4">
                      <b>Dura</b>: quantos dias o estoque atual aguenta no ritmo de vendas do período.{' '}
                      <b>Comprar</b>: quantidade para ter estoque para {abc.cover_days} dias de venda,
                      nunca abaixo do estoque mínimo.
                    </p>
                  </CardContent>
                </Card>

                {toBuy.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-lg">Lista de compra sugerida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid sm:grid-cols-2 gap-2">
                        {toBuy.map((r) => (
                          <li key={r.product_id} className="flex justify-between gap-2 p-2 bg-slate-50 rounded-lg text-sm">
                            <span className="truncate">
                              <span className={`px-1.5 rounded text-xs font-bold mr-2 ${CLASS_STYLE[r.abc]}`}>{r.abc}</span>
                              {r.name}
                            </span>
                            <span className="font-mono font-semibold whitespace-nowrap">{r.suggested_purchase} un.</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="commissions" className="space-y-6 mt-4">
          {commissions && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-heading text-lg">Comissão por funcionário</CardTitle>
                  <span className="font-heading text-xl font-bold">{money(commissions.total_commission)}</span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Funcionário</th><th className="text-right">Vendas</th><th className="text-right">Itens</th>
                          <th className="text-right">Total vendido</th><th className="text-right">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.rows.map((r) => (
                          <tr key={r.seller_id}>
                            <td className="font-medium">{r.seller_name}</td>
                            
                            <td className="text-right font-mono">{r.sales_count}</td>
                            <td className="text-right font-mono">{r.items_sold}</td>
                            <td className="text-right font-mono">{money(r.total_sold)}</td>
                            <td className="text-right font-mono font-semibold">{money(r.commission)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="font-heading text-lg">Vendas do período</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {commissions.sales.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">Nenhuma venda no período</p>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="data-table">
                        <thead>
                          <tr><th>Fatura</th><th>Data</th><th>Vendedor</th><th className="text-right">Total</th><th className="text-right">Comissão</th></tr>
                        </thead>
                        <tbody>
                          {commissions.sales.map((s) => (
                            <tr key={s.id}>
                              <td className="font-mono">{s.number}</td>
                              <td className="text-sm">{formatDateTime(s.created_at)}</td>
                              <td>{s.seller_name}</td>
                              <td className="text-right font-mono">{money(s.total)}</td>
                              <td className="text-right font-mono">{money(s.commission)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
