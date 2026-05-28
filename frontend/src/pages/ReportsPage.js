import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import {
  BarChart3, Package, TrendingUp, ShoppingCart, CalendarIcon,
  Download, FileText, Trash2, Building2, Check
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { API_URL as API } from '../config';

const WASTE_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];

const KpiCard = ({ label, value, sub, color = 'slate', icon: Icon }) => {
  const colors = {
    slate:  { bg:'bg-slate-50',   border:'border-slate-200',  text:'text-slate-900',  sub:'text-slate-500',  icon:'text-slate-400' },
    blue:   { bg:'bg-blue-50',    border:'border-blue-200',   text:'text-blue-900',   sub:'text-blue-400',   icon:'text-blue-400' },
    green:  { bg:'bg-emerald-50', border:'border-emerald-200',text:'text-emerald-900',sub:'text-emerald-500',icon:'text-emerald-400' },
    red:    { bg:'bg-red-50',     border:'border-red-200',    text:'text-red-900',    sub:'text-red-400',    icon:'text-red-400' },
    orange: { bg:'bg-orange-50',  border:'border-orange-200', text:'text-orange-900', sub:'text-orange-400', icon:'text-orange-400' },
    amber:  { bg:'bg-amber-50',   border:'border-amber-200',  text:'text-amber-900',  sub:'text-amber-400',  icon:'text-amber-400' },
  };
  const c = colors[color];
  return (
    <Card className={`${c.bg} ${c.border}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${c.sub}`}>{label}</p>
            <p className={`font-heading text-2xl font-bold mt-1 ${c.text}`}>{value}</p>
            {sub && <p className={`text-xs mt-1 ${c.sub}`}>{sub}</p>}
          </div>
          {Icon && <Icon className={`h-6 w-6 ${c.icon} mt-1`} />}
        </div>
      </CardContent>
    </Card>
  );
};

const StatusBadge = ({ status }) => {
  if (status === 'critical') return (
    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">Critical</span>
  );
  if (status === 'low') return (
    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">Low</span>
  );
  return (
    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">OK</span>
  );
};

const fmt = (v) => v !== undefined && v !== null ? `€${Number(v).toFixed(2)}` : '—';

