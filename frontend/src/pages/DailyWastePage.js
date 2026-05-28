import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useUnit } from '../context/UnitContext';
import { API_URL as API } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Trash2,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  User,
  Package,
  Settings
} from 'lucide-react';

export default function DailyWastePage() {
  const { isAdmin, user } = useAuth();
  const { currentUnit } = useUnit();
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [daysFilter, setDaysFilter] = useState(7);

  const [form, setForm] = useState({
    item_id: '', item_name: '', quantity: '', unit_of_measure: 'un',
    reason_id: '', reason_name: '', notes: '', initials: ''
  });

  const fetchData = useCallback(async () => {
    if (!currentUnit) return; // never fetch without unit — would return all-company data
    setLoading(true);
    try {
      const [entriesRes, itemsRes, reasonsRes] = await Promise.all([
        axios.get(`${API}/waste/entries?days=${daysFilter}&unit_id=${currentUnit.id}`),
        axios.get(`${API}/items?unit_id=${currentUnit.id}`),
        axios.get(`${API}/waste/reasons`),
      ]);
      setEntries(entriesRes.data);
      setItems((itemsRes.data || []).filter(i => i.show_in_waste !== false));
      setReasons(reasonsRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
    }, [daysFilter, currentUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleItemSelect = (e) => {
    const item = items.find(i => i.id === e.target.value);
    if (item) setForm(f => ({ ...f, item_id: item.id, item_name: item.name, unit_of_measure: item.unit_of_measure }));
    else setForm(f => ({ ...f, item_id: '', item_name: '' }));
  };

  const handleReasonSelect = (e) => {
    const reason = reasons.find(r => r.id === e.target.value);
    if (reason) setForm(f => ({ ...f, reason_id: reason.id, reason_name: reason.name }));
    else setForm(f => ({ ...f, reason_id: '', reason_name: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_id || !form.reason_id || !form.quantity) {
      toast.error('Please fill in item, reason and quantity');
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/waste/entries`, { ...form, quantity: parseFloat(form.quantity), unit_id: currentUnit?.id || '' });
      toast.success('Waste entry recorded!');
      setForm({ item_id: '', item_name: '', quantity: '', unit_of_measure: 'un', reason_id: '', reason_name: '', notes: '', initials: '' });
      setShowForm(false);
      fetchData();
    } catch {
      toast.error('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this waste entry?')) return;
    try {
      await axios.delete(`${API}/waste/entries/${id}`);
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const addReason = async (e) => {
    e.preventDefault();
    if (!newReason.trim()) return;
    try {
      const res = await axios.post(`${API}/waste/reasons`, { name: newReason.trim() });
      setReasons(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewReason('');
      toast.success('Reason added');
    } catch { toast.error('Failed to add reason'); }
  };

  const deleteReason = async (id) => {
    try {
      await axios.delete(`${API}/waste/reasons/${id}`);
      setReasons(prev => prev.filter(r => r.id !== id));
      toast.success('Reason deleted');
    } catch { toast.error('Failed to delete reason'); }
  };

  // Group entries by date
  const groupedByDate = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const totalByDate = (dateEntries) => dateEntries.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-xl">⚠</span>
            Daily Waste
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track and record food waste</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowReasons(v => !v)}>
              <Settings className="h-4 w-4 mr-1" /> Reasons
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(v => !v)}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="h-4 w-4 mr-1" /> Record Waste
          </Button>
        </div>
      </div>

      {/* Manage Reasons (admin only) */}
      {isAdmin && showReasons && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" /> Waste Reasons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {reasons.map(r => (
                <div key={r.id} className="flex items-center gap-1 bg-slate-100 rounded-full px-3 py-1">
                  <span className="text-sm">{r.name}</span>
                  <button onClick={() => deleteReason(r.id)} className="text-slate-400 hover:text-red-500 ml-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={addReason} className="flex gap-2">
              <Input value={newReason} onChange={e => setNewReason(e.target.value)}
                placeholder="New reason..." className="flex-1" />
              <Button type="submit" size="sm">Add</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Record Waste Form */}
      {showForm && (
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Waste Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item */}
                <div className="space-y-1.5">
                  <Label>Item *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                    value={form.item_id}
                    onChange={handleItemSelect}
                    required
                  >
                    <option value="">Select item...</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label>Reason *</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                    value={form.reason_id}
                    onChange={handleReasonSelect}
                    required
                  >
                    <option value="">Select reason...</option>
                    {reasons.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label>Quantity *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number" step="0.01" min="0"
                      placeholder="0"
                      value={form.quantity}
                      onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      className="flex-1"
                      required
                    />
                    <Input
                      placeholder="unit"
                      value={form.unit_of_measure}
                      onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))}
                      className="w-20"
                    />
                  </div>
                </div>

                {/* Initials */}
                <div className="space-y-1.5">
                  <Label>Initials</Label>
                  <Input
                    placeholder="Your initials..."
                    value={form.initials}
                    onChange={e => setForm(f => ({ ...f, initials: e.target.value }))}
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes / Observations</Label>
                <Input
                  placeholder="Additional details about this waste..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                  {saving ? 'Saving...' : 'Record Waste'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Show last:</span>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDaysFilter(d)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${daysFilter === d ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
            {d} days
          </button>
        ))}
        <span className="text-sm text-slate-400 ml-2">{entries.length} entries</span>
      </div>

      {/* Entries grouped by date */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="text-xl">⚠</span>
            <p className="text-slate-500">No waste entries in the last {daysFilter} days.</p>
            <p className="text-sm text-slate-400 mt-1">Click "Record Waste" to add one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dateEntries]) => (
              <WasteDayCard
                key={date}
                date={date}
                entries={dateEntries}
                total={totalByDate(dateEntries)}
                isAdmin={isAdmin}
                onDelete={handleDelete}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function WasteDayCard({ date, entries, total, isAdmin, onDelete }) {
  const [expanded, setExpanded] = useState(true);
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-IE', {
    weekday: 'long', month: 'short', day: 'numeric'
  });

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>📅</span>
            <span className="font-semibold">{formatted}</span>
            <Badge variant="outline" className="text-xs">{total} items</Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <div className="col-span-3">Item</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Reason</div>
              <div className="col-span-3">Notes</div>
              <div className="col-span-1">By</div>
              <div className="col-span-1"></div>
            </div>
            {entries.map(entry => (
              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-3">
                  <p className="text-sm font-medium truncate">{entry.item_name}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-sm font-mono text-amber-600 font-semibold">
                    {entry.quantity} {entry.unit_of_measure}
                  </span>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                    {entry.reason_name}
                  </Badge>
                </div>
                <div className="col-span-3">
                  <p className="text-xs text-slate-500 truncate">{entry.notes || '—'}</p>
                </div>
                <div className="col-span-1">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-500">{entry.initials || entry.recorded_by?.split(' ')[0] || '—'}</span>
                  </div>
                </div>
                <div className="col-span-1 flex justify-end">
                  {isAdmin && (
                    <button onClick={() => onDelete(entry.id)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
