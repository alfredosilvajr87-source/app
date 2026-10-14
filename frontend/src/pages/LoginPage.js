import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Mail, Lock, User, Building2, KeyRound } from 'lucide-react';

import { API_URL as API } from '../config';

const LoginPage = () => {
  const { login, registerFirst } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', name: '', companyName: '', masterKey: '' });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(`${API}/companies`);
      setCompanies(res.data);
    } catch (err) {
      // No companies yet, that's fine
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Bem-vindo de volta!');
    } catch (err) {
      toast.error((err.response?.status === 401 ? 'E-mail ou senha incorretos' : err.response?.data?.detail || 'Falha ao entrar'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerFirst(registerForm.email, registerForm.password, registerForm.name, registerForm.companyName, registerForm.masterKey);
      toast.success('Conta criada!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Falha ao criar a conta');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetting(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: resetEmail });
      setResetSent(true);
    } catch (err) {
      // Always show success to avoid email enumeration
      setResetSent(true);
    } finally {
      setResetting(false);
    }
  };

  const handleCloseReset = () => {
    setResetDialogOpen(false);
    setResetEmail('');
    setResetSent(false);
  };

  return (
    <div className="login-container dark">
      {/* Image Section */}
      <div className="login-image hidden lg:flex">
        <img src="/logo.png" alt="Vapor Serrano — vapes, líquidos e acessórios" />
      </div>

      {/* Form Section */}
      <div className="login-form">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <img src="/logo.png" alt="Vapor Serrano" className="w-56 mx-auto logo-blend" />
          </div>

          <div>
            <h2 className="font-heading text-3xl font-bold text-white">Bem-vindo</h2>
            <p className="text-slate-400 mt-1">Entre para gerenciar a loja</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="login-tab">Entrar</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Nova loja</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-0 shadow-none">
                <CardContent className="p-0 space-y-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="login-email"
                          data-testid="login-email-input"
                          type="email"
                          placeholder="voce@email.com"
                          className="pl-10 h-12"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="login-password"
                          data-testid="login-password-input"
                          type="password"
                          placeholder="Sua senha"
                          className="pl-10 h-12"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      data-testid="login-submit-btn"
                      className="w-full h-12 font-semibold"
                      disabled={loading}
                    >
                      {loading ? 'Entrando...' : 'Entrar'}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-slate-500"
                      onClick={() => setResetDialogOpen(true)}
                      data-testid="forgot-password-btn"
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Esqueci a senha
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-0 shadow-none">
                <CardContent className="p-0 space-y-6">
                  <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="register-company">Nome da loja</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-company"
                          data-testid="register-company-input"
                          type="text"
                          placeholder="Ex.: Vapor Serrano"
                          className="pl-10 h-12"
                          value={registerForm.companyName}
                          onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-name">Seu nome</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-name"
                          data-testid="register-name-input"
                          type="text"
                          placeholder="Nome completo"
                          className="pl-10 h-12"
                          value={registerForm.name}
                          onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-email"
                          data-testid="register-email-input"
                          type="email"
                          placeholder="voce@email.com"
                          className="pl-10 h-12"
                          value={registerForm.email}
                          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-password"
                          data-testid="register-password-input"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          className="pl-10 h-12"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-master-key">Chave de autorização</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-master-key"
                          data-testid="register-master-key-input"
                          type="password"
                          placeholder="Fornecida pelo administrador do sistema"
                          className="pl-10 h-12"
                          value={registerForm.masterKey}
                          onChange={(e) => setRegisterForm({ ...registerForm, masterKey: e.target.value })}
                          required
                        />
                      </div>
                      <p className="text-xs text-slate-400">Necessária para criar uma nova loja.</p>
                    </div>

                    <Button
                      type="submit"
                      data-testid="register-submit-btn"
                      className="w-full h-12 font-semibold"
                      disabled={loading}
                    >
                      {loading ? 'Criando...' : 'Criar loja e conta'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Forgot Password Dialog */}
          <Dialog open={resetDialogOpen} onOpenChange={handleCloseReset}>
            <DialogContent data-testid="reset-password-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading">Esqueceu a senha?</DialogTitle>
                <DialogDescription>
                  {resetSent
                    ? 'Pedido enviado. Aguarde o contato do administrador.'
                    : 'Informe seu e-mail e os administradores da loja serão avisados para redefinir sua senha.'}
                </DialogDescription>
              </DialogHeader>

              {resetSent ? (
                <div className="py-4 space-y-4">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                      <Mail className="h-7 w-7 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Administradores avisados!</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Eles vão definir uma nova senha e falar com você.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCloseReset} className="w-full">Fechar</Button>
                  </DialogFooter>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Seu e-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        id="reset-email"
                        data-testid="reset-email-input"
                        type="email"
                        placeholder="voce@email.com"
                        className="pl-10"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Use o e-mail cadastrado no sistema.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseReset}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={resetting} data-testid="reset-password-submit-btn">
                      {resetting ? 'Enviando...' : 'Avisar administradores'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
