import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useUnit } from '../context/UnitContext';
import { API_URL as API } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  RefreshCw
} from 'lucide-react';

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    color: 'bg-slate-100 text-slate-600 border border-slate-200', emoji: '⏱' },
  done:       { label: 'Done',       color: 'bg-green-100 text-green-700 border border-green-200', emoji: '✓' },
  dont_need:  { label: "Don't Need", color: 'bg-blue-100 text-blue-700 border border-blue-200',   emoji: '✗' },
};

const NEXT_STATUS = { pending: 'done', done: 'dont_need', dont_need: 'pending' };

export default function DailyPrepPage() {
  const { user, isAdmin } = useAuth();
  const { currentUnit } = useUnit();
  const [items, setItems]         = useState([]);
  const [checks, setChecks]       = useState({});
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [updatingId, setUpdatingId]   = useState(null);

  const today = new Date().toLocaleDateString('en-IE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const fetchData = useCallback(async () => {
    if (!currentUnit) return;
    try {
      setLoading(true);
      const [itemsRes, checksRes] = await Promise.all([
        axios.get(`${API}/prep/items${currentUnit ? '?unit_id=' + currentUnit.id : ''}`),
        axios.get(`${API}/prep/today${currentUnit ? '?unit_id=' + currentUnit.id : ''}`),
      ]);
      setItems(itemsRes.data);
      // Transform checks array into a map: { item_id: check }
      const checksMap = {};
      checksRes.data.forEach(c => { checksMap[c.item_id] = c; });
      setChecks(checksMap);
    } catch {
      toast.error('Failed to load prep list');
    } finally {
      setLoading(false);
    }
  }, [currentUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/prep/history?days=7${currentUnit ? '&unit_id=' + currentUnit.id : ''}`);
      setHistory(res.data);
    } catch {
      toast.error('Failed to load history');
    }
  }, [currentUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData(); }, [fetchData]); // currentUnit handled in fetchData deps
  useEffect(() => { if (showHistory) fetchHistory(); }, [showHistory, fetchHistory]);

  const toggleStatus = async (item) => {
    const current = checks[item.id]?.status || 'pending';
    const next = NEXT_STATUS[current];
    setUpdatingId(item.id);
    try {
      await axios.put(`${API}/prep/today/${item.id}`, {
        status: next,
        done_by: user?.name || '',
        unit_id: currentUnit?.id || ''
      });
      setChecks(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], item_id: item.id, status: next, done_by: user?.name || '' }
      }));
    } catch {
      toast.error('Failed to update');
    } finally {
      setUpdatingId(null);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      const res = await axios.post(`${API}/prep/items`, { name: newItemName.trim(), unit_id: currentUnit?.id || '' });
      setItems(prev => [...prev, res.data]);
      setNewItemName('');
      setShowAddForm(false);
      toast.success('Item added!');
    } catch {
      toast.error('Failed to add item');
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm('Remove this item from the prep list?')) return;
    try {
      await axios.delete(`${API}/prep/items/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  // Stats for today
  const done      = items.filter(i => checks[i.id]?.status === 'done').length;
  const dontNeed  = items.filter(i => checks[i.id]?.status === 'dont_need').length;
  const pending   = items.length - done - dontNeed;
  const progress  = items.length > 0 ? Math.round(((done + dontNeed) / items.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Daily Prep
          </h1>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowAddForm(v => !v)}
              className="bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Today's progress</span>
            <span className="text-sm font-bold text-slate-900">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-700 font-medium">
              <CheckCircle2 className="h-4 w-4" /> {done} Done
            </span>
            <span className="flex items-center gap-1 text-blue-700 font-medium">
              <XCircle className="h-4 w-4" /> {dontNeed} Don't Need
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="h-4 w-4" /> {pending} Pending
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Add Item Form */}
      {isAdmin && showAddForm && (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="pt-4">
            <form onSubmit={addItem} className="flex gap-2">
              <Input
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="New prep item name..."
                className="flex-1"
                autoFocus
              />
              <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                Add
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Prep List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prep Items — tap to change status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const status = checks[item.id]?.status || 'pending';
              const doneBy = checks[item.id]?.done_by;
              const cfg    = STATUS_CONFIG[status];
              const Icon   = cfg.icon;
              const isUpdating = updatingId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleStatus(item)}
                      disabled={isUpdating}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${cfg.color} ${isUpdating ? 'opacity-50' : 'hover:opacity-80 cursor-pointer'}`}
                    >{cfg?.emoji}
                      {cfg.label}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${status !== 'pending' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {item.name}
                      </p>
                      {doneBy && status !== 'pending' && (
                        <p className="text-xs text-slate-400">{doneBy}</p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="ml-2 p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No prep items yet.</p>
                {isAdmin && <p className="text-sm mt-1">Click "Add Item" to get started.</p>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setShowHistory(v => !v)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> History (last 7 days)
            </CardTitle>
            {showHistory ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent className="p-0">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No history yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map(day => (
                  <div key={day.date} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {new Date(day.date + 'T12:00:00').toLocaleDateString('en-IE', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                      </span>
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-700 font-medium">✅ {day.done} done</span>
                        <span className="text-blue-700 font-medium">🔵 {day.dont_need} don't need</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {day.checks.map(c => (
                        <Badge
                          key={c.item_id}
                          variant="outline"
                          className={`text-xs ${
                            c.status === 'done'      ? 'bg-green-50 text-green-700 border-green-200' :
                            c.status === 'dont_need' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {items.find(i => i.id === c.item_id)?.name || c.item_id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
