import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
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
  Download,
  Share2,
  FileText,
  Trash2,
  Euro,
  AlertTriangle
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
  Cell,
  Legend
} from 'recharts';

import { API_URL as API } from '../config';

const WASTE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

const ReportsPage = () => {
  const { currentUnit } = useUnit();
  const { company, isAdmin } = useAuth();
  const [stockStatus, setStockStatus] = useState([]);
  const [consumption, setConsumption] = useState([]);
  const [ordersHistory, setOrdersHistory] = useState({ orders: [], summary: {} });
  const [wasteEntries, setWasteEntries] = useState([]);
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
  }, [currentUnit, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReports = async () => {
    setLoading(true);
    try {
      const requests = [
        axios.get(`${API}/reports/stock-status/${currentUnit.id}`),
        axios.get(`${API}/reports/consumption/${currentUnit.id}?days=30`),
        axios.get(`${API}/reports/orders-history/${currentUnit.id}?start_date=${format(dateRange.start, 'yyyy-MM-dd')}&end_date=${format(dateRange.end, 'yyyy-MM-dd')}`),
        axios.get(`${API}/waste/entries?days=30`)
      ];
      const [stockRes, consumptionRes, ordersRes, wasteRes] = await Promise.all(requests);
      setStockStatus(stockRes.data);
      setConsumption(consumptionRes.data);
      setOrdersHistory(ordersRes.data);
      setWasteEntries(wasteRes.data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadReportPdf = async (reportType) => {
    try {
      let res;
      if (reportType === 'stock') {
        res = await axios.get(`${API}/reports/stock-status/${currentUnit.id}/pdf`);
      } else if (reportType === 'consumption') {
        res = await axios.get(`${API}/reports/consumption/${currentUnit.id}/pdf?days=30`);
      } else if (reportType === 'orders') {
        res = await axios.get(`${API}/reports/orders-history/${currentUnit.id}/pdf?start_date=${format(dateRange.start, 'yyyy-MM-dd')}&end_date=${format(dateRange.end, 'yyyy-MM-dd')}`);
      }
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
      link.download = res.data.filename;
      link.click();
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  const shareReportPdf = async (reportType) => {
    try {
      let res;
      if (reportType === 'stock') {
        res = await axios.get(`${API}/reports/stock-status/${currentUnit.id}/pdf`);
      } else if (reportType === 'consumption') {
        res = await axios.get(`${API}/reports/consumption/${currentUnit.id}/pdf?days=30`);
      } else if (reportType === 'orders') {
        res = await axios.get(`${API}/reports/orders-history/${currentUnit.id}/pdf?start_date=${format(dateRange.start, 'yyyy-MM-dd')}&end_date=${format(dateRange.end, 'yyyy-MM-dd')}`);
      }
      const byteCharacters = atob(res.data.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const file = new File([blob], res.data.filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: res.data.share_title, text: res.data.share_text, files: [file] });
        toast.success('Shared successfully');
      } else if (navigator.share) {
        await navigator.share({ title: res.data.share_title, text: res.data.share_text });
        toast.success('Shared successfully');
      } else {
        downloadReportPdf(reportType);
      }
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Failed to share');
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
    toast.success('CSV exported');
  };

  // ── Waste calculations ──────────────────────────────────────────
  const wasteByReason = wasteEntries.reduce((acc, e) => {
    const key = e.reason_name || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const wastePieData = Object.entries(wasteByReason).map(([name, value]) => ({ name, value }));

  const wasteByDay = wasteEntries.reduce((acc, e) => {
    acc[e.date] = (acc[e.date] || 0) + 1;
    return acc;
  }, {});
  const wasteBarData = Object.entries(wasteByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date: date.slice(5), count }));

  // cost: só calcula se isAdmin (campo price nos itens via consumption)
  const wasteCost = isAdmin
    ? wasteEntries.reduce((sum, e) => {
        const item = consumption.find(c => c.item_id === e.item_id);
        const price = item?.price || 0;
        return sum + e.quantity * price;
      }, 0)
    : null;

  // projected monthly waste cost (extrapolação 30→30 dias)
  const projectedMonthlyCost = wasteCost !== null
    ? (wasteCost / 30) * 30
    : null;

  if (!currentUnit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <BarChart3 className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">No Unit Selected</h2>
        <p className="text-slate-500">Please select a unit to view reports</p>
      </div>
    );
  }

  const stockChartData = stockStatus.slice(0, 10).map(item => ({
    name: item.item_name.substring(0, 12),
    current: Math.round(item.current_stock),
    minimum: Math.round(item.minimum_stock)
  }));

  const consumptionChartData = consumption.slice(0, 10).map(item => ({
    name: item.item_name.substring(0, 12),
    daily: Math.round(item.average_daily * 10) / 10,
    total: Math.round(item.total_consumption)
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
          <TabsTrigger value="waste" data-testid="waste-report-tab">
            <Trash2 className="h-4 w-4 mr-2" />
            Waste
          </TabsTrigger>
        </TabsList>

        {/* Stock Status Report */}
        <TabsContent value="stock" className="mt-6 space-y-6">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => shareReportPdf('stock')} data-testid="share-stock-btn">
              <Share2 className="h-4 w-4 mr-2" />Share PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadReportPdf('stock')} data-testid="download-stock-pdf-btn">
              <FileText className="h-4 w-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCsv(stockStatus, 'stock_status')} data-testid="export-stock-btn">
              <Download className="h-4 w-4 mr-2" />CSV
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Current vs Minimum Stock</CardTitle>
              <CardDescription>Generated: {format(new Date(), 'PPpp')}</CardDescription>
            </CardHeader>
            <CardContent>
              {stockChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="current" name="Current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="minimum" name="Minimum" fill="#e11d48" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400">No stock data available</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Stock Details</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th><th>Section</th><th>Current</th><th>Minimum</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockStatus.map((item) => (
                      <tr key={item.item_id}>
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">{Math.round(item.current_stock)} {item.unit_of_measure}</td>
                        <td className="font-mono">{Math.round(item.minimum_stock)} {item.unit_of_measure}</td>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => shareReportPdf('consumption')} data-testid="share-consumption-btn">
              <Share2 className="h-4 w-4 mr-2" />Share PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadReportPdf('consumption')} data-testid="download-consumption-pdf-btn">
              <FileText className="h-4 w-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToCsv(consumption, 'consumption')} data-testid="export-consumption-btn">
              <Download className="h-4 w-4 mr-2" />CSV
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Average Daily Consumption</CardTitle>
              <CardDescription>Last 30 days · Generated: {format(new Date(), 'PPpp')}</CardDescription>
            </CardHeader>
            <CardContent>
              {consumptionChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consumptionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="daily" name="Daily Avg" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400">No consumption data available</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Consumption Details</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th><th>Section</th><th>Total</th><th>Daily Avg</th><th>Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumption.map((item) => (
                      <tr key={item.item_id}>
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">{Math.round(item.total_consumption)} {item.unit_of_measure}</td>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => shareReportPdf('orders')} data-testid="share-orders-btn">
              <Share2 className="h-4 w-4 mr-2" />Share PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadReportPdf('orders')} data-testid="download-orders-pdf-btn">
              <FileText className="h-4 w-4 mr-2" />PDF
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-4">
                <p className="text-sm text-blue-600 font-medium">Total Orders</p>
                <p className="font-heading text-3xl font-bold text-blue-900">{ordersHistory.summary.total || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="py-4">
                <p className="text-sm text-amber-600 font-medium">Pending</p>
                <p className="font-heading text-3xl font-bold text-amber-900">{ordersHistory.summary.pending || 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="py-4">
                <p className="text-sm text-emerald-600 font-medium">Completed</p>
                <p className="font-heading text-3xl font-bold text-emerald-900">{ordersHistory.summary.completed || 0}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Orders in Period</CardTitle>
              <CardDescription>
                {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')} · Generated: {format(new Date(), 'PPpp')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersHistory.orders.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No orders in this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>Order #</th><th>Target Date</th><th>Items</th><th>Status</th><th>Created</th></tr>
                    </thead>
                    <tbody>
                      {ordersHistory.orders.map((order) => (
                        <tr key={order.id}>
                          <td className="font-mono font-medium">{order.order_number}</td>
                          <td>{order.target_date}</td>
                          <td className="font-mono">{order.items.length} items</td>
                          <td>
                            <span className={order.status === 'completed' ? 'status-ok' : 'status-low'}>
                              {order.status}
                            </span>
                          </td>
                          <td className="text-slate-500 text-sm">{new Date(order.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── WASTE REPORT (nova aba) ── */}
        <TabsContent value="waste" className="mt-6 space-y-6">

          {/* KPI cards — valores só para Admin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-600 font-medium">Total Waste Events</p>
                </div>
                <p className="font-heading text-3xl font-bold text-red-900">{wasteEntries.length}</p>
                <p className="text-xs text-red-400 mt-1">last 30 days</p>
              </CardContent>
            </Card>

            {isAdmin && (
              <>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Euro className="h-4 w-4 text-orange-500" />
                      <p className="text-sm text-orange-600 font-medium">Estimated Waste Cost</p>
                    </div>
                    <p className="font-heading text-3xl font-bold text-orange-900">
                      €{wasteCost !== null ? wasteCost.toFixed(2) : '—'}
                    </p>
                    <p className="text-xs text-orange-400 mt-1">based on item prices · last 30 days</p>
                  </CardContent>
                </Card>

                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                      <p className="text-sm text-amber-600 font-medium">Projected Monthly Cost</p>
                    </div>
                    <p className="font-heading text-3xl font-bold text-amber-900">
                      €{projectedMonthlyCost !== null ? projectedMonthlyCost.toFixed(2) : '—'}
                    </p>
                    <p className="text-xs text-amber-400 mt-1">extrapolation based on current trend</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar: waste per day */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Waste Events — Last 14 Days</CardTitle>
              </CardHeader>
              <CardContent>
                {wasteBarData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wasteBarData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Events" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400">No waste data</div>
                )}
              </CardContent>
            </Card>

            {/* Pie: waste by reason */}
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">Waste by Reason</CardTitle>
              </CardHeader>
              <CardContent>
                {wastePieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={wastePieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {wastePieData.map((_, index) => (
                            <Cell key={index} fill={WASTE_COLORS[index % WASTE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400">No waste data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Waste detail table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Waste Detail</CardTitle>
              <CardDescription>Last 30 days · {wasteEntries.length} events</CardDescription>
            </CardHeader>
            <CardContent>
              {wasteEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No waste recorded in this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Reason</th>
                        <th>Initials</th>
                        {isAdmin && <th>Est. Cost</th>}
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wasteEntries.map((entry) => {
                        const item = consumption.find(c => c.item_id === entry.item_id);
                        const price = item?.price || 0;
                        const cost = entry.quantity * price;
                        return (
                          <tr key={entry.id}>
                            <td className="text-slate-500 text-sm">{entry.date}</td>
                            <td className="font-medium">{entry.item_name}</td>
                            <td className="font-mono">{entry.quantity} {entry.unit_of_measure}</td>
                            <td>
                              <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                                {entry.reason_name}
                              </span>
                            </td>
                            <td className="font-mono text-center">{entry.initials}</td>
                            {isAdmin && (
                              <td className="font-mono text-orange-700">
                                {price > 0 ? `€${cost.toFixed(2)}` : '—'}
                              </td>
                            )}
                            <td className="text-slate-500 text-sm">{entry.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(wasteEntries, 'waste_report')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
