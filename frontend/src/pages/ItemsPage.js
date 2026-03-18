import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUnit } from '../context/UnitContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  Factory,
  Store,
  Eye,
  EyeOff
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const ITEM_TYPES = [
  { value: 'all', label: 'All (Restaurant & Factory)', icon: null },
  { value: 'restaurant', label: 'Restaurant Only', icon: Store },
  { value: 'factory', label: 'Factory Only', icon: Factory },
];

const ItemsPage = () => {
  const { isAdmin } = useAuth();
  const { units } = useUnit();
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [unitsOfMeasure, setUnitsOfMeasure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    section_id: '',
    unit_of_measure: 'kg',
    minimum_stock: 0,
    minimum_stock_by_day: {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0
    },
    use_daily_minimum: false,
    average_consumption: 0,
    item_type: 'all',
    visible_in_units: [],
    show_in_reports: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, sectionsRes, unitsRes] = await Promise.all([
        axios.get(`${API}/items`),
        axios.get(`${API}/sections`),
        axios.get(`${API}/units-of-measure`)
      ]);
      setItems(itemsRes.data);
      setSections(sectionsRes.data);
      setUnitsOfMeasure(unitsRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        section_id: formData.section_id,
        unit_of_measure: formData.unit_of_measure,
        minimum_stock: formData.minimum_stock,
        minimum_stock_by_day: formData.use_daily_minimum ? formData.minimum_stock_by_day : null,
        average_consumption: formData.average_consumption,
        item_type: formData.item_type,
        visible_in_units: formData.visible_in_units,
        show_in_reports: formData.show_in_reports
      };

      if (editingItem) {
        await axios.put(`${API}/items/${editingItem.id}`, payload);
        toast.success('Item updated successfully');
      } else {
        await axios.post(`${API}/items`, payload);
        toast.success('Item created successfully');
      }
      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const hasDailyMinimum = item.minimum_stock_by_day && Object.values(item.minimum_stock_by_day).some(v => v > 0);
    setFormData({
      name: item.name,
      section_id: item.section_id,
      unit_of_measure: item.unit_of_measure,
      minimum_stock: item.minimum_stock,
      minimum_stock_by_day: item.minimum_stock_by_day || {
        monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0
      },
      use_daily_minimum: hasDailyMinimum,
      average_consumption: item.average_consumption,
      item_type: item.item_type || 'all',
      visible_in_units: item.visible_in_units || [],
      show_in_reports: item.show_in_reports !== false
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/items/${deletingItem.id}`);
      toast.success('Item deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      section_id: sections[0]?.id || '',
      unit_of_measure: 'kg',
      minimum_stock: 0,
      minimum_stock_by_day: {
        monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0
      },
      use_daily_minimum: false,
      average_consumption: 0,
      item_type: 'all',
      visible_in_units: [],
      show_in_reports: true
    });
  };

  const openNewDialog = () => {
    setEditingItem(null);
    resetForm();
    setDialogOpen(true);
  };

  const toggleUnitVisibility = (unitId) => {
    setFormData(prev => {
      const current = prev.visible_in_units || [];
      if (current.includes(unitId)) {
        return { ...prev, visible_in_units: current.filter(id => id !== unitId) };
      } else {
        return { ...prev, visible_in_units: [...current, unitId] };
      }
    });
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = filterSection === 'all' || item.section_id === filterSection;
    const matchesType = filterType === 'all' || item.item_type === filterType;
    return matchesSearch && matchesSection && matchesType;
  });

  // Group items by section
  const groupedItems = filteredItems.reduce((acc, item) => {
    const sectionName = item.section_name || 'Other';
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {});

  const getItemTypeIcon = (type) => {
    if (type === 'factory') return <Factory className="h-3 w-3 text-amber-600" />;
    if (type === 'restaurant') return <Store className="h-3 w-3 text-blue-600" />;
    return null;
  };

  return (
    <div className="space-y-8" data-testid="items-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Items
          </h1>
          <p className="text-slate-500 mt-1">
            {items.length} items registered
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNewDialog} data-testid="new-item-btn" disabled={sections.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            New Item
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search items..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="item-search"
              />
            </div>
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger className="w-full sm:w-48" data-testid="section-filter">
                <Filter className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40" data-testid="type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="factory">Factory</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold text-slate-700 mb-2">
              Create Sections First
            </h3>
            <p className="text-slate-500 mb-6">
              You need to create at least one section before adding items
            </p>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold text-slate-700 mb-2">
              {searchTerm || filterSection !== 'all' || filterType !== 'all' ? 'No Items Found' : 'No Items Yet'}
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || filterSection !== 'all' || filterType !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Add your first inventory item to get started'}
            </p>
            {!searchTerm && filterSection === 'all' && isAdmin && (
              <Button onClick={openNewDialog} data-testid="empty-new-item-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([sectionName, sectionItems]) => (
            <Card key={sectionName} data-testid={`section-group-${sectionName}`}>
              <CardHeader className="py-4">
                <CardTitle className="font-heading text-lg">{sectionName} ({sectionItems.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Unit</th>
                        <th>Min Stock</th>
                        <th>Type</th>
                        <th>Reports</th>
                        {isAdmin && <th className="text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sectionItems.map((item) => (
                        <tr key={item.id} data-testid={`item-row-${item.id}`}>
                          <td className="font-medium">{item.name}</td>
                          <td>
                            <span className="px-2 py-1 bg-slate-100 rounded text-sm font-mono">
                              {item.unit_of_measure}
                            </span>
                          </td>
                          <td className="font-mono">{item.minimum_stock}</td>
                          <td>
                            <div className="flex items-center gap-1">
                              {getItemTypeIcon(item.item_type)}
                              <span className="text-xs text-slate-500 capitalize">
                                {item.item_type === 'all' ? '-' : item.item_type}
                              </span>
                            </div>
                          </td>
                          <td>
                            {item.show_in_reports !== false ? (
                              <Eye className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-slate-300" />
                            )}
                          </td>
                          {isAdmin && (
                            <td className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(item)}
                                  data-testid={`edit-item-${item.id}`}
                                >
                                  <Pencil className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setDeletingItem(item);
                                    setDeleteDialogOpen(true);
                                  }}
                                  data-testid={`delete-item-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-slate-500" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="item-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? 'Edit Item' : 'New Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the item details below' : 'Add a new item to your inventory'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="stock">Min Stock</TabsTrigger>
                <TabsTrigger value="visibility">Visibility</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    data-testid="item-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Chicken Breast, Tomatoes"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Section *</Label>
                    <Select
                      value={formData.section_id}
                      onValueChange={(value) => setFormData({ ...formData, section_id: value })}
                      required
                    >
                      <SelectTrigger data-testid="item-section-select">
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Unit of Measure *</Label>
                    <Select
                      value={formData.unit_of_measure}
                      onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}
                    >
                      <SelectTrigger data-testid="item-unit-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitsOfMeasure.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Item Type</Label>
                  <Select
                    value={formData.item_type}
                    onValueChange={(value) => setFormData({ ...formData, item_type: value })}
                  >
                    <SelectTrigger data-testid="item-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            {type.icon && <type.icon className="h-4 w-4" />}
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Factory items are for production only (e.g., sauces for Napoli)
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="stock" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="minimum_stock">Base Minimum Stock</Label>
                  <Input
                    id="minimum_stock"
                    data-testid="item-min-stock-input"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label>Use different minimum per day</Label>
                    <p className="text-xs text-slate-500">Set specific minimums for each day of the week</p>
                  </div>
                  <Switch
                    checked={formData.use_daily_minimum}
                    onCheckedChange={(checked) => setFormData({ ...formData, use_daily_minimum: checked })}
                    data-testid="use-daily-minimum-switch"
                  />
                </div>

                {formData.use_daily_minimum && (
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.key} className="space-y-1">
                        <Label className="text-xs text-center block">{day.label}</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          className="text-center text-sm"
                          value={formData.minimum_stock_by_day[day.key]}
                          onChange={(e) => setFormData({
                            ...formData,
                            minimum_stock_by_day: {
                              ...formData.minimum_stock_by_day,
                              [day.key]: parseInt(e.target.value) || 0
                            }
                          })}
                          data-testid={`min-stock-${day.key}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="average_consumption">Avg Daily Consumption</Label>
                  <Input
                    id="average_consumption"
                    data-testid="item-avg-consumption-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.average_consumption}
                    onChange={(e) => setFormData({ ...formData, average_consumption: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-slate-500">This is auto-calculated from daily entries</p>
                </div>
              </TabsContent>

              <TabsContent value="visibility" className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label>Show in Reports</Label>
                    <p className="text-xs text-slate-500">Include this item in stock and consumption reports</p>
                  </div>
                  <Switch
                    checked={formData.show_in_reports}
                    onCheckedChange={(checked) => setFormData({ ...formData, show_in_reports: checked })}
                    data-testid="show-in-reports-switch"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Visible in Units</Label>
                  <p className="text-xs text-slate-500 mb-2">
                    Leave all unchecked to show in ALL units, or select specific units
                  </p>
                  {units.length === 0 ? (
                    <p className="text-sm text-slate-400">No units created yet</p>
                  ) : (
                    <div className="space-y-2">
                      {units.map((unit) => (
                        <div key={unit.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`unit-${unit.id}`}
                            checked={formData.visible_in_units.includes(unit.id)}
                            onCheckedChange={() => toggleUnitVisibility(unit.id)}
                          />
                          <label
                            htmlFor={`unit-${unit.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {unit.name} ({unit.initials})
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.visible_in_units.length > 0 && (
                    <p className="text-xs text-amber-600">
                      This item will only appear in {formData.visible_in_units.length} selected unit(s)
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="item-submit-btn">
                {editingItem ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-item-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-item"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ItemsPage;
