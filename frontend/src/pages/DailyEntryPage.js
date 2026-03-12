import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ClipboardList, Save, CheckCircle2, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DailyEntryPage = () => {
  const { currentUnit } = useUnit();
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    if (currentUnit) {
      fetchData();
    }
  }, [currentUnit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, entriesRes] = await Promise.all([
        axios.get(`${API}/items`),
        axios.get(`${API}/stock-entries/${currentUnit.id}/latest`)
      ]);
      
      setItems(itemsRes.data);
      
      // Build entries map from latest entries
      const entriesMap = {};
      entriesRes.data.forEach(entry => {
        entriesMap[entry.item_id] = entry.quantity;
      });
      setEntries(entriesMap);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEntryChange = (itemId, value) => {
    setEntries(prev => ({
      ...prev,
      [itemId]: value === '' ? '' : parseFloat(value) || 0
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entriesToSave = Object.entries(entries)
        .filter(([_, quantity]) => quantity !== '' && quantity !== undefined)
        .map(([item_id, quantity]) => ({
          item_id,
          quantity: parseFloat(quantity),
          unit_id: currentUnit.id
        }));

      if (entriesToSave.length === 0) {
        toast.warning('No entries to save');
        setSaving(false);
        return;
      }

      await axios.post(`${API}/stock-entries`, entriesToSave);
      setLastSaved(new Date());
      toast.success(`${entriesToSave.length} entries saved successfully`);
    } catch (err) {
      toast.error('Failed to save entries');
    } finally {
      setSaving(false);
    }
  };

  // Group items by section
  const groupedItems = items.reduce((acc, item) => {
    const sectionName = item.section_name || 'Other';
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {});

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (!currentUnit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">No Unit Selected</h2>
        <p className="text-slate-500">Please select a unit to enter daily stock</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="daily-entry-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Daily Stock Entry
          </h1>
          <p className="text-slate-500 mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Saved at {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            data-testid="save-entries-btn"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Night Stock Count</p>
              <p className="text-sm text-blue-700 mt-1">
                Enter the current quantity for each item. The system will automatically calculate consumption
                and update average values.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entry Forms by Section */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-slate-200 rounded w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-12 bg-slate-100 rounded" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold text-slate-700 mb-2">
              No Items to Count
            </h3>
            <p className="text-slate-500">
              Add items to your inventory first to start daily stock entries
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([sectionName, sectionItems]) => (
            <Card key={sectionName} data-testid={`entry-section-${sectionName}`}>
              <CardHeader>
                <CardTitle className="font-heading text-lg">{sectionName}</CardTitle>
                <CardDescription>{sectionItems.length} items</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg"
                      data-testid={`entry-item-${item.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          Min: {item.minimum_stock} {item.unit_of_measure}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 text-right font-mono"
                          value={entries[item.id] ?? ''}
                          onChange={(e) => handleEntryChange(item.id, e.target.value)}
                          placeholder="0"
                          data-testid={`entry-input-${item.id}`}
                        />
                        <span className="text-sm text-slate-500 w-8">
                          {item.unit_of_measure}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Floating Save Button for Mobile */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saving || loading}
          className="shadow-lg"
          data-testid="floating-save-btn"
        >
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default DailyEntryPage;
