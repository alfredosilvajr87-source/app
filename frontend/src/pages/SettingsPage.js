import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import axios from 'axios';
import BACKEND_URL from '../config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Building2, Save, Settings2, Upload, Image, Key, FileText } from 'lucide-react';
import { SELECT_CLASS } from '../components/store/ItemLines';
import { apiError } from '../lib/store';

import { API_URL as API } from '../config';

const CURRENCIES = [
  { value: 'BRL', label: 'Real (R$)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'USD', label: 'Dólar (US$)' },
];

const SettingsPage = () => {
  const { user, company, isAdmin, changePassword, updateCompany } = useAuth();
  const { settings, setSettings } = useStore();
  const [storeForm, setStoreForm] = useState(settings);
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const fileInputRef = useRef(null);

  useEffect(() => setStoreForm(settings), [settings]);
  useEffect(() => setCompanyName(company?.name || ''), [company]);

  const handleStoreSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (companyName.trim() && companyName !== company.name) {
        const res = await axios.put(`${API}/companies/${company.id}`, {
          name: companyName.trim(),
          logo_url: company.logo_url,
        });
        updateCompany(res.data);
      }
      const res = await axios.put(`${API}/settings`, storeForm);
      setSettings(res.data);
      toast.success('Dados da loja salvos');
    } catch (err) {
      toast.error(apiError(err, 'Falha ao salvar'));
    } finally {
      setSaving(false);
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
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateCompany({ ...company, logo_url: res.data.logo_url });
      toast.success('Logo atualizado');
    } catch (err) {
      toast.error(apiError(err, 'Falha ao enviar o logo'));
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('As senhas novas não coincidem');
      return;
    }
    try {
      await changePassword(passwordForm.current, passwordForm.new);
      toast.success('Senha alterada');
      setPasswordDialogOpen(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error(apiError(err, 'Falha ao alterar a senha'));
    }
  };

  const field = (key) => ({
    value: storeForm[key] || '',
    onChange: (e) => setStoreForm({ ...storeForm, [key]: e.target.value }),
  });

  return (
    <div className="space-y-8" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Configurações</h1>
        <p className="text-slate-500 mt-1">
          {isAdmin ? 'Dados da loja, fatura e conta' : 'Sua conta'}
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Loja
            </CardTitle>
            <CardDescription>Estes dados aparecem no cabeçalho das faturas em PDF</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-6">
              {company?.logo_url ? (
                <img
                  src={company.logo_url.startsWith('/api') ? `${BACKEND_URL}${company.logo_url}` : company.logo_url}
                  alt="Logo"
                  className="h-20 w-20 object-contain border rounded-lg"
                />
              ) : (
                <div className="h-20 w-20 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Image className="h-8 w-8 text-slate-400" />
                </div>
              )}
              <div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={handleLogoUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" /> {uploading ? 'Enviando…' : 'Enviar logo'}
                </Button>
                <p className="text-xs text-slate-500 mt-2">PNG ou JPG até 2 MB</p>
              </div>
            </div>

            <form onSubmit={handleStoreSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nome da loja</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>CNPJ / NIF</Label>
                <Input {...field('tax_id')} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Endereço</Label>
                <Input {...field('address')} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input {...field('phone')} />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input type="email" {...field('email')} />
              </div>
              <div className="space-y-1">
                <Label>Moeda</Label>
                <select className={SELECT_CLASS} {...field('currency')}>
                  {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Rodapé da fatura</Label>
                <Input {...field('invoice_footer')} placeholder="Ex.: Obrigado pela preferência!" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-slate-500">Nome</Label><p className="font-medium">{user?.name}</p></div>
              <div><Label className="text-slate-500">E-mail</Label><p className="font-medium">{user?.email}</p></div>
              <div>
                <Label className="text-slate-500">Perfil</Label>
                <p className="font-medium">{user?.role === 'admin' ? 'Administrador' : 'Vendedor'}</p>
              </div>
              <div><Label className="text-slate-500">Loja</Label><p className="font-medium">{company?.name}</p></div>
            </div>
            <Separator />
            <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
              <Key className="h-4 w-4 mr-2" /> Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Alterar senha</DialogTitle>
            <DialogDescription>Digite a senha atual e escolha uma nova</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Senha atual</Label>
              <Input type="password" required value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" required minLength={6} value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Confirmar nova senha</Label>
              <Input type="password" required value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Alterar senha</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
