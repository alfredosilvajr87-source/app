import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Users, Plus, Pencil, Trash2, Shield, User, KeyRound } from 'lucide-react';
import { SELECT_CLASS } from '../components/store/ItemLines';
import PageHeader from '../components/layout/PageHeader';
import { apiError } from '../lib/store';

import { API_URL as API } from '../config';

const EMPTY_FORM = {
  name: '', job_title: '', cpf: '', phone: '', salary: '', active: true,
  commission_type: 'fixed', commission_value: '5',
  can_login: false, email: '', password: '', role: 'user',
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
  const set = (patch) => setFormData((f) => ({ ...f, ...patch }));

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setUsers(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao carregar funcionários'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      job_title: formData.job_title.trim(),
      cpf: formData.cpf.trim(),
      phone: formData.phone.trim(),
      salary: parseFloat(formData.salary) || 0,
      active: formData.active,
      can_login: formData.can_login,
      role: formData.can_login ? formData.role : 'user',
    };
    if (formData.can_login) {
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.password) payload.password = formData.password;
    }
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, payload);
        toast.success('Funcionário atualizado');
      } else {
        await axios.post(`${API}/users`, payload);
        toast.success('Funcionário cadastrado');
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
      ...EMPTY_FORM,
      name: u.name, job_title: u.job_title || '', cpf: u.cpf || '', phone: u.phone || '',
      salary: u.salary ? String(u.salary) : '', active: u.active !== false,
      commission_type: u.commission_type || 'fixed', commission_value: String(u.commission_value ?? 5),
      can_login: u.can_login !== false, email: u.email || '', role: u.role,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/users/${deletingUser.id}`);
      toast.success('Funcionário excluído');
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
        <p className="text-slate-500">Só administradores gerenciam funcionários</p>
      </div>
    );
  }

  const payroll = users.filter((u) => u.active !== false).reduce((s, u) => s + (u.salary || 0), 0);
  const isSelf = editingUser?.id === currentUser?.id;

  return (
    <div className="space-y-6" data-testid="users-page">
      <PageHeader icon={Users} title="Funcionários" subtitle="Cadastro, salário e acesso ao sistema">
        <Button onClick={openNewDialog} data-testid="new-user-btn">
          <Plus className="h-4 w-4 mr-2" /> Novo funcionário
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="kpi-card kpi-purple">
          <p className="kpi-label">Funcionários ativos</p>
          <p className="kpi-value mt-2">{users.filter((u) => u.active !== false).length}</p>
        </div>
        <div className="kpi-card kpi-blue">
          <p className="kpi-label">Com acesso ao sistema</p>
          <p className="kpi-value mt-2">{users.filter((u) => u.can_login !== false && u.active !== false).length}</p>
        </div>
        <div className="kpi-card kpi-amber">
          <p className="kpi-label">Folha fixa mensal</p>
          <p className="kpi-value mt-2">{money(payroll)}</p>
          <p className="kpi-sub mt-1">Entra no fechamento do mês</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-violet-500 mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Funcionário</th><th>Contato</th><th className="text-right">Salário</th>
                    <th>Acesso</th><th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={u.active === false ? 'opacity-50' : ''}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className={`p-2 rounded-full ${u.role === 'admin' && u.can_login !== false ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            {u.role === 'admin' && u.can_login !== false
                              ? <Shield className="h-4 w-4 text-blue-600" />
                              : <User className="h-4 w-4 text-slate-500" />}
                          </span>
                          <div>
                            <p className="font-medium whitespace-nowrap">{u.name}</p>
                            <p className="text-xs text-slate-400">
                              {[u.job_title, u.cpf && `CPF ${u.cpf}`, u.active === false && 'Inativo'].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-slate-400">
                        {u.phone && <div>{u.phone}</div>}
                        {u.email && <div>{u.email}</div>}
                        {!u.phone && !u.email && '—'}
                      </td>
                      <td className="text-right font-mono whitespace-nowrap">{u.salary ? money(u.salary) : '—'}</td>
                      <td>
                        {u.can_login === false ? (
                          <span className="text-xs text-slate-400">Sem acesso</span>
                        ) : (
                          <span className={u.role === 'admin' ? 'status-ok' : 'status-low'}>
                            {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(u)}>
                            <Pencil className="h-4 w-4 text-slate-400" />
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeletingUser(u)}>
                              <Trash2 className="h-4 w-4 text-slate-400" />
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingUser ? 'Editar funcionário' : 'Novo funcionário'}</DialogTitle>
            <DialogDescription>
              O salário entra no resultado do mês (Financeiro). A comissão fica no cadastro de cada produto e é paga a quem fez a venda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={formData.name} required onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Input value={formData.job_title} placeholder="Ex.: Vendedor, Gerente"
                  onChange={(e) => set({ job_title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input value={formData.cpf} onChange={(e) => set({ cpf: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={formData.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Salário fixo mensal</Label>
                <Input type="number" min="0" step="0.01" value={formData.salary} placeholder="0,00"
                  onChange={(e) => set({ salary: e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-medium text-white flex items-center gap-2"><KeyRound className="h-4 w-4" /> Acesso ao sistema</span>
                  <span className="text-xs text-slate-400">Sem acesso, o funcionário só aparece como vendedor nas vendas</span>
                </span>
                <Switch checked={formData.can_login} disabled={isSelf}
                  onCheckedChange={(v) => set({ can_login: v })} />
              </label>
              {formData.can_login && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>E-mail de login *</Label>
                    <Input type="email" required value={formData.email} onChange={(e) => set({ email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>{editingUser?.can_login ? 'Nova senha (opcional)' : 'Senha *'}</Label>
                    <Input type="password" minLength={6} required={!editingUser?.can_login}
                      placeholder="Mínimo 6 caracteres" value={formData.password}
                      onChange={(e) => set({ password: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Perfil</Label>
                    <select className={SELECT_CLASS} value={formData.role} disabled={isSelf}
                      onChange={(e) => set({ role: e.target.value })}>
                      <option value="user">Vendedor (compras e vendas)</option>
                      <option value="admin">Administrador (acesso total)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 text-sm">
              <Switch checked={formData.active} disabled={isSelf} onCheckedChange={(v) => set({ active: v })} />
              Funcionário ativo
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingUser ? 'Salvar' : 'Cadastrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(o) => !o && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir "{deletingUser?.name}"? As vendas dele continuam no histórico. Se ele só saiu da loja,
              prefira desmarcar "Funcionário ativo".
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
