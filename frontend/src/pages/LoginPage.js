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
import { ChefHat, Mail, Lock, User, Building2, KeyRound } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LoginPage = () => {
  const { login, registerFirst } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', name: '', companyName: '' });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ email: '', newPassword: '', confirmPassword: '' });
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
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerFirst(registerForm.email, registerForm.password, registerForm.name, registerForm.companyName);
      toast.success('Account created successfully!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (resetForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    try {
      await axios.post(`${API}/auth/reset-password?email=${encodeURIComponent(resetForm.email)}&new_password=${encodeURIComponent(resetForm.newPassword)}`);
      toast.success('Password reset successfully! You can now login.');
      setResetDialogOpen(false);
      setResetForm({ email: '', newPassword: '', confirmPassword: '' });
      setLoginForm({ ...loginForm, email: resetForm.email });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="login-container">
      {/* Image Section */}
      <div
        className="login-image hidden lg:block"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80')`
        }}
      >
        <div className="absolute inset-0 flex items-end p-12 z-10">
          <div className="text-white">
            <h1 className="font-heading text-5xl font-black tracking-tight mb-4">Kitchen Inventory</h1>
            <p className="text-xl text-white/80 max-w-md">
              Professional inventory management. Organized. Sharp. Efficient.
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="login-form">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:hidden">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-slate-900 rounded-xl">
                <ChefHat className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight text-slate-900">Kitchen Inventory</h1>
            <p className="text-slate-500 mt-2">Professional Management System</p>
          </div>

          <div className="hidden lg:block">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Welcome</h2>
            <p className="text-slate-500 mt-1">Sign in to manage your inventory</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Create Company</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-0 shadow-none">
                <CardContent className="p-0 space-y-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="login-email"
                          data-testid="login-email-input"
                          type="email"
                          placeholder="user@company.com"
                          className="pl-10 h-12"
                          value={loginForm.email}
                          onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="login-password"
                          data-testid="login-password-input"
                          type="password"
                          placeholder="Enter your password"
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
                      className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                      disabled={loading}
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-slate-500"
                      onClick={() => setResetDialogOpen(true)}
                      data-testid="forgot-password-btn"
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Forgot password?
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
                      <Label htmlFor="register-company">Company Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-company"
                          data-testid="register-company-input"
                          type="text"
                          placeholder="Your Company Name"
                          className="pl-10 h-12"
                          value={registerForm.companyName}
                          onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-name"
                          data-testid="register-name-input"
                          type="text"
                          placeholder="Your Name"
                          className="pl-10 h-12"
                          value={registerForm.name}
                          onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-email"
                          data-testid="register-email-input"
                          type="email"
                          placeholder="admin@company.com"
                          className="pl-10 h-12"
                          value={registerForm.email}
                          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                          id="register-password"
                          data-testid="register-password-input"
                          type="password"
                          placeholder="Create a strong password"
                          className="pl-10 h-12"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      data-testid="register-submit-btn"
                      className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : 'Create Company & Account'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Reset Password Dialog */}
          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent data-testid="reset-password-dialog">
              <DialogHeader>
                <DialogTitle className="font-heading">Reset Password</DialogTitle>
                <DialogDescription>
                  Enter your email and a new password to reset your account
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="reset-email"
                      data-testid="reset-email-input"
                      type="email"
                      placeholder="your@email.com"
                      className="pl-10"
                      value={resetForm.email}
                      onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="reset-new-password"
                      data-testid="reset-new-password-input"
                      type="password"
                      placeholder="New password (min 6 characters)"
                      className="pl-10"
                      value={resetForm.newPassword}
                      onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="reset-confirm-password"
                      data-testid="reset-confirm-password-input"
                      type="password"
                      placeholder="Confirm new password"
                      className="pl-10"
                      value={resetForm.confirmPassword}
                      onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={resetting} data-testid="reset-password-submit-btn">
                    {resetting ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
