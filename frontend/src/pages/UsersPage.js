import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Users, Plus, Pencil, Trash2, Shield, User } from 'lucide-react';
import { SELECT_CLASS } from '../components/store/ItemLines';
import { apiError, commissionLabel } from '../lib/store';

import { API_URL as API } from '../config';

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'user', commission_type: 'fixed', commission_value: '5',
};

const UsersPage = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const { money } = useStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar usuários'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const commission = {
      commission_type: formData.commission_type,
      commission_value: parseFloat(formData.commission_value) || 0,
    };
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, {
          name: formData.name, role: formData.role, ...commission,
        });
        toast.success('Usuário atualizado');
      } else {
        await axios.post(`${API}/users`, {
          name: formData.name, email: formData.email, password: formData.password,
          role: formData.role, ...commission,
        });
        toast.success('Usuário criado');
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao salvar'));
    }
  };

  const handleEdit = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name, email: u.email, password: '', role: u.role,
      commission_type: u.commission_type || 'fixed', commission_value: String(u.commission_value ?? 5),
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/users/${deletingUser.id}`);
      toast.success('Usuário excluído');
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(apiError(err, 'Falha ao excluir'));
    }
  };

  const openNewDialog = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">Acesso negado</h2>
        <p className="text-slate-500">Só administradores gerenciam usuários</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="users-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Usuários</h1>
          <p className="text-slate-500 mt-1">Funcionários, permissões e comissão</p>
        </div>
        <Button onClick={openNewDialog} data-testid="new-user-btn">
          <Plus className="h-4 w-4 mr-2" /> Novo usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-900 mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Nenhum usuário</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Comissão</th><th className="text-right">Ações</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">
                        <span className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-full ${u.role === 'admin' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            {u.role === 'admin'
                              ? <Shield className="h-4 w-4 text-blue-600" />
                              : <User className="h-4 w-4 text-slate-600" />}
                          </span>
                          {u.name}
                        </span>
                      </td>
                      <td className="text-slate-500">{u.email}</td>
                      <td>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                          {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
                        </span>
                      </td>
                      <td className="font-mono text-sm whitespace-nowrap">{commissionLabel(u.commission_type, u.commission_value, money)}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(u)}>
                            <Pencil className="h-4 w-4 text-slate-500" />
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeletingUser(u)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{editingUser ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Atualize os dados do funcionário' : 'Adicione um funcionário à loja'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={formData.name} required
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            {!editingUser && (
              <>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input type="email" value={formData.email} required
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <Input type="password" value={formData.password} required minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Perfil</Label>
              <select className={SELECT_CLASS} value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                <option value="user">Vendedor (compras e vendas)</option>
                <option value="admin">Administrador (acesso total)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de comissão</Label>
                <select className={SELECT_CLASS} value={formData.commission_type}
                  onChange={(e) => setFormData({ ...formData, commission_type: e.target.value })}>
                  <option value="fixed">Valor fixo por venda</option>
                  <option value="percent">Porcentagem da venda</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{formData.commission_type === 'percent' ? 'Porcentagem (%)' : 'Valor por venda'}</Label>
                <Input type="number" min="0" step="0.01" required
                  max={formData.commission_type === 'percent' ? 100 : undefined}
                  value={formData.commission_value}
                  onChange={(e) => setFormData({ ...formData, commission_value: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              A comissão é calculada sobre o total de cada venda (já com desconto) e vale para as vendas
              feitas a partir de agora.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingUser ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(o) => !o && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir "{deletingUser?.name}"? As vendas dele continuam no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
