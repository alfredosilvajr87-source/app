import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Plus, Save, Ticket, Trash2 } from 'lucide-react';
import { SELECT_CLASS } from './ItemLines';
import { apiError } from '../../lib/store';

import { API_URL as API } from '../../config';

const EMPTY = { code: '', discount_type: 'percent', value: '', valid_until: '', max_uses: '' };

// Cupons de desconto e regra de fidelidade (só admin, na tela de Configurações)
const CouponsCard = ({ settings, setSettings, money }) => {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loyalty, setLoyalty] = useState({ every: '', percent: '' });

  useEffect(() => {
    axios.get(`${API}/coupons`).then((r) => setCoupons(r.data)).catch(() => {});
  }, []);
  useEffect(() => setLoyalty({
    every: settings.loyalty_every ? String(settings.loyalty_every) : '',
    percent: String(settings.loyalty_percent ?? 30),
  }), [settings]);

  const saveLoyalty = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`${API}/settings`, {
        ...settings,
        loyalty_every: parseInt(loyalty.every) || 0,
        loyalty_percent: parseFloat(loyalty.percent) || 0,
      });
      setSettings(res.data);
      toast.success(res.data.loyalty_every ? 'Fidelidade salva' : 'Fidelidade desligada');
    } catch (err) {
      toast.error(apiError(err, 'Falha ao salvar'));
    }
  };

  const createCoupon = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/coupons`, {
        ...form,
        value: parseFloat(form.value) || 0,
        max_uses: parseInt(form.max_uses) || 0,
      });
      setCoupons([res.data, ...coupons]);
      setForm(EMPTY);
      toast.success(`Cupom ${res.data.code} criado`);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao criar o cupom'));
    }
  };

  const toggle = async (c) => {
    try {
      const res = await axios.put(`${API}/coupons/${c.id}`, { ...c, active: !c.active });
      setCoupons(coupons.map((x) => (x.id === c.id ? res.data : x)));
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Excluir o cupom ${c.code}?`)) return;
    try {
      await axios.delete(`${API}/coupons/${c.id}`);
      setCoupons(coupons.filter((x) => x.id !== c.id));
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const valueText = (c) => (c.discount_type === 'percent' ? `${c.value}%` : money(c.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          <Ticket className="h-5 w-5" /> Cupons e fidelidade
        </CardTitle>
        <CardDescription>Na venda vale um desconto só: cupom ou fidelidade</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={saveLoyalty} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label>A cada quantas compras</Label>
            <Input type="number" min="0" step="1" placeholder="0 = desligado" value={loyalty.every}
              onChange={(e) => setLoyalty({ ...loyalty, every: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Desconto na próxima (%)</Label>
            <Input type="number" min="0" max="100" step="0.01" value={loyalty.percent}
              onChange={(e) => setLoyalty({ ...loyalty, percent: e.target.value })} />
          </div>
          <Button type="submit" variant="outline"><Save className="h-4 w-4 mr-2" /> Salvar fidelidade</Button>
          <p className="text-xs text-slate-500 sm:col-span-3">
            O cliente é reconhecido pelo telefone informado na venda. Vendas canceladas não contam.
          </p>
        </form>

        <Separator />

        <form onSubmit={createCoupon} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <div className="space-y-1 col-span-2">
            <Label>Código</Label>
            <Input required value={form.code} placeholder="Ex.: SERRANO10"
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <select className={SELECT_CLASS} value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              <option value="percent">%</option>
              <option value="fixed">Valor</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Desconto</Label>
            <Input required type="number" min="0.01" step="0.01" value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Válido até</Label>
            <Input type="date" value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Limite de usos</Label>
            <Input type="number" min="0" step="1" placeholder="Sem limite" value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
          </div>
          <div className="col-span-2 sm:col-span-6">
            <Button type="submit"><Plus className="h-4 w-4 mr-2" /> Criar cupom</Button>
          </div>
        </form>

        {coupons.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Código</th><th>Desconto</th><th>Validade</th><th className="text-right">Usos</th><th>Situação</th><th /></tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                    <td className="font-mono font-medium">{c.code}</td>
                    <td>{valueText(c)}</td>
                    <td className="text-sm">{c.valid_until ? c.valid_until.split('-').reverse().join('/') : '—'}</td>
                    <td className="text-right font-mono">{c.uses || 0}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => toggle(c)}>{c.active ? 'Ativo' : 'Inativo'}</Button>
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => remove(c)}>
                        <Trash2 className="h-4 w-4 text-slate-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CouponsCard;
