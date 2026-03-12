import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUnit } from '../context/UnitContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Percent,
  Save,
  Settings2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const { units, currentUnit, createUnit, updateUnit, deleteUnit, refreshUnits } = useUnit();
  const [safetyStock, setSafetyStock] = useState([]);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [savingSafety, setSavingSafety] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [deletingUnit, setDeletingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({ name: '', address: '' });

  useEffect(() => {
    if (currentUnit) {
      fetchSafetyStock();
    }
  }, [currentUnit]);

  const fetchSafetyStock = async () => {
    setLoadingSafety(true);
    try {
      const res = await axios.get(`${API}/safety-stock/${currentUnit.id}`);
      setSafetyStock(res.data);
    } catch (err) {
      console.error('Failed to fetch safety stock:', err);
    } finally {
      setLoadingSafety(false);
    }
  };

  const handleSafetyStockChange = (dayOfWeek, field, value) => {
    setSafetyStock(prev => prev.map(config => {
      if (config.day_of_week === dayOfWeek) {
        return { ...config, [field]: value };
      }
      return config;
    }));
  };

  const saveSafetyStock = async () => {
    setSavingSafety(true);
    try {
      const configs = safetyStock.map(({ day_of_week, percentage, enabled }) => ({
        day_of_week,
        percentage,
        enabled
      }));
      await axios.put(`${API}/safety-stock/${currentUnit.id}`, configs);
      toast.success('Safety stock settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSavingSafety(false);
    }
  };

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, unitForm);
        toast.success('Unit updated successfully');
      } else {
        await createUnit(unitForm);
        toast.success('Unit created successfully');
      }
      setUnitDialogOpen(false);
      setEditingUnit(null);
      setUnitForm({ name: '', address: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDeleteUnit = async () => {
    try {
      await deleteUnit(deletingUnit.id);
      toast.success('Unit deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingUnit(null);
    } catch (err) {
      toast.error('Failed to delete unit');
    }
  };

  const openEditUnit = (unit) => {
    setEditingUnit(unit);
    setUnitForm({ name: unit.name, address: unit.address });
    setUnitDialogOpen(true);
  };

  const openNewUnit = () => {
    setEditingUnit(null);
    setUnitForm({ name: '', address: '' });
    setUnitDialogOpen(true);
  };

  return (
    <div className="space-y-8" data-testid="settings-page">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="text-slate-500 mt-1">
          Manage units and safety stock configuration
        </p>
      </div>

      {/* Units Management */}
      <Card data-testid="units-section">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Units
            </CardTitle>
            <CardDescription>
              Manage your kitchen locations
            </CardDescription>
          </div>
          <Button onClick={openNewUnit} data-testid="new-unit-btn">
            <Plus className="h-4 w-4 mr-2" />
            Add Unit
          </Button>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">No units created yet</p>
              <Button onClick={openNewUnit} variant="outline">
                Create Your First Unit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {units.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                  data-testid={`unit-row-${unit.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Building2 className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{unit.name}</p>
                      <p className="text-sm text-slate-500">{unit.address || 'No address'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditUnit(unit)}
                      data-testid={`edit-unit-${unit.id}`}
                    >
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingUnit(unit);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`delete-unit-${unit.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-slate-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Stock Settings */}
      {currentUnit && (
        <Card data-testid="safety-stock-section">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Safety Stock by Day
              </CardTitle>
              <CardDescription>
                Configure additional stock percentage for {currentUnit.name}
              </CardDescription>
            </div>
            <Button
              onClick={saveSafetyStock}
              disabled={savingSafety || loadingSafety}
              data-testid="save-safety-stock-btn"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingSafety ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingSafety ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 pb-4">
                  Set additional percentage of stock to maintain for busier days.
                  The system will add this percentage to the average consumption when calculating orders.
                </p>
                <div className="grid gap-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const config = safetyStock.find(c => c.day_of_week === day.value) || {
                      day_of_week: day.value,
                      percentage: 10,
                      enabled: true
                    };
                    
                    return (
                      <div
                        key={day.value}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                        data-testid={`safety-day-${day.value}`}
                      >
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked) =>
                              handleSafetyStockChange(day.value, 'enabled', checked)
                            }
                            data-testid={`safety-switch-${day.value}`}
                          />
                          <span className={`font-medium ${!config.enabled ? 'text-slate-400' : 'text-slate-900'}`}>
                            {day.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="w-20 text-right font-mono"
                            value={config.percentage}
                            onChange={(e) =>
                              handleSafetyStockChange(day.value, 'percentage', parseFloat(e.target.value) || 0)
                            }
                            disabled={!config.enabled}
                            data-testid={`safety-input-${day.value}`}
                          />
                          <Percent className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Info */}
      <Card data-testid="account-section">
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500">Name</Label>
                <p className="font-medium">{user?.name}</p>
              </div>
              <div>
                <Label className="text-slate-500">Email</Label>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent data-testid="unit-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingUnit ? 'Edit Unit' : 'New Unit'}
            </DialogTitle>
            <DialogDescription>
              {editingUnit ? 'Update unit details' : 'Create a new kitchen location'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUnitSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Name</Label>
              <Input
                id="unit-name"
                data-testid="unit-name-input"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                placeholder="e.g., Main Kitchen, Unit 2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-address">Address</Label>
              <Input
                id="unit-address"
                data-testid="unit-address-input"
                value={unitForm.address}
                onChange={(e) => setUnitForm({ ...unitForm, address: e.target.value })}
                placeholder="Optional address"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="unit-submit-btn">
                {editingUnit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingUnit?.name}"? This will also remove all stock entries and orders associated with this unit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-unit"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