const ReportsPage = () => {
  const { currentUnit, units } = useUnit();
  const { isAdmin, user } = useAuth();
  const [stockStatus, setStockStatus]     = useState([]);
  const [consumption, setConsumption]     = useState([]);
  const [ordersHistory, setOrdersHistory] = useState({ orders: [], summary: {} });
  const [wasteEntries, setWasteEntries]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [dateRange, setDateRange]         = useState({ start: subDays(new Date(), 30), end: new Date() });
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen]     = useState(false);
  const [selectedUnitIds, setSelectedUnitIds]     = useState([]);

  // Units available to this user
  const availableUnits = isAdmin
    ? units
    : units.filter(u => (user?.unit_ids || []).includes(u.id));

  const multiUnit = selectedUnitIds.length > 1;

  // Init selected units when currentUnit loads
  useEffect(() => {
    if (currentUnit && selectedUnitIds.length === 0) {
      setSelectedUnitIds([currentUnit.id]);
    }
  }, [currentUnit]); // eslint-disable-line

  useEffect(() => {
    if (selectedUnitIds.length > 0) fetchReports();
  }, [selectedUnitIds, dateRange]); // eslint-disable-line

  const toggleUnit = (uid) => {
    setSelectedUnitIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const selectAll  = () => setSelectedUnitIds(availableUnits.map(u => u.id));
  const selectOnly = (uid) => setSelectedUnitIds([uid]);

  const unitName = (uid) => availableUnits.find(u => u.id === uid)?.name || uid;

  const fetchReports = async () => {
    if (!selectedUnitIds.length) return;
    setLoading(true);
    try {
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr   = format(dateRange.end,   'yyyy-MM-dd');

      const [stockResults, consResults, ordersResults, wasteResults] = await Promise.all([
        Promise.all(selectedUnitIds.map(uid => axios.get(`${API}/reports/stock-status/${uid}`))),
        Promise.all(selectedUnitIds.map(uid => axios.get(`${API}/reports/consumption/${uid}?days=30`))),
        Promise.all(selectedUnitIds.map(uid => axios.get(`${API}/reports/orders-history/${uid}?start_date=${startStr}&end_date=${endStr}`))),
        Promise.all(selectedUnitIds.map(uid => axios.get(`${API}/waste/entries?unit_id=${uid}&days=30`)))
      ]);

      // Combine all results, tagging each item with unit_name
      const allStock = stockResults.flatMap((res, i) =>
        res.data.map(item => ({ ...item, unit_name: unitName(selectedUnitIds[i]) }))
      );
      const allCons = consResults.flatMap((res, i) =>
        res.data.map(item => ({ ...item, unit_name: unitName(selectedUnitIds[i]) }))
      );
      const allOrders = {
        orders: ordersResults.flatMap((res, i) =>
          (res.data.orders || []).map(o => ({ ...o, unit_name: unitName(selectedUnitIds[i]) }))
        ),
        summary: ordersResults.reduce((acc, res) => ({
          total:     (acc.total     || 0) + (res.data.summary?.total     || 0),
          pending:   (acc.pending   || 0) + (res.data.summary?.pending   || 0),
          completed: (acc.completed || 0) + (res.data.summary?.completed || 0),
        }), {})
      };
      const allWaste = wasteResults.flatMap((res, i) =>
        res.data.map(e => ({ ...e, unit_name: unitName(selectedUnitIds[i]) }))
      );

      setStockStatus(allStock);
      setConsumption(allCons);
      setOrdersHistory(allOrders);
      setWasteEntries(allWaste);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── PDF download ─────────────────────────────────────────────────
  const downloadPdf = async (type) => {
    if (multiUnit) { toast.error('PDF only available for single unit. Deselect extra units.'); return; }
    const uid = selectedUnitIds[0];
    try {
      let res;
      if (type === 'stock')       res = await axios.get(`${API}/reports/stock-status/${uid}/pdf`);
      else if (type === 'consumption') res = await axios.get(`${API}/reports/consumption/${uid}/pdf?days=30`);
      else if (type === 'orders') res = await axios.get(`${API}/reports/orders-history/${uid}/pdf?start_date=${format(dateRange.start,'yyyy-MM-dd')}&end_date=${format(dateRange.end,'yyyy-MM-dd')}`);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
      link.download = res.data.filename;
      link.click();
      toast.success('PDF downloaded');
    } catch { toast.error('Failed to generate PDF'); }
  };

  // ── Excel export ─────────────────────────────────────────────────
  const exportToExcel = (type) => {
    const wb = XLSX.utils.book_new();
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const unitLabel = multiUnit
      ? selectedUnitIds.map(uid => availableUnits.find(u => u.id === uid)?.initials || '').join('+')
      : (availableUnits.find(u => u.id === selectedUnitIds[0])?.initials || 'unit');

    const addSheet = (rows, sheetName, colWidths, adminOnlyCols = []) => {
      if (!rows.length) return;
      const data = rows.map(row => {
        const r = { ...row };
        if (!isAdmin) adminOnlyCols.forEach(k => delete r[k]);
        return r;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    // ── STOCK ──────────────────────────────────────────────────────
    if (type === 'stock') {
      const filtered = stockStatusFilter === 'all' ? stockStatus : stockStatus.filter(i => i.status === stockStatusFilter);
      addSheet(
        filtered.map(i => ({
          ...(multiUnit ? { 'Unit': i.unit_name } : {}),
          'Item':            i.item_name,
          'Section':         i.section_name,
          'Unit of Measure': i.unit_of_measure,
          'Current Stock':   i.current_stock,
          'Minimum Stock':   i.minimum_stock,
          'Status':          i.status.toUpperCase(),
          'Last Entry':      i.last_entry_date || '—',
          'Price (€)':       i.price || 0,
          'Stock Value (€)': i.stock_value || 0,
          'To Buy (€)':      i.to_min_value || 0,
        })),
        'All Items',
        multiUnit ? [18,30,20,10,14,14,10,14,12,16,12] : [30,20,10,14,14,10,14,12,16,12],
        ['Price (€)', 'Stock Value (€)', 'To Buy (€)']
      );
      addSheet(
        stockStatus.filter(i => i.status === 'critical').map(i => ({
          ...(multiUnit ? { 'Unit': i.unit_name } : {}),
          'Item': i.item_name, 'Section': i.section_name,
          'Current': i.current_stock, 'Minimum': i.minimum_stock,
          'UoM': i.unit_of_measure, 'To Buy (€)': i.to_min_value || 0,
        })),
        'Critical Items', multiUnit ? [18,30,20,10,10,8,12] : [30,20,10,10,8,12], ['To Buy (€)']
      );
      if (isAdmin) {
        const bySection = stockStatus.reduce((acc, i) => {
          const k = i.section_name || 'Other';
          if (!acc[k]) acc[k] = { section: k, items: 0, stock_value: 0, to_buy: 0 };
          acc[k].items++; acc[k].stock_value += i.stock_value || 0; acc[k].to_buy += i.to_min_value || 0;
          return acc;
        }, {});
        addSheet(Object.values(bySection).map(s => ({
          'Section': s.section, 'Items': s.items,
          'Stock Value (€)': parseFloat(s.stock_value.toFixed(2)),
          'To Buy (€)': parseFloat(s.to_buy.toFixed(2)),
        })), 'By Section (€)', [25,8,16,14]);
      }
      XLSX.writeFile(wb, `stock_${unitLabel}_${dateStr}.xlsx`);
      toast.success('Excel exported — Stock Status');
    }

    // ── CONSUMPTION ────────────────────────────────────────────────
    else if (type === 'consumption') {
      addSheet(
        consumption.map(i => ({
          ...(multiUnit ? { 'Unit': i.unit_name } : {}),
          'Item': i.item_name, 'Section': i.section_name, 'UoM': i.unit_of_measure,
          'Total (30d)': i.total_consumption, 'Daily Avg': i.average_daily, 'Entries': i.entries_count,
          'Price (€)': i.price || 0, 'Total Cost (€)': i.total_cost || 0,
          'Daily Cost (€)': i.daily_cost || 0, 'Monthly Est. (€)': i.monthly_cost || 0,
        })),
        'Consumption',
        multiUnit ? [18,30,20,8,14,10,8,12,14,14,16] : [30,20,8,14,10,8,12,14,14,16],
        ['Price (€)', 'Total Cost (€)', 'Daily Cost (€)', 'Monthly Est. (€)']
      );
      if (isAdmin) {
        const bySection = consumption.reduce((acc, i) => {
          const k = i.section_name || 'Other';
          if (!acc[k]) acc[k] = { section: k, items: 0, total_cost: 0, monthly_cost: 0 };
          acc[k].items++; acc[k].total_cost += i.total_cost || 0; acc[k].monthly_cost += i.monthly_cost || 0;
          return acc;
        }, {});
        addSheet(Object.values(bySection).map(s => ({
          'Section': s.section, 'Items': s.items,
          'Total Cost (€)': parseFloat(s.total_cost.toFixed(2)),
          'Monthly Est. (€)': parseFloat(s.monthly_cost.toFixed(2)),
        })), 'By Section (€)', [25,8,16,16]);
      }
      XLSX.writeFile(wb, `consumption_${unitLabel}_${dateStr}.xlsx`);
      toast.success('Excel exported — Consumption');
    }

    // ── ORDERS ─────────────────────────────────────────────────────
    else if (type === 'orders') {
      addSheet(
        ordersHistory.orders.map(o => ({
          ...(multiUnit ? { 'Unit': o.unit_name } : {}),
          'Order #': o.order_number, 'Target Date': o.target_date,
          'Items': o.items.length, 'Status': o.status,
          'Created': new Date(o.created_at).toLocaleString(),
        })),
        'Orders', multiUnit ? [18,16,14,8,12,22] : [16,14,8,12,22]
      );
      addSheet([{
        'Total Orders': ordersHistory.summary.total || 0,
        'Pending': ordersHistory.summary.pending || 0,
        'Completed': ordersHistory.summary.completed || 0,
        'Units': selectedUnitIds.map(uid => unitName(uid)).join(', '),
        'Period Start': format(dateRange.start, 'yyyy-MM-dd'),
        'Period End': format(dateRange.end, 'yyyy-MM-dd'),
      }], 'Summary', [14,10,12,30,14,12]);
      XLSX.writeFile(wb, `orders_${unitLabel}_${format(dateRange.start,'yyyy-MM-dd')}_${format(dateRange.end,'yyyy-MM-dd')}.xlsx`);
      toast.success('Excel exported — Orders');
    }

    // ── WASTE ──────────────────────────────────────────────────────
    else if (type === 'waste') {
      addSheet(
        wasteEntries.map(e => {
          const item = consumption.find(c => c.item_id === e.item_id && (!multiUnit || c.unit_name === e.unit_name));
          const price = e.item_price || item?.price || 0;
          const cost = e.estimated_cost || (e.quantity * price);
          return {
            ...(multiUnit ? { 'Unit': e.unit_name } : {}),
            'Date': e.date, 'Item': e.item_name,
            'Quantity': e.quantity, 'UoM': e.unit_of_measure,
            'Reason': e.reason_name, 'Initials': e.initials,
            'Recorded By': e.recorded_by || '—',
            'Est. Cost (€)': price > 0 ? parseFloat(cost.toFixed(2)) : 0,
            'Notes': e.notes || '',
          };
        }),
        'Waste Detail',
        multiUnit ? [18,12,30,10,8,16,10,16,14,30] : [12,30,10,8,16,10,16,14,30],
        ['Est. Cost (€)']
      );
      const byReason = wasteEntries.reduce((acc, e) => {
        const k = e.reason_name || 'Other';
        if (!acc[k]) acc[k] = { reason: k, events: 0, cost: 0 };
        acc[k].events++;
        const price = e.item_price || consumption.find(c => c.item_id === e.item_id)?.price || 0;
        acc[k].cost += e.estimated_cost || (e.quantity * price);
        return acc;
      }, {});
      addSheet(
        Object.values(byReason).sort((a,b) => b.events - a.events).map(r => ({
          'Reason': r.reason, 'Events': r.events, 'Est. Cost (€)': parseFloat(r.cost.toFixed(2)),
        })),
        'By Reason', [20,10,14], ['Est. Cost (€)']
      );
      if (isAdmin && multiUnit) {
        const byUnit = wasteEntries.reduce((acc, e) => {
          const k = e.unit_name || 'Other';
          if (!acc[k]) acc[k] = { unit: k, events: 0, cost: 0 };
          acc[k].events++;
          const price = e.item_price || consumption.find(c => c.item_id === e.item_id)?.price || 0;
          acc[k].cost += e.estimated_cost || (e.quantity * price);
          return acc;
        }, {});
        addSheet(
          Object.values(byUnit).sort((a,b) => b.cost - a.cost).map(u => ({
            'Unit': u.unit, 'Events': u.events, 'Est. Cost (€)': parseFloat(u.cost.toFixed(2)),
          })),
          'By Unit (€)', [20,10,14]
        );
      }
      if (isAdmin) {
        const byItem = wasteEntries.reduce((acc, e) => {
          if (!acc[e.item_name]) acc[e.item_name] = { item: e.item_name, unit: e.unit_of_measure, events: 0, qty: 0, cost: 0 };
          acc[e.item_name].events++; acc[e.item_name].qty += e.quantity;
          const price = e.item_price || consumption.find(c => c.item_id === e.item_id)?.price || 0;
          acc[e.item_name].cost += e.estimated_cost || (e.quantity * price);
          return acc;
        }, {});
        addSheet(
          Object.values(byItem).sort((a,b) => b.cost - a.cost).map(i => ({
            'Item': i.item, 'UoM': i.unit, 'Events': i.events,
            'Total Qty': parseFloat(i.qty.toFixed(2)), 'Est. Cost (€)': parseFloat(i.cost.toFixed(2)),
          })),
          'By Item (€)', [30,8,10,12,14]
        );
      }
      XLSX.writeFile(wb, `waste_${unitLabel}_${dateStr}.xlsx`);
      toast.success('Excel exported — Waste');
    }
  };

  // ── Aggregate by item name when multi-unit (sum values across units) ─
  const aggregateByName = (arr, fields) => {
    const map = {};
    arr.forEach(item => {
      const key = item.item_name;
      if (!map[key]) { map[key] = { ...item }; }
      else { fields.forEach(f => { map[key][f] = (map[key][f] || 0) + (item[f] || 0); }); }
    });
    return Object.values(map);
  };

  const stockAgg       = multiUnit ? aggregateByName(stockStatus, ['current_stock','minimum_stock','stock_value','to_min_value']) : stockStatus;
  const consAgg        = multiUnit ? aggregateByName(consumption,  ['total_consumption','entries_count','total_cost','monthly_cost','daily_cost']).map(i => ({ ...i, average_daily: round2(i.total_consumption / 30) })) : consumption;

  function round2(v) { return Math.round((v || 0) * 100) / 100; }

  // ── Computed values ───────────────────────────────────────────────
  const criticalItems    = stockAgg.filter(i => i.status === 'critical');
  const lowItems         = stockAgg.filter(i => i.status === 'low');
  const totalStockValue  = stockAgg.reduce((s, i) => s + (i.stock_value || 0), 0);
  const totalToMinValue  = stockAgg.reduce((s, i) => s + (i.to_min_value || 0), 0);
  const totalMonthCost   = consAgg.reduce((s, i) => s + (i.monthly_cost || 0), 0);
  const totalConsCost    = consAgg.reduce((s, i) => s + (i.total_cost || 0), 0);
  const top5Consumption  = [...consAgg].sort((a,b) => (b.monthly_cost||0) - (a.monthly_cost||0)).slice(0, 5);
  const wasteByReason    = wasteEntries.reduce((acc, e) => { const k = e.reason_name||'Other'; acc[k]=(acc[k]||0)+1; return acc; }, {});
  const wastePieData     = Object.entries(wasteByReason).map(([name, value]) => ({ name, value }));
  const wasteByDay       = wasteEntries.reduce((acc, e) => { acc[e.date]=(acc[e.date]||0)+1; return acc; }, {});
  const wasteBarData     = Object.entries(wasteByDay).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([date,count])=>({date:date.slice(5),count}));
  const wasteCost        = isAdmin ? wasteEntries.reduce((s,e)=>{
    const price = e.item_price || consumption.find(c=>c.item_id===e.item_id)?.price || 0;
    return s + (e.estimated_cost || (e.quantity * price));
  }, 0) : null;

  if (!currentUnit) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <BarChart3 className="h-12 w-12 text-slate-300 mb-4" />
      <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">No Unit Selected</h2>
      <p className="text-slate-500">Please select a unit to view reports</p>
    </div>
  );

  // Charts use aggregated data (summed across units when multi-unit)
  const stockChartData = [...stockAgg].sort((a,b)=>(b.current_stock||0)-(a.current_stock||0)).slice(0,10).map(i=>({ name:i.item_name.substring(0,12), current:Math.round(i.current_stock||0), minimum:Math.round(i.minimum_stock||0) }));
  const consChartData  = [...consAgg].sort((a,b)=>(b.average_daily||0)-(a.average_daily||0)).slice(0,10).map(i=>({ name:i.item_name.substring(0,12), daily:round2(i.average_daily) }));

  const ExportButtons = ({ type, showPdf = true }) => (
    <div className="flex gap-2">
      {showPdf && (
        <Button variant="outline" size="sm" onClick={() => downloadPdf(type)} title={multiUnit ? 'PDF only for single unit' : ''}>
          <FileText className="h-4 w-4 mr-1" />PDF{multiUnit && <span className="ml-1 text-xs text-slate-400">(1 unit)</span>}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => exportToExcel(type)}
        className="border-green-300 text-green-700 hover:bg-green-50">
        <Download className="h-4 w-4 mr-1" />Excel
      </Button>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="reports-page">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">
            {multiUnit
              ? `Combined: ${selectedUnitIds.map(uid => unitName(uid)).join(', ')}`
              : `Analytics for ${unitName(selectedUnitIds[0] || '')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><CalendarIcon className="h-4 w-4 mr-2" />{format(dateRange.start,'MMM d')}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateRange.start} onSelect={(d)=>{ setDateRange({...dateRange,start:d||subDays(new Date(),30)}); setStartCalendarOpen(false); }} />
            </PopoverContent>
          </Popover>
          <span className="text-slate-400">to</span>
          <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><CalendarIcon className="h-4 w-4 mr-2" />{format(dateRange.end,'MMM d')}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateRange.end} onSelect={(d)=>{ setDateRange({...dateRange,end:d||new Date()}); setEndCalendarOpen(false); }} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Unit Selector */}
      {availableUnits.length > 1 && (
        <Card className="border-slate-200">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-600 mr-1">Units:</span>
              {availableUnits.map(unit => {
                const selected = selectedUnitIds.includes(unit.id);
                return (
                  <button
                    key={unit.id}
                    onClick={() => toggleUnit(unit.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                      selected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {unit.name}
                  </button>
                );
              })}
              <div className="flex gap-1 ml-2">
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">All</button>
                <span className="text-slate-300">|</span>
                {availableUnits.map(unit => (
                  <button key={unit.id} onClick={() => selectOnly(unit.id)}
                    className="text-xs text-slate-500 hover:text-slate-800 hover:underline">
                    {unit.initials}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-slate-400 text-sm">Loading reports...</div>
        </div>
      ) : (
      <Tabs defaultValue="stock" className="w-full">
        <TabsList>
          <TabsTrigger value="stock"><Package className="h-4 w-4 mr-2" />Stock Status</TabsTrigger>
          <TabsTrigger value="consumption"><TrendingUp className="h-4 w-4 mr-2" />Consumption</TabsTrigger>
          <TabsTrigger value="orders"><ShoppingCart className="h-4 w-4 mr-2" />Orders</TabsTrigger>
          <TabsTrigger value="waste"><Trash2 className="h-4 w-4 mr-2" />Waste</TabsTrigger>
        </TabsList>

        {/* ══ STOCK ═════════════════════════════════════════════════ */}
        <TabsContent value="stock" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Critical Items"    value={criticalItems.length} sub="below 50% of minimum"     color="red"    icon={Download} />
            <KpiCard label="Low Stock Items"   value={lowItems.length}      sub="below minimum"             color="amber"  icon={Download} />
            {isAdmin && <>
              <KpiCard label="Total Stock Value"  value={fmt(totalStockValue)} sub="current qty × price"    color="blue"   icon={Download} />
              <KpiCard label="To Buy (to min)"    value={fmt(totalToMinValue)} sub="estimated purchase cost" color="green"  icon={TrendingUp} />
            </>}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">Current vs Minimum Stock</CardTitle>
                <CardDescription>Top 10 items · {format(new Date(),'PPp')}</CardDescription>
              </div>
              <ExportButtons type="stock" />
            </CardHeader>
            <CardContent>
              {stockChartData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockChartData} margin={{top:20,right:30,left:20,bottom:60}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{fontSize:11}} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{fontSize:12}} />
                      <Tooltip />
                      <Bar dataKey="current" name="Current" fill="#3b82f6" radius={[4,4,0,0]} />
                      <Bar dataKey="minimum" name="Minimum" fill="#e11d48" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="h-80 flex items-center justify-center text-slate-400">No stock data available</div>}
            </CardContent>
          </Card>

          {criticalItems.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader><CardTitle className="font-heading text-base text-red-800">🔴 Critical Stock Alerts ({criticalItems.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {criticalItems.map((item, idx) => (
                    <div key={`${item.item_id}-${idx}`} className="bg-white rounded-lg p-3 border border-red-100">
                      {multiUnit && <p className="text-xs text-blue-600 font-semibold mb-1">{item.unit_name}</p>}
                      <p className="font-medium text-sm text-slate-900">{item.item_name}</p>
                      <p className="text-xs text-slate-500">{item.section_name}</p>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-red-600 font-mono">Have: {item.current_stock} {item.unit_of_measure}</span>
                        <span className="text-slate-500 font-mono">Min: {item.minimum_stock}</span>
                      </div>
                      {isAdmin && item.to_min_value > 0 && (
                        <p className="text-xs text-orange-600 mt-1 font-medium">Est. to buy: {fmt(item.to_min_value)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2 my-2">
            <span className="text-sm font-medium text-slate-500 mr-1">Filter:</span>
            {[['all','All',stockAgg.length,'slate'],['critical','🔴 Critical',criticalItems.length,'red'],['low','🟡 Low',lowItems.length,'amber'],['ok','🟢 OK',stockAgg.filter(i=>i.status==='ok').length,'emerald']].map(([val,label,count]) => (
              <button key={val} onClick={() => setStockStatusFilter(val)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-all ${stockStatusFilter === val ? 'ring-2 ring-offset-1 ring-slate-400' : ''} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                {label} ({count})
              </button>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Stock Details</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {multiUnit && <th>Unit</th>}
                      <th>Item</th><th>Section</th><th>Current</th><th>Minimum</th>
                      {isAdmin && <><th>Price</th><th>Stock Value</th><th>To Buy</th></>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stockStatusFilter === 'all' ? stockAgg : stockAgg.filter(i => i.status === stockStatusFilter)).map((item, idx) => (
                      <tr key={`${item.item_id}-${idx}`}>
                        {multiUnit && <td className="text-xs font-medium text-blue-700">{item.unit_name || '—'}</td>}
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">{Math.round(item.current_stock)} {item.unit_of_measure}</td>
                        <td className="font-mono">{Math.round(item.minimum_stock)} {item.unit_of_measure}</td>
                        {isAdmin && <>
                          <td className="font-mono text-slate-600">{item.price > 0 ? fmt(item.price) : '—'}</td>
                          <td className="font-mono text-blue-700 font-medium">{item.price > 0 ? fmt(item.stock_value) : '—'}</td>
                          <td className="font-mono text-orange-600">{item.price > 0 && item.to_min_value > 0 ? fmt(item.to_min_value) : '—'}</td>
                        </>}
                        <td><StatusBadge status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ CONSUMPTION ═══════════════════════════════════════════ */}
        <TabsContent value="consumption" className="mt-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Items Tracked"   value={consAgg.filter(i=>i.entries_count>0).length} sub="with entries last 30d" color="slate" icon={Package} />
            <KpiCard label="Top Consumer"    value={consAgg[0]?.item_name?.split(' ')[0]||'—'} sub={consAgg[0]?`${consAgg[0].total_consumption} ${consAgg[0].unit_of_measure}`:''} color="blue" icon={TrendingUp} />
            {isAdmin && <>
              <KpiCard label="Total Cost (30d)"   value={fmt(totalConsCost)}  sub="actual consumption cost" color="orange" icon={Download} />
              <KpiCard label="Projected Monthly"  value={fmt(totalMonthCost)} sub="based on daily avg"      color="amber"  icon={TrendingUp} />
            </>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-lg">Daily Avg Consumption</CardTitle>
                  <CardDescription>Top 10 · last 30 days</CardDescription>
                </div>
                <ExportButtons type="consumption" />
              </CardHeader>
              <CardContent>
                {consChartData.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={consChartData} margin={{top:10,right:20,left:0,bottom:60}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{fontSize:11}} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{fontSize:12}} />
                        <Tooltip />
                        <Bar dataKey="daily" name="Daily Avg" fill="#059669" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-72 flex items-center justify-center text-slate-400">No data</div>}
              </CardContent>
            </Card>

            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-lg">Top 5 — Monthly Cost</CardTitle>
                  <CardDescription>Highest cost items (daily avg × 30)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mt-2">
                    {top5Consumption.filter(i=>i.monthly_cost>0).slice(0,5).map((item, idx) => {
                      const maxCost = top5Consumption[0]?.monthly_cost || 1;
                      const pct = Math.round((item.monthly_cost / maxCost) * 100);
                      return (
                        <div key={`${item.item_id}-${idx}`}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-slate-800 truncate max-w-[60%]">
                              {multiUnit && <span className="text-xs text-blue-600 mr-1">[{item.unit_name}]</span>}
                              {item.item_name}
                            </span>
                            <span className="font-mono text-orange-700 font-semibold">{fmt(item.monthly_cost)}/mo</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{width:`${pct}%`}} />
                          </div>
                        </div>
                      );
                    })}
                    {top5Consumption.filter(i=>i.monthly_cost>0).length === 0 && (
                      <p className="text-slate-400 text-sm text-center py-8">Add prices to items to see costs</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">Consumption Details</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {multiUnit && <th>Unit</th>}
                      <th>Item</th><th>Section</th><th>Total (30d)</th><th>Daily Avg</th>
                      {isAdmin && <><th>Price</th><th>Total Cost</th><th>Monthly Est.</th></>}
                      <th>Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consAgg.map((item, idx) => (
                      <tr key={`${item.item_id}-${idx}`}>
                        {multiUnit && <td className="text-xs font-medium text-blue-700">{item.unit_name || 'Combined'}</td>}
                        <td className="font-medium">{item.item_name}</td>
                        <td className="text-slate-500">{item.section_name}</td>
                        <td className="font-mono">{Math.round(item.total_consumption)} {item.unit_of_measure}</td>
                        <td className="font-mono">{item.average_daily} {item.unit_of_measure}</td>
                        {isAdmin && <>
                          <td className="font-mono text-slate-600">{item.price > 0 ? fmt(item.price) : '—'}</td>
                          <td className="font-mono text-orange-700 font-medium">{item.price > 0 ? fmt(item.total_cost) : '—'}</td>
                          <td className="font-mono text-amber-700">{item.price > 0 ? fmt(item.monthly_cost) : '—'}</td>
                        </>}
                        <td className="font-mono text-slate-500">{item.entries_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ ORDERS ════════════════════════════════════════════════ */}
        <TabsContent value="orders" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Total Orders" value={ordersHistory.summary.total||0}     color="blue"   icon={ShoppingCart} />
            <KpiCard label="Pending"      value={ordersHistory.summary.pending||0}   color="amber"  icon={Download} />
            <KpiCard label="Completed"    value={ordersHistory.summary.completed||0} color="green"  icon={Download} />
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">Orders in Period</CardTitle>
                <CardDescription>{format(dateRange.start,'MMM d, yyyy')} – {format(dateRange.end,'MMM d, yyyy')}</CardDescription>
              </div>
              <ExportButtons type="orders" />
            </CardHeader>
            <CardContent>
              {ordersHistory.orders.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No orders in this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {multiUnit && <th>Unit</th>}
                        <th>Order #</th><th>Target Date</th><th>Items</th><th>Status</th><th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordersHistory.orders.map((order, idx) => (
                        <tr key={`${order.id}-${idx}`}>
                          {multiUnit && <td className="text-xs font-medium text-blue-700">{order.unit_name}</td>}
                          <td className="font-mono font-medium">{order.order_number}</td>
                          <td>{order.target_date}</td>
                          <td className="font-mono">{order.items.length} items</td>
                          <td><span className={order.status==='completed'?'status-ok':'status-low'}>{order.status}</span></td>
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

        {/* ══ WASTE ═════════════════════════════════════════════════ */}
        <TabsContent value="waste" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Total Waste Events"   value={wasteEntries.length}                   sub="last 30 days"           color="red"    icon={Trash2} />
            {isAdmin && <>
              <KpiCard label="Estimated Waste Cost" value={wasteCost!==null?fmt(wasteCost):'—'} sub="qty × item price · 30d" color="orange" icon={Download} />
              <KpiCard label="Projected Monthly"    value={wasteCost!==null?fmt(wasteCost):'—'} sub="based on current trend" color="amber"  icon={TrendingUp} />
            </>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-heading text-lg">Events — Last 14 Days</CardTitle>
                <ExportButtons type="waste" showPdf={false} />
              </CardHeader>
              <CardContent>
                {wasteBarData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wasteBarData} margin={{top:10,right:20,left:0,bottom:40}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{fontSize:11}} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{fontSize:12}} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Events" fill="#ef4444" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-64 flex items-center justify-center text-slate-400">No waste data</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Waste by Reason</CardTitle></CardHeader>
              <CardContent>
                {wastePieData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={wastePieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                          label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                          {wastePieData.map((_,i) => <Cell key={i} fill={WASTE_COLORS[i%WASTE_COLORS.length]} />)}
                        </Pie>
                        <Legend /><Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className="h-64 flex items-center justify-center text-slate-400">No waste data</div>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-lg">Waste Detail</CardTitle>
              <CardDescription>Last 30 days · {wasteEntries.length} events{multiUnit && ` · ${selectedUnitIds.length} units`}</CardDescription>
            </CardHeader>
            <CardContent>
              {wasteEntries.length === 0 ? <div className="py-12 text-center text-slate-400">No waste recorded</div> : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {multiUnit && <th>Unit</th>}
                        <th>Date</th><th>Item</th><th>Qty</th><th>Reason</th><th>Initials</th>
                        {isAdmin && <th>Est. Cost</th>}
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wasteEntries.map((entry, idx) => {
                        const price = entry.item_price || consumption.find(c=>c.item_id===entry.item_id)?.price || 0;
                        const cost = entry.estimated_cost || (entry.quantity * price);
                        return (
                          <tr key={`${entry.id}-${idx}`}>
                            {multiUnit && <td className="text-xs font-medium text-blue-700">{entry.unit_name}</td>}
                            <td className="text-slate-500 text-sm">{entry.date}</td>
                            <td className="font-medium">{entry.item_name}</td>
                            <td className="font-mono">{entry.quantity} {entry.unit_of_measure}</td>
                            <td><span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{entry.reason_name}</span></td>
                            <td className="font-mono text-center">{entry.initials}</td>
                            {isAdmin && <td className="font-mono text-orange-700">{price > 0 ? fmt(cost) : '—'}</td>}
                            <td className="text-slate-500 text-sm">{entry.notes||'—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};

export default ReportsPage;
