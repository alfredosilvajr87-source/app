import axios from 'axios';
import { API_URL as API } from '../config';

const LOCALES = { BRL: 'pt-BR', EUR: 'pt-PT', USD: 'en-US' };

export const formatMoney = (value, currency = 'BRL') =>
  new Intl.NumberFormat(LOCALES[currency] || 'pt-BR', { style: 'currency', currency })
    .format(Number(value) || 0);

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

export const tzOffset = () => new Date().getTimezoneOffset();

export const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
];

export const paymentLabel = (value) =>
  PAYMENT_METHODS.find((p) => p.value === value)?.label || value;

export const productLabel = (p) => (p.flavor ? `${p.name} - ${p.flavor}` : p.name);

export const stockStatus = (p) => {
  if (p.stock <= 0) return { key: 'critical', label: 'Sem estoque' };
  if (p.stock <= p.min_stock) return { key: 'low', label: 'Baixo' };
  return { key: 'ok', label: 'OK' };
};

export const apiError = (err, fallback = 'Erro inesperado') => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ');
  return fallback;
};

// Abre a fatura em PDF numa nova aba (a janela é aberta antes do download
// para não ser bloqueada pelo bloqueador de pop-ups do navegador).
export const openInvoice = async (sale) => {
  const win = window.open('', '_blank');
  try {
    const res = await axios.get(`${API}/sales/${sale.id}/invoice`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    if (win) {
      win.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatura_${sale.number}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (win) win.close();
    throw err;
  }
};
