import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
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
import { Users, Plus, Pencil, Trash2, Shield, User } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const UsersPage = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, {
          name: formData.name,
          role: formData.role
        });
        toast.success('User updated successfully');
      } else {
        await axios.post(`${API}/users`, formData);
        toast.success('User created successfully');
      }
      setDialogOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/users/${deletingUser.id}`);
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    }
  };

  const openNewDialog = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'user' });
    setDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">Only administrators can manage users</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="users-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            User Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <Button onClick={openNewDialog} data-testid="new-user-btn">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Users List */}
      <Card>
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
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} data-testid={`user-row-${user.id}`}>
                      <td className="font-medium flex items-center gap-2">
                        <div className={`p-1.5 rounded-full ${user.role === 'admin' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                          {user.role === 'admin' ? (
                            <Shield className="h-4 w-4 text-blue-600" />
                          ) : (
                            <User className="h-4 w-4 text-slate-600" />
                          )}
                        </div>
                        {user.name}
                      </td>
                      <td className="text-slate-500">{user.email}</td>
                      <td>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {user.role === 'admin' ? 'Administrator' : 'User'}
                        </span>
                      </td>
                      <td className="text-slate-500 text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                            data-testid={`edit-user-${user.id}`}
                          >
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          {user.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingUser(user);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`delete-user-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
            <DialogTitle className="font-heading">
              {editingUser ? 'Edit User' : 'New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user details' : 'Add a new user to your company'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                data-testid="user-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                required
              />
            </div>

            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    data-testid="user-email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@company.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-password">Password</Label>
                  <Input
                    id="user-password"
                    data-testid="user-password-input"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="user-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (View & Edit Data)</SelectItem>
                  <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="user-submit-btn">
                {editingUser ? 'Update' : 'Create'}
              </Button>
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-user"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
