import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Mail, Lock, User, Building2, KeyRound, Eye, EyeOff, ArrowLeft, Loader2,
  ShoppingCart, Boxes, Wallet, BarChart3,
} from 'lucide-react';

const FEATURES = [
  { icon: ShoppingCart, text: 'Vendas com fatura em PDF' },
  { icon: Boxes, text: 'Estoque e compras sempre em dia' },
  { icon: Wallet, text: 'Caixa, comissões e financeiro' },
  { icon: BarChart3, text: 'Curva ABC para comprar melhor' },
];

// Campo com ícone à esquerda
const Field = ({ id, label, icon: Icon, right, ...props }) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-[#c9c9db] text-sm">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
      <Input id={id} className="pl-10 pr-10 h-11" {...props} />
      {right}
    </div>
  </div>
);

const LoginPage = () => {
  const { login, registerFirst } = useAuth();
  const [mode, setMode] = useState('login');           // login | register
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', name: '', companyName: '', masterKey: '' });
  const [helpOpen, setHelpOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email.trim(), loginForm.password);
      toast.success('Bem-vindo de volta!');
    } catch (err) {
      const status = err.response?.status;
      toast.error(status === 401 ? 'E-mail ou senha incorretos'
        : err.response?.data?.detail || 'Não foi possível entrar. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerFirst(registerForm.email.trim(), registerForm.password, registerForm.name.trim(),
        registerForm.companyName.trim(), registerForm.masterKey);
      toast.success('Loja criada! Bem-vindo.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Falha ao criar a loja');
    } finally {
      setLoading(false);
    }
  };

  const eye = (
    <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
      title={showPwd ? 'Ocultar senha' : 'Mostrar senha'}>
      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="login-container dark">
      {/* Painel da marca (computador) */}
      <aside className="login-brand">
        <img src="/logo.png" alt="Vapor Serrano — vapes, líquidos e acessórios" className="login-brand-logo" />
        <div className="login-brand-text">
          <h1 className="font-heading">Gestão completa da sua loja</h1>
          <p>Vendas, estoque, caixa e financeiro em um só lugar.</p>
          <ul>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}><span><Icon className="h-4 w-4" /></span>{text}</li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Formulário */}
      <main className="login-form">
        <div className="login-card">
          <div className="login-mobile-brand">
            <img src="/logo-mark.png" alt="" />
            <div>
              <span className="brand-name">VAPOR <span className="text-brand-gradient">SERRANO</span></span>
              <span className="brand-tagline">VAPES • LÍQUIDOS • ACESSÓRIOS</span>
            </div>
          </div>

          {mode === 'login' ? (
            <>
              <div className="mb-7">
                <h2 className="font-heading text-2xl font-bold text-white">Entrar</h2>
                <p className="text-slate-400 text-sm mt-1">Acesse com o e-mail e a senha da sua conta</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <Field id="login-email" label="E-mail" icon={Mail} type="email" autoComplete="username"
                  placeholder="voce@email.com" required autoFocus
                  value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
                <Field id="login-password" label="Senha" icon={Lock} type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="Sua senha" required right={eye}
                  value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
                <div className="flex justify-end">
                  <button type="button" className="text-xs text-violet-300 hover:text-violet-200" onClick={() => setHelpOpen(true)}>
                    Esqueci minha senha
                  </button>
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading} data-testid="login-submit-btn">
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando…</> : 'Entrar'}
                </Button>
              </form>
              <p className="text-center text-xs text-slate-500 mt-8">
                Primeira vez configurando o sistema?{' '}
                <button type="button" className="text-violet-300 hover:text-violet-200" onClick={() => setMode('register')}>
                  Criar uma loja
                </button>
              </p>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setMode('login')}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
              </button>
              <div className="mb-6">
                <h2 className="font-heading text-2xl font-bold text-white">Criar uma loja</h2>
                <p className="text-slate-400 text-sm mt-1">Você será o administrador. Precisa da chave de autorização.</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-3.5">
                <Field id="reg-company" label="Nome da loja" icon={Building2} required placeholder="Ex.: Vapor Serrano"
                  value={registerForm.companyName} onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })} />
                <Field id="reg-name" label="Seu nome" icon={User} required autoComplete="name"
                  value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
                <Field id="reg-email" label="E-mail" icon={Mail} type="email" required autoComplete="username"
                  value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
                <Field id="reg-password" label="Senha" icon={Lock} type={showPwd ? 'text' : 'password'} required minLength={6}
                  autoComplete="new-password" placeholder="Mínimo 6 caracteres" right={eye}
                  value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
                <Field id="reg-key" label="Chave de autorização" icon={KeyRound} type="password" required
                  placeholder="Fornecida pelo responsável do sistema"
                  value={registerForm.masterKey} onChange={(e) => setRegisterForm({ ...registerForm, masterKey: e.target.value })} />
                <Button type="submit" className="w-full h-11 font-semibold !mt-5" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando…</> : 'Criar loja e entrar'}
                </Button>
              </form>
            </>
          )}
        </div>
        <p className="login-footer">© {new Date().getFullYear()} Vapor Serrano · Mais que vapor, é estilo de vida.</p>
      </main>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="dark">
          <DialogHeader>
            <DialogTitle className="font-heading">Esqueceu a senha?</DialogTitle>
            <DialogDescription>
              Peça para um administrador da loja definir uma nova senha para você em
              <b> Funcionários → Editar → Nova senha</b>. Depois de entrar, você pode trocá-la no menu do seu nome,
              em <b>Alterar senha</b>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setHelpOpen(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
