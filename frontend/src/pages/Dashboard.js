import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  CheckCircle2,
  Layers,
  TrendingUp,
  ArrowRight,
  Clock
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { currentUnit, units, refreshUnits } = useUnit();
  const [stats, setStats] = useState(null);
  const [stockStatus, setStockStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUnit) {
      fetchDashboardData();
    }
  }, [currentUnit]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, stockRes] = await Promise.all([
        axios.get(`${API}/reports/dashboard/${currentUnit.id}`),
        axios.get(`${API}/reports/stock-status/${currentUnit.id}`)
      ]);
      setStats(statsRes.data);
      setStockStatus(stockRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    try {
      await axios.post(`${API}/seed`);
      toast.success('Sample data created successfully!');
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to create sample data');
    }
  };

  if (!currentUnit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-4 bg-slate-100 rounded-full mb-6">
          <Layers className="h-12 w-12 text-slate-400" />
        </div>
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">No Unit Selected</h2>
        <p className="text-slate-500 mb-6 max-w-md">
          Please create a unit first to start managing your kitchen inventory.
        </p>
        <Link to="/settings">
          <Button data-testid="create-unit-btn">
            Create Your First Unit
          </Button>
        </Link>
      </div>
    );
  }

  const statusData = stockStatus.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = [
    { name: 'OK', value: statusData.ok || 0, color: '#059669' },
    { name: 'Low', value: statusData.low || 0, color: '#d97706' },
    { name: 'Critical', value: statusData.critical || 0, color: '#e11d48' },
  ].filter(d => d.value > 0);

  const criticalItems = stockStatus.filter(item => item.status === 'critical').slice(0, 5);
  const lowItems = stockStatus.filter(item => item.status === 'low').slice(0, 5);

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Overview of {currentUnit.name} inventory status
          </p>
        </div>
        <div className="flex gap-3">
          {stats?.total_items === 0 && (
            <Button onClick={seedData} variant="outline" data-testid="seed-data-btn">
              Load Sample Data
            </Button>
          )}
          <Link to="/orders">
            <Button data-testid="new-order-btn">
              <ShoppingCart className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="kpi-card animate-fade-in stagger-1" data-testid="kpi-total-items">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Items</p>
              <p className="font-heading text-3xl font-bold text-slate-900 mt-1">
                {stats?.total_items || 0}
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-slate-500">
            <Layers className="h-4 w-4 mr-1" />
            {stats?.sections_count || 0} sections
          </div>
        </Card>

        <Card className="kpi-card animate-fade-in stagger-2" data-testid="kpi-critical-stock">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Critical Stock</p>
              <p className="font-heading text-3xl font-bold text-rose-600 mt-1">
                {stats?.critical_stock_count || 0}
              </p>
            </div>
            <div className="p-2 bg-rose-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-amber-600">
            <Clock className="h-4 w-4 mr-1" />
            {stats?.low_stock_count || 0} items low
          </div>
        </Card>

        <Card className="kpi-card animate-fade-in stagger-3" data-testid="kpi-pending-orders">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Orders</p>
              <p className="font-heading text-3xl font-bold text-amber-600 mt-1">
                {stats?.pending_orders || 0}
              </p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <Link to="/orders" className="mt-4 flex items-center text-sm text-blue-600 hover:underline">
            View orders
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Card>

        <Card className="kpi-card animate-fade-in stagger-4" data-testid="kpi-completed-orders">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="font-heading text-3xl font-bold text-emerald-600 mt-1">
                {stats?.completed_orders || 0}
              </p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-slate-500">
            <TrendingUp className="h-4 w-4 mr-1" />
            Orders this month
          </div>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Status Chart */}
        <Card className="lg:col-span-1" data-testid="stock-status-chart">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Stock Status</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                No stock data available
              </div>
            )}
            <div className="flex justify-center gap-6 mt-4">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-600">
                    {item.name} ({item.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Critical Items */}
        <Card className="lg:col-span-2" data-testid="critical-items-table">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Items Requiring Attention</CardTitle>
            <Link to="/daily-entry">
              <Button variant="outline" size="sm" data-testid="update-stock-btn">
                Update Stock
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {criticalItems.length === 0 && lowItems.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-400" />
                <p className="font-medium">All items have adequate stock levels</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Section</th>
                      <th>Current</th>
                      <th>Minimum</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...criticalItems, ...lowItems].map((item) => (
                      <tr key={item.item_id}>
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">
                          {item.current_stock} {item.unit_of_measure}
                        </td>
                        <td className="font-mono text-slate-500">
                          {item.minimum_stock} {item.unit_of_measure}
                        </td>
                        <td>
                          <span className={`status-${item.status}`}>
                            {item.status === 'critical' ? 'Critical' : 'Low'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
