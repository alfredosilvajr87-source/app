import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const unitOptions = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'un', label: 'Unit (un)' },
  { value: 'cx', label: 'Box (cx)' },
  { value: 'l', label: 'Liter (l)' },
];

const ItemsPage = () => {
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    section_id: '',
    unit_of_measure: 'kg',
    minimum_stock: 0,
    average_consumption: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, sectionsRes] = await Promise.all([
        axios.get(`${API}/items`),
        axios.get(`${API}/sections`)
      ]);
      setItems(itemsRes.data);
      setSections(sectionsRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.put(`${API}/items/${editingItem.id}`, formData);
        toast.success('Item updated successfully');
      } else {
        await axios.post(`${API}/items`, formData);
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
    setFormData({
      name: item.name,
      section_id: item.section_id,
      unit_of_measure: item.unit_of_measure,
      minimum_stock: item.minimum_stock,
      average_consumption: item.average_consumption
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
      average_consumption: 0
    });
  };

  const openNewDialog = () => {
    setEditingItem(null);
    resetForm();
    setDialogOpen(true);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = filterSection === 'all' || item.section_id === filterSection;
    return matchesSearch && matchesSection;
  });

  // Group items by section
  const groupedItems = filteredItems.reduce((acc, item) => {
    const sectionName = item.section_name || 'Other';
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8" data-testid="items-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Items
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your inventory items
          </p>
        </div>
        <Button onClick={openNewDialog} data-testid="new-item-btn" disabled={sections.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          New Item
        </Button>
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
              {searchTerm || filterSection !== 'all' ? 'No Items Found' : 'No Items Yet'}
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || filterSection !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Add your first inventory item to get started'}
            </p>
            {!searchTerm && filterSection === 'all' && (
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
                <CardTitle className="font-heading text-lg">{sectionName}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Unit</th>
                        <th>Min Stock</th>
                        <th>Avg Consumption</th>
                        <th className="text-right">Actions</th>
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
                          <td className="font-mono">{item.average_consumption}</td>
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
        <DialogContent data-testid="item-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? 'Edit Item' : 'New Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update the item details below'
                : 'Add a new item to your inventory'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
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
                <Label>Section</Label>
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
                <Label>Unit of Measure</Label>
                <Select
                  value={formData.unit_of_measure}
                  onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}
                >
                  <SelectTrigger data-testid="item-unit-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimum_stock">Minimum Stock</Label>
                <Input
                  id="minimum_stock"
                  data-testid="item-min-stock-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="average_consumption">Avg Consumption</Label>
                <Input
                  id="average_consumption"
                  data-testid="item-avg-consumption-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.average_consumption}
                  onChange={(e) => setFormData({ ...formData, average_consumption: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <DialogFooter>
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
