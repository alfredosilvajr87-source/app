import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import {
  BarChart3,
  Package,
  TrendingUp,
  ShoppingCart,
  CalendarIcon,
  Download
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReportsPage = () => {
  const { currentUnit } = useUnit();
  const [stockStatus, setStockStatus] = useState([]);
  const [consumption, setConsumption] = useState([]);
  const [ordersHistory, setOrdersHistory] = useState({ orders: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date()
  });
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);

  useEffect(() => {
    if (currentUnit) {
      fetchReports();
    }
  }, [currentUnit, dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [stockRes, consumptionRes, ordersRes] = await Promise.all([
        axios.get(`${API}/reports/stock-status/${currentUnit.id}`),
        axios.get(`${API}/reports/consumption/${currentUnit.id}?days=30`),
        axios.get(`${API}/reports/orders-history/${currentUnit.id}?start_date=${format(dateRange.start, 'yyyy-MM-dd')}&end_date=${format(dateRange.end, 'yyyy-MM-dd')}`)
      ]);
      
      setStockStatus(stockRes.data);
      setConsumption(consumptionRes.data);
      setOrdersHistory(ordersRes.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = (data, filename) => {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  if (!currentUnit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <BarChart3 className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">No Unit Selected</h2>
        <p className="text-slate-500">Please select a unit to view reports</p>
      </div>
    );
  }

  // Prepare chart data
  const stockChartData = stockStatus.slice(0, 10).map(item => ({
    name: item.item_name.substring(0, 15),
    current: item.current_stock,
    minimum: item.minimum_stock
  }));

  const consumptionChartData = consumption.slice(0, 10).map(item => ({
    name: item.item_name.substring(0, 15),
    daily: item.average_daily,
    total: item.total_consumption
  }));

  return (
    <div className="space-y-8" data-testid="reports-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Reports
          </h1>
          <p className="text-slate-500 mt-1">
            Analytics and insights for {currentUnit.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="start-date-btn">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(dateRange.start, 'MMM d')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.start}
                onSelect={(date) => {
                  setDateRange({ ...dateRange, start: date || subDays(new Date(), 30) });
                  setStartCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
          <span className="text-slate-400">to</span>
          <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="end-date-btn">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(dateRange.end, 'MMM d')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={dateRange.end}
                onSelect={(date) => {
                  setDateRange({ ...dateRange, end: date || new Date() });
                  setEndCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs defaultValue="stock" className="w-full">
        <TabsList>
          <TabsTrigger value="stock" data-testid="stock-report-tab">
            <Package className="h-4 w-4 mr-2" />
            Stock Status
          </TabsTrigger>
          <TabsTrigger value="consumption" data-testid="consumption-report-tab">
            <TrendingUp className="h-4 w-4 mr-2" />
            Consumption
          </TabsTrigger>
          <TabsTrigger value="orders" data-testid="orders-report-tab">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Orders History
          </TabsTrigger>
        </TabsList>

        {/* Stock Status Report */}
        <TabsContent value="stock" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(stockStatus, 'stock_status')}
              data-testid="export-stock-btn"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Current vs Minimum Stock</CardTitle>
            </CardHeader>
            <CardContent>
              {stockChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="current" name="Current Stock" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="minimum" name="Minimum Stock" fill="#e11d48" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400">
                  No stock data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Stock Details</CardTitle>
            </CardHeader>
            <CardContent>
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
                    {stockStatus.map((item) => (
                      <tr key={item.item_id}>
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">{item.current_stock} {item.unit_of_measure}</td>
                        <td className="font-mono">{item.minimum_stock} {item.unit_of_measure}</td>
                        <td>
                          <span className={`status-${item.status}`}>
                            {item.status === 'critical' ? 'Critical' : item.status === 'low' ? 'Low' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consumption Report */}
        <TabsContent value="consumption" className="mt-6 space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(consumption, 'consumption')}
              data-testid="export-consumption-btn"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Average Daily Consumption</CardTitle>
              <CardDescription>Based on last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {consumptionChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consumptionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="daily" name="Daily Avg" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400">
                  No consumption data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Consumption Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Section</th>
                      <th>Total Consumed</th>
                      <th>Daily Average</th>
                      <th>Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumption.map((item) => (
                      <tr key={item.item_id}>
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">{item.total_consumption} {item.unit_of_measure}</td>
                        <td className="font-mono">{item.average_daily} {item.unit_of_measure}</td>
                        <td className="font-mono">{item.entries_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders History Report */}
        <TabsContent value="orders" className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-4">
                <p className="text-sm text-blue-600 font-medium">Total Orders</p>
                <p className="font-heading text-3xl font-bold text-blue-900">
                  {ordersHistory.summary.total || 0}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-4">
                <p className="text-sm text-amber-600 font-medium">Pending</p>
                <p className="font-heading text-3xl font-bold text-amber-900">
                  {ordersHistory.summary.pending || 0}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="py-4">
                <p className="text-sm text-emerald-600 font-medium">Completed</p>
                <p className="font-heading text-3xl font-bold text-emerald-900">
                  {ordersHistory.summary.completed || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Orders in Period</CardTitle>
              <CardDescription>
                {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersHistory.orders.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  No orders in this period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Target Date</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersHistory.orders.map((order) => (
                        <tr key={order.id}>
                          <td className="font-medium">{order.target_date}</td>
                          <td className="font-mono">{order.items.length} items</td>
                          <td>
                            <span className={order.status === 'completed' ? 'status-ok' : 'status-low'}>
                              {order.status}
                            </span>
                          </td>
                          <td className="text-slate-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="text-slate-500">
                            {order.completed_at ? new Date(order.completed_at).toLocaleDateString() : '-'}
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
      </Tabs>
    </div>
  );
};

export default ReportsPage;
