import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Users, Plus, Pencil, Trash2, Shield, User, Building2, Globe } from 'lucide-react';
import { API_URL as API } from '../config';

const UsersPage = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers]               = useState([]);
  const [units, setUnits]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser]   = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [formData, setFormData]         = useState({
    name: '', email: '', password: '', role: 'user', unit_ids: []
  });

  useEffect(() => {
    fetchUsers();
    fetchAllUnits();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  // Fetch units using admin endpoint (all units of the company)
  const fetchAllUnits = async () => {
    try {
      const res = await axios.get(`${API}/units`);
      setUnits(res.data);
    } catch { console.error('Failed to load units'); }
  };

  const toggleUnit = (unitId) => {
    setFormData(prev => ({
      ...prev,
      unit_ids: prev.unit_ids.includes(unitId)
        ? prev.unit_ids.filter(id => id !== unitId)
        : [...prev.unit_ids, unitId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, {
          name:     formData.name,
          role:     formData.role,
          unit_ids: formData.unit_ids,
        });
        toast.success('User updated successfully');
      } else {
        await axios.post(`${API}/users`, {
          name:     formData.name,
          email:    formData.email,
          password: formData.password,
          role:     formData.role,
          unit_ids: formData.unit_ids,
        });
        toast.success('User created successfully');
      }
      setDialogOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'user', unit_ids: [] });
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d.msg).join(', ')
        : 'Operation failed';
      toast.error(msg);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name:     user.name,
      email:    user.email,
      password: '',
      role:     user.role,
      unit_ids: user.unit_ids || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/users/${deletingUser.id}`);
      toast.success('User deleted');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete user');
    }
  };

  const openNewDialog = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'user', unit_ids: [] });
    setDialogOpen(true);
  };

  // Label showing which units a user can access
  const unitAccessLabel = (user) => {
    if (user.role === 'admin') return null; // admins always see all
    const ids = user.unit_ids || [];
    if (ids.length === 0) return { label: 'All units', icon: Globe, color: 'text-emerald-600 bg-emerald-50' };
    const names = ids.map(id => units.find(u => u.id === id)?.name || id);
    return { label: names.join(', '), icon: Building2, color: 'text-blue-600 bg-blue-50' };
  };

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <Shield className="h-12 w-12 text-slate-300 mb-4" />
      <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-slate-500">Only administrators can manage users</p>
    </div>
  );

  return (
    <div className="space-y-8" data-testid="users-page">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-slate-500 mt-1">Manage accounts, roles and unit access</p>
        </div>
        <Button onClick={openNewDialog} data-testid="new-user-btn">
          <Plus className="h-4 w-4 mr-2" />Add User
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Admins</p>
            <p className="font-heading text-2xl font-bold text-blue-900 mt-1">
              {users.filter(u => u.role === 'admin').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</p>
            <p className="font-heading text-2xl font-bold text-slate-900 mt-1">
              {users.filter(u => u.role === 'user').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Units</p>
            <p className="font-heading text-2xl font-bold text-emerald-900 mt-1">{units.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">All Users</CardTitle>
          <CardDescription>Click the edit icon to change role or unit access</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900 mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Unit Access</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const access = unitAccessLabel(user);
                    const AccessIcon = access?.icon;
                    return (
                      <tr key={user.id} data-testid={`user-row-${user.id}`}>
                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-full ${user.role === 'admin' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                              {user.role === 'admin'
                                ? <Shield className="h-4 w-4 text-blue-600" />
                                : <User className="h-4 w-4 text-slate-600" />}
                            </div>
                            {user.name}
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-slate-400">(you)</span>
                            )}
                          </div>
                        </td>
                        <td className="text-slate-500">{user.email}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {user.role === 'admin' ? 'Administrator' : 'User'}
                          </span>
                        </td>
                        <td>
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Globe className="h-3 w-3" /> All (admin)
                            </span>
                          ) : access ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${access.color}`}>
                              <AccessIcon className="h-3 w-3" />
                              {access.label}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-slate-500 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                              <Pencil className="h-4 w-4 text-slate-500" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button variant="ghost" size="icon" onClick={() => { setDeletingUser(user); setDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4 text-slate-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="user-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingUser ? 'Edit User' : 'New User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user details and unit access' : 'Add a new user to your company'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input id="user-name" value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name" required />
            </div>

            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input id="user-email" type="email" value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@company.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password">Password</Label>
                  <Input id="user-password" type="password" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 6 characters" required minLength={6} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (View & Edit Data)</SelectItem>
                  <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Unit access — only relevant for role=user */}
            {formData.role === 'user' && units.length > 0 && (
              <div className="space-y-2">
                <Label>Unit Access</Label>
                <p className="text-xs text-slate-500">
                  Leave all unchecked to give access to all units. Check specific units to restrict access.
                </p>
                <div className="grid grid-cols-1 gap-2 mt-2 max-h-40 overflow-y-auto pr-1">
                  {units.map(unit => {
                    const checked = formData.unit_ids.includes(unit.id);
                    return (
                      <button
                        type="button"
                        key={unit.id}
                        onClick={() => toggleUnit(unit.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                          checked
                            ? 'bg-blue-50 border-blue-300 text-blue-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                          checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                        }`}>
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{unit.name}</p>
                          {unit.address && <p className="text-xs text-slate-400">{unit.address}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {formData.unit_ids.length === 0 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3" /> Access to all units
                  </p>
                )}
                {formData.unit_ids.length > 0 && (
                  <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                    <Building2 className="h-3 w-3" /> Restricted to {formData.unit_ids.length} unit(s)
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingUser ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingUser?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
