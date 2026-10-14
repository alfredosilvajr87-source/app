import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  Package, Receipt, Truck, TrendingUp, Wallet, AlertTriangle, FileText, Sparkles, Boxes,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiError, formatDateTime, openInvoice, tzOffset } from '../lib/store';

import { API_URL as API } from '../config';

const Kpi = ({ label, value, sub, icon: Icon, tone }) => (
  <Card className="kpi-card animate-fade-in">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className={`font-heading text-2xl font-bold mt-1 truncate ${tone}`}>{value}</p>
      </div>
      <div className="p-2 bg-slate-100 rounded-lg">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
    </div>
    {sub && <p className="mt-3 text-sm text-slate-500">{sub}</p>}
  </Card>
);

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const { money } = useStore();
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (data && data.products_count === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-4 bg-slate-100 rounded-full mb-6">
          <Package className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">Nenhum produto ainda</h2>
        <p className="text-slate-500 mb-6 max-w-md">
          Cadastre seus vapers ou carregue 10 produtos de exemplo para começar. Depois registre uma
          compra para dar entrada no estoque.
        </p>
        <div className="flex gap-2 flex-wrap justify-center">
          {isAdmin && (
            <Button onClick={seedVapers} data-testid="seed-vapers-btn">
              <Sparkles className="h-4 w-4 mr-2" /> Carregar 10 vapers de exemplo
            </Button>
          )}
          <Link to="/products"><Button variant="outline">Ir para Produtos</Button></Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Painel</h1>
          <p className="text-slate-500 mt-1">Resumo de vendas, compras e estoque</p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchases">
            <Button variant="outline"><Truck className="h-4 w-4 mr-2" /> Nova compra</Button>
          </Link>
          <Link to="/sales">
            <Button><Receipt className="h-4 w-4 mr-2" /> Nova venda</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Kpi label="Vendas hoje" value={money(data.today_revenue)} icon={Receipt}
          tone="text-slate-900" sub={`${data.today_count} venda(s)`} />
        <Kpi label="Vendas no mês" value={money(data.month_revenue)} icon={TrendingUp}
          tone="text-emerald-600" sub={isAdmin ? `Lucro estimado: ${money(data.month_profit)}` : `${data.month_count} venda(s)`} />
        <Kpi label="Compras no mês" value={money(data.month_purchases)} icon={Truck} tone="text-slate-900" />
        <Kpi label="Estoque" value={`${data.units_in_stock} un.`} icon={Wallet} tone="text-slate-900"
          sub={`Custo ${money(data.stock_value_cost)} · Venda ${money(data.stock_value_sale)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 self-start">
          <CardHeader><CardTitle className="font-heading text-lg">Vendas dos últimos 7 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.last7}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => money(v).replace(/,\d{2}$|\.\d{2}$/, '')} />
                  <Tooltip formatter={(v) => [money(v), 'Vendas']} />
                  <Bar dataKey="total" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Boxes className="h-4 w-4 text-blue-600" /> Estoque atual
            </CardTitle>
            <span className="text-sm text-slate-500">{data.units_in_stock} un.</span>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {data.stock_items.map((p) => (
                <li key={p.id} className="flex justify-between items-center text-sm gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className={`font-mono font-semibold whitespace-nowrap ${
                    p.stock <= 0 ? 'text-rose-600' : p.stock <= p.min_stock ? 'text-amber-600' : 'text-slate-900'}`}>
                    {p.stock} un.
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Repor estoque
            </CardTitle>
            <Link to="/purchases"><Button variant="outline" size="sm">Comprar</Button></Link>
          </CardHeader>
          <CardContent>
            {data.low_stock.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Todos os produtos acima do mínimo</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {data.low_stock.map((p) => (
                  <li key={p.id} className="flex justify-between items-center text-sm gap-2">
                    <span className="truncate">{p.name}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Mais vendidos no mês</CardTitle></CardHeader>
          <CardContent>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Últimas vendas</CardTitle>
            <Link to="/sales"><Button variant="outline" size="sm">Ver todas</Button></Link>
          </CardHeader>
          <CardContent>
            {data.recent_sales.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Nenhuma venda ainda</p>
            ) : (
              <table className="data-table">
                <tbody>
                  {data.recent_sales.map((s) => (
                    <tr key={s.id} className={s.status === 'cancelada' ? 'opacity-50' : ''}>
                      <td>
                        <p className="font-mono text-sm font-medium">{s.number}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(s.created_at)}</p>
                      </td>
                      <td className="text-sm">{s.customer_name || 'Consumidor final'}</td>
                      <td className="text-right font-mono">{money(s.total)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" title="Fatura PDF"
                          onClick={() => openInvoice(s).catch(() => toast.error('Falha ao gerar a fatura'))}>
                          <FileText className="h-4 w-4 text-slate-500" />
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
