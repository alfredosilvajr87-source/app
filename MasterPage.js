import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL as API } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  ShieldCheck, Building2, Users, Trash2,
  ToggleLeft, ToggleRight, Plus, LogOut, Eye, EyeOff, RefreshCw
} from 'lucide-react';

export default function MasterPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [masterKey, setMasterKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', adminEmail: '', adminPassword: '', adminName: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchCompanies = useCallback(async (key) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/superadmin/companies?master_key=${encodeURIComponent(key)}`);
      setCompanies(res.data);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Invalid master key');
        setAuthenticated(false);
        setMasterKey('');
      } else {
        toast.error('Failed to load companies');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    await fetchCompanies(masterKey);
    setAuthenticated(true);
  };

  useEffect(() => {
    if (authenticated) fetchCompanies(masterKey);
  }, [authenticated, fetchCompanies, masterKey]);

  const toggleCompany = async (company) => {
    try {
      const res = await axios.patch(
        `${API}/superadmin/companies/${company.id}/toggle?master_key=${encodeURIComponent(masterKey)}`
      );
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, active: res.data.active } : c
      ));
      toast.success(res.data.message);
    } catch {
      toast.error('Failed to toggle company status');
    }
  };

  const deleteCompany = async (company) => {
    if (!window.confirm(`⚠️ DELETE "${company.name}" and ALL its data? This cannot be undone!`)) return;
    try {
      await axios.delete(
        `${API}/superadmin/companies/${company.id}?master_key=${encodeURIComponent(masterKey)}`
      );
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      toast.success(`Company "${company.name}" deleted`);
    } catch {
      toast.error('Failed to delete company');
    }
  };

  const createCompany = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await axios.post(
        `${API}/superadmin/companies?master_key=${encodeURIComponent(masterKey)}` +
        `&company_name=${encodeURIComponent(newCompany.name)}` +
        `&admin_email=${encodeURIComponent(newCompany.adminEmail)}` +
        `&admin_password=${encodeURIComponent(newCompany.adminPassword)}` +
        `&admin_name=${encodeURIComponent(newCompany.adminName)}`
      );
      toast.success('Company created successfully!');
      setNewCompany({ name: '', adminEmail: '', adminPassword: '', adminName: '' });
      setShowCreateForm(false);
      fetchCompanies(masterKey);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  // LOGIN SCREEN
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="bg-slate-900 p-3 rounded-full">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-xl">Master Access</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Restricted area</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="Master key"
                  value={masterKey}
                  onChange={e => setMasterKey(e.target.value)}
                  className="pr-10"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                Enter
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCount = companies.filter(c => c.active !== false).length;
  const inactiveCount = companies.filter(c => c.active === false).length;

  // MASTER DASHBOARD
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Master Panel</h1>
              <p className="text-xs text-slate-500">Full system control</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchCompanies(masterKey)}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setAuthenticated(false); setMasterKey(''); }}>
              <LogOut className="h-4 w-4 mr-1" /> Exit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-slate-900">{companies.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total Companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600">{activeCount}</p>
              <p className="text-xs text-slate-500 mt-1">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-red-500">{inactiveCount}</p>
              <p className="text-xs text-slate-500 mt-1">Inactive</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Company */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Company
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCreateForm(v => !v)}>
                {showCreateForm ? 'Cancel' : 'Create'}
              </Button>
            </div>
          </CardHeader>
          {showCreateForm && (
            <CardContent>
              <form onSubmit={createCompany} className="space-y-3">
                <Input
                  placeholder="Company name"
                  value={newCompany.name}
                  onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Admin name"
                  value={newCompany.adminName}
                  onChange={e => setNewCompany({ ...newCompany, adminName: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Admin email"
                  value={newCompany.adminEmail}
                  onChange={e => setNewCompany({ ...newCompany, adminEmail: e.target.value })}
                  required
                />
                <Input
                  type="password"
                  placeholder="Admin password"
                  value={newCompany.adminPassword}
                  onChange={e => setNewCompany({ ...newCompany, adminPassword: e.target.value })}
                  required
                />
                <Button type="submit" disabled={creating} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                  {creating ? 'Creating...' : 'Create Company & Admin'}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Companies List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-10 text-center text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : companies.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No companies yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {companies.map(company => (
                  <div key={company.id} className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${company.active !== false ? 'bg-green-500' : 'bg-red-400'}`} />
                      <div>
                        <p className="font-medium text-slate-900">{company.name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Users className="h-3 w-3" /> {company.user_count || 0} users
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(company.created_at).toLocaleDateString('en-IE')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={company.active !== false
                          ? 'bg-green-50 text-green-700 border-green-200 text-xs'
                          : 'bg-red-50 text-red-600 border-red-200 text-xs'}
                      >
                        {company.active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                      <button
                        onClick={() => toggleCompany(company)}
                        title={company.active !== false ? 'Deactivate' : 'Activate'}
                        className="p-1.5 rounded hover:bg-slate-100 transition-colors"
                      >
                        {company.active !== false
                          ? <ToggleRight className="h-5 w-5 text-green-600" />
                          : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                      </button>
                      <button
                        onClick={() => deleteCompany(company)}
                        title="Delete company"
                        className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-300">
          Master Panel — Keep this URL confidential
        </p>
      </div>
    </div>
  );
}
