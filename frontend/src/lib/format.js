// Formatação padrão em português do Brasil
export const formatBRL = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatQty = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
