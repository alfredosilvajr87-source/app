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
  Layers,
  Plus,
  Pencil,
  Trash2,
  Snowflake,
  Beef,
  Carrot,
  ShoppingBasket,
  Milk,
  Package
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const iconMap = {
  Snowflake: Snowflake,
  Beef: Beef,
  Carrot: Carrot,
  ShoppingBasket: ShoppingBasket,
  Milk: Milk,
  Package: Package,
};

const iconOptions = [
  { value: 'Snowflake', label: 'Freezer' },
  { value: 'Beef', label: 'Meats' },
  { value: 'Carrot', label: 'Produce' },
  { value: 'ShoppingBasket', label: 'Grocery' },
  { value: 'Milk', label: 'Dairy' },
  { value: 'Package', label: 'General' },
];

const SectionsPage = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [deletingSection, setDeletingSection] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', icon: 'Package' });

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const res = await axios.get(`${API}/sections`);
      setSections(res.data);
    } catch (err) {
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSection) {
        await axios.put(`${API}/sections/${editingSection.id}`, formData);
        toast.success('Section updated successfully');
      } else {
        await axios.post(`${API}/sections`, formData);
        toast.success('Section created successfully');
      }
      setDialogOpen(false);
      setEditingSection(null);
      setFormData({ name: '', description: '', icon: 'Package' });
      fetchSections();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (section) => {
    setEditingSection(section);
    setFormData({ name: section.name, description: section.description, icon: section.icon });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/sections/${deletingSection.id}`);
      toast.success('Section deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingSection(null);
      fetchSections();
    } catch (err) {
      toast.error('Failed to delete section');
    }
  };

  const openNewDialog = () => {
    setEditingSection(null);
    setFormData({ name: '', description: '', icon: 'Package' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8" data-testid="sections-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Sections
          </h1>
          <p className="text-slate-500 mt-1">
            Organize your inventory into categories
          </p>
        </div>
        <Button onClick={openNewDialog} data-testid="new-section-btn">
          <Plus className="h-4 w-4 mr-2" />
          New Section
        </Button>
      </div>

      {/* Sections Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-12 w-12 bg-slate-200 rounded-lg mb-4" />
                <div className="h-6 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Layers className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold text-slate-700 mb-2">
              No Sections Yet
            </h3>
            <p className="text-slate-500 mb-6">
              Create your first section to organize inventory items
            </p>
            <Button onClick={openNewDialog} data-testid="empty-new-section-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Section
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section, index) => {
            const IconComponent = iconMap[section.icon] || Package;
            return (
              <Card
                key={section.id}
                className="card-hover animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`section-card-${section.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <IconComponent className="h-6 w-6 text-slate-700" />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(section)}
                        data-testid={`edit-section-${section.id}`}
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingSection(section);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`delete-section-${section.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-slate-500" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-slate-900 mb-1">
                    {section.name}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {section.description || 'No description'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="section-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingSection ? 'Edit Section' : 'New Section'}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? 'Update the section details below'
                : 'Create a new category for your inventory items'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                data-testid="section-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Freezer, Meats, Produce"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                data-testid="section-description-input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger data-testid="section-icon-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((option) => {
                    const Icon = iconMap[option.value];
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="section-submit-btn">
                {editingSection ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-section-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSection?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-section"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SectionsPage;
