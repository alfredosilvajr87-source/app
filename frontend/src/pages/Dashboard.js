import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  ShoppingCart, TrendingUp, Package, Truck, Database, Box, AlertTriangle,
  FileText, Sparkles, BarChart3, Tag, Boxes,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/layout/PageHeader';
import VapeIcon from '../components/store/VapeIcon';
import { useTheme, chartColors } from '../context/ThemeContext';
import { apiError, formatDateTime, openInvoice, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const Kpi = ({ tone, icon: Icon, trend: Trend, label, value, sub, delay }) => (
  <div className={`kpi-card kpi-${tone} animate-fade-in ${delay}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="kpi-icon"><Icon className="h-6 w-6" /></div>
        <span className="kpi-label">{label}</span>
      </div>
      {Trend && <Trend className="h-6 w-6 kpi-trend" />}
    </div>
    <p className="kpi-value mt-3" title={value}>{value}</p>
    {sub && <p className="kpi-sub mt-2">{sub}</p>}
  </div>
);

const ChartTooltip = ({ active, payload, money }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-400">{d.label}</p>
      <p className="font-semibold text-foreground">{money(d.total)}</p>
      <p className="text-xs text-slate-400">{d.count} venda(s)</p>
    </div>
  );
};

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
  const { isDark } = useTheme();
  const cc = chartColors(isDark);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/dashboard`, { params: { tz_offset: tzOffset() } });
      setData(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar o painel'));
    } finally {
      setLoading(false);
    }
  };

  const seedVapers = async () => {
    try {
      const res = await axios.post(`${API}/products/seed-vapers`);
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const actions = (
    <>
      <Link to="/purchases" className="btn-ghost-brand"><ShoppingCart className="h-5 w-5" /> Nova compra</Link>
      <Link to="/sales" className="btn-brand"><Tag className="h-5 w-5" /> Nova venda</Link>
    </>
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (!data) return null;

  if (data.products_count === 0) {
    return (
      <div className="space-y-8">
        <PageHeader icon={TrendingUp} title="Painel" subtitle="Resumo de vendas, compras e estoque" />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <img src="/logo-mark.png" alt="" className="h-32 w-32 mb-6 logo-blend" />
          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Nenhum produto ainda</h2>
          <p className="text-slate-400 mb-6 max-w-md">
            Cadastre seus vapers ou carregue 10 produtos de exemplo para começar. Depois registre uma
            compra para dar entrada no estoque.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            {isAdmin && (
              <button onClick={seedVapers} className="btn-brand"><Sparkles className="h-5 w-5" /> Carregar 10 vapers de exemplo</button>
            )}
            <Link to="/products" className="btn-ghost-brand">Ir para Produtos</Link>
          </div>
        </div>
      </div>
    );
  }

  const maxDay = Math.max(...data.last7.map((d) => d.total), 0);

  return (
    <div className="space-y-7" data-testid="dashboard">
      <PageHeader icon={TrendingUp} title="Painel" subtitle="Resumo de vendas, compras e estoque">
        {actions}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Kpi tone="purple" icon={ShoppingCart} trend={TrendingUp} label="Vendas hoje" delay="stagger-1"
          value={money(data.today_revenue)} sub={`${data.today_count} venda(s)`} />
        <Kpi tone="teal" icon={TrendingUp} trend={TrendingUp} label="Vendas no mês" delay="stagger-2"
          value={money(data.month_revenue)}
          sub={isAdmin ? `Lucro estimado: ${money(data.month_profit)}` : `${data.month_count} venda(s)`} />
        <Kpi tone="blue" icon={Package} trend={Truck} label="Compras no mês" delay="stagger-3"
          value={money(data.month_purchases)} />
        <Kpi tone="amber" icon={Database} trend={Box} label="Estoque" delay="stagger-4"
          value={`${data.units_in_stock} un.`}
          sub={`Custo ${money(data.stock_value_cost)} • Venda ${money(data.stock_value_sale)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 self-start">
          <CardHeader>
            <CardTitle className="font-heading text-xl flex items-center gap-3 text-foreground">
              <BarChart3 className="h-6 w-6 text-violet-400" /> Vendas dos últimos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.last7} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={cc.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: cc.tick }} axisLine={{ stroke: cc.axis }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: cc.tick }} axisLine={false} tickLine={false} width={78}
                    domain={[0, maxDay > 0 ? 'auto' : 100]}
                    tickFormatter={(v) => money(v).replace(/,\d{2}$|\.\d{2}$/, '')} />
                  <Tooltip content={<ChartTooltip money={money} />} cursor={{ stroke: '#8b5cf6', strokeOpacity: 0.4 }} />
                  <Area type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} fill="url(#salesFill)"
                    dot={{ r: 4, fill: '#8b5cf6', stroke: cc.dotStroke, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#a78bfa', stroke: cc.dotStroke, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="font-heading text-lg flex items-center gap-3 text-foreground">
                <Boxes className="h-5 w-5 text-sky-400" /> Estoque atual
              </CardTitle>
              <span className="text-sm text-slate-400">{data.units_in_stock} un.</span>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {data.stock_items.map((p) => (
                  <li key={p.id} className="flex justify-between items-center text-sm gap-3">
                    <span className="flex items-center gap-3 min-w-0">
                      <VapeIcon seed={p.id} />
                      <span className="truncate text-slate-200">{p.name}</span>
                    </span>
                    <span className={`font-mono font-semibold whitespace-nowrap ${
                      p.stock <= 0 ? 'text-rose-400' : p.stock <= p.min_stock ? 'text-amber-400' : 'text-foreground'}`}>
                      {p.stock} un.
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="alert-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="font-heading text-lg flex items-center gap-3 text-foreground">
                <AlertTriangle className="h-6 w-6 text-amber-400" /> Repor estoque
              </CardTitle>
              <Link to="/purchases">
                <Button variant="outline" size="sm" className="border-violet-500/60 text-violet-300 hover:bg-violet-500/10">Comprar</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {data.low_stock.length === 0 ? (
                <p className="text-center text-slate-400 py-6">Todos os produtos acima do mínimo</p>
              ) : (
                <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {data.low_stock.map((p) => (
                    <li key={p.id} className="flex justify-between items-center text-sm gap-3">
                      <span className="flex items-center gap-3 min-w-0">
                        <VapeIcon seed={p.id} />
                        <span className="truncate text-slate-200">{p.name}</span>
                      </span>
                      <span className={`whitespace-nowrap ${p.stock <= 0 ? 'status-critical' : 'status-low'}`}>
                        {p.stock} / mín {p.min_stock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg text-foreground">Mais vendidos no mês</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.top_products.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Sem vendas neste mês</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>Produto</th><th className="text-right">Qtd</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {data.top_products.map((t) => (
                    <tr key={t.product_name}>
                      <td>{t.product_name}</td>
                      <td className="text-right font-mono">{t.quantity}</td>
                      <td className="text-right font-mono">{money(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-heading text-lg text-foreground">Últimas vendas</CardTitle>
            <Link to="/sales"><Button variant="outline" size="sm">Ver todas</Button></Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recent_sales.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Nenhuma venda ainda</p>
            ) : (
              <table className="data-table">
                <tbody>
                  {data.recent_sales.map((s) => (
                    <tr key={s.id} className={s.status === 'cancelada' ? 'opacity-50' : ''}>
                      <td>
                        <p className="font-mono text-sm font-medium">{s.number}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(s.created_at)}</p>
                      </td>
                      <td className="text-sm">{s.customer_name || 'Consumidor final'}</td>
                      <td className="text-right font-mono">{money(s.total)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" title="Fatura PDF"
                          onClick={() => openInvoice(s).catch(() => toast.error('Falha ao gerar a fatura'))}>
                          <FileText className="h-4 w-4 text-slate-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
