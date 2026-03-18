import { useState, useEffect, useRef } from 'react';
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
  Save,
  Settings2,
  Upload,
  Image,
  Lock,
  Key
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
  const { user, company, isAdmin, changePassword, updateCompany } = useAuth();
  const { units, currentUnit, createUnit, updateUnit, deleteUnit } = useUnit();
  const [safetyStock, setSafetyStock] = useState([]);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [savingSafety, setSavingSafety] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [deletingUnit, setDeletingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({ name: '', initials: '', address: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [companyForm, setCompanyForm] = useState({ name: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (currentUnit) {
      fetchSafetyStock();
    }
  }, [currentUnit]);

  useEffect(() => {
    if (company) {
      setCompanyForm({ name: company.name });
    }
  }, [company]);

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
      const configs = safetyStock.map(({ day_of_week, quantity_increment, enabled }) => ({
        day_of_week,
        quantity_increment,
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
      setUnitForm({ name: '', initials: '', address: '' });
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

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      await changePassword(passwordForm.current, passwordForm.new);
      toast.success('Password changed successfully');
      setPasswordDialogOpen(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    }
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`${API}/companies/${company.id}`, {
        name: companyForm.name,
        logo_url: company.logo_url
      });
      updateCompany(res.data);
      toast.success('Company updated successfully');
      setCompanyDialogOpen(false);
    } catch (err) {
      toast.error('Failed to update company');
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/companies/${company.id}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateCompany({ ...company, logo_url: res.data.logo_url });
      toast.success('Logo uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const openEditUnit = (unit) => {
    setEditingUnit(unit);
    setUnitForm({ name: unit.name, initials: unit.initials, address: unit.address });
    setUnitDialogOpen(true);
  };

  const openNewUnit = () => {
    setEditingUnit(null);
    setUnitForm({ name: '', initials: '', address: '' });
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
          {isAdmin ? 'Manage company, units, and configuration' : 'View settings and change password'}
        </p>
      </div>

      {/* Company Settings - Admin Only */}
      {isAdmin && (
        <Card data-testid="company-section">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company
            </CardTitle>
            <CardDescription>Company branding and information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {company?.logo_url ? (
                  <img 
                    src={company.logo_url.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${company.logo_url}` : company.logo_url}
                    alt="Company Logo"
                    className="h-20 w-20 object-contain border rounded-lg"
                  />
                ) : (
                  <div className="h-20 w-20 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Image className="h-8 w-8 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{company?.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Upload a logo to customize your company branding</p>
                <div className="flex gap-2 mt-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    data-testid="upload-logo-btn"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompanyDialogOpen(true)}
                    data-testid="edit-company-btn"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Name
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Units Management - Admin Only */}
      {isAdmin && (
        <Card data-testid="units-section">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Units
              </CardTitle>
              <CardDescription>Manage your kitchen locations</CardDescription>
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
                        <p className="font-medium text-slate-900">
                          {unit.name}
                          <span className="ml-2 text-sm text-slate-500">({unit.initials})</span>
                        </p>
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
      )}

      {/* Safety Stock Settings - Admin Only */}
      {isAdmin && currentUnit && (
        <Card data-testid="safety-stock-section">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Minimum Stock Adjustment by Day
              </CardTitle>
              <CardDescription>
                Add extra units to minimum stock for {currentUnit.name} on busy days
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
                  Set additional quantity to add to the base minimum stock for busier days.
                  Example: If an item has minimum stock of 10 and Friday increment is +5, the effective minimum for Friday orders will be 15.
                </p>
                <div className="grid gap-4">
                  {DAYS_OF_WEEK.map((day) => {
                    const config = safetyStock.find(c => c.day_of_week === day.value) || {
                      day_of_week: day.value,
                      quantity_increment: 0,
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
                          <span className="text-slate-500">+</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="w-20 text-right font-mono"
                            value={config.quantity_increment}
                            onChange={(e) =>
                              handleSafetyStockChange(day.value, 'quantity_increment', parseInt(e.target.value) || 0)
                            }
                            disabled={!config.enabled}
                            data-testid={`safety-input-${day.value}`}
                          />
                          <span className="text-slate-500 w-12">units</span>
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

      {/* View Only for Non-Admins */}
      {!isAdmin && currentUnit && (
        <Card data-testid="safety-stock-view">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Minimum Stock Adjustment by Day
              <Lock className="h-4 w-4 text-slate-400" />
            </CardTitle>
            <CardDescription>
              View-only: Contact an administrator to change these settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {DAYS_OF_WEEK.map((day) => {
                const config = safetyStock.find(c => c.day_of_week === day.value);
                return (
                  <div
                    key={day.value}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <span className={`font-medium ${!config?.enabled ? 'text-slate-400' : 'text-slate-900'}`}>
                      {day.label}
                    </span>
                    <span className="font-mono text-slate-600">
                      +{config?.quantity_increment || 0} units
                    </span>
                  </div>
                );
              })}
            </div>
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
              <div>
                <Label className="text-slate-500">Role</Label>
                <p className="font-medium">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
              </div>
              <div>
                <Label className="text-slate-500">Company</Label>
                <p className="font-medium">{company?.name}</p>
              </div>
            </div>
            <Separator />
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(true)}
              data-testid="change-password-btn"
            >
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </Button>
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
              <Label htmlFor="unit-initials">Initials (for Order ID)</Label>
              <Input
                id="unit-initials"
                data-testid="unit-initials-input"
                value={unitForm.initials}
                onChange={(e) => setUnitForm({ ...unitForm, initials: e.target.value.toUpperCase().slice(0, 3) })}
                placeholder="e.g., MK, U2"
                maxLength={3}
                required
              />
              <p className="text-xs text-slate-500">Used in order numbers: {unitForm.initials || 'XX'}-2026-001</p>
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

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent data-testid="password-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Change Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                data-testid="current-password-input"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                data-testid="new-password-input"
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                data-testid="confirm-password-input"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="password-submit-btn">
                Change Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent data-testid="company-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Company</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCompanySubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                data-testid="company-name-input"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCompanyDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="company-submit-btn">
                Save
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
