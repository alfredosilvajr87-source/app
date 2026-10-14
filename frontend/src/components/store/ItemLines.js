import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { productLabel } from '../../lib/store';

export const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

// Linhas de itens de uma compra ou venda.
// lines: [{ product_id, quantity, price, commission_type?, commission_value? }]
// `price` é custo (compra) ou preço de venda (venda). Com `showCommission`, cada linha
// tem a comissão do item (R$ por unidade ou %), puxada do cadastro do produto.
const ItemLines = ({ products, lines, setLines, priceLabel, defaultPrice, showStock, showCommission, money, stockBonus = {} }) => {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  const update = (idx, patch) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const selectProduct = (idx, productId) => {
    const p = byId[productId];
    update(idx, {
      product_id: productId,
      price: p ? String(defaultPrice(p)) : '',
      commission_type: p?.commission_type || 'fixed',
      commission_value: p ? String(p.commission_value ?? 5) : '',
    });
  };

  const cols = showCommission
    ? { product: 'sm:col-span-5', qty: 'sm:col-span-2', price: 'sm:col-span-2', comm: 'sm:col-span-2' }
    : { product: 'sm:col-span-6', qty: 'sm:col-span-2', price: 'sm:col-span-3' };

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
        <span className={cols.product}>Produto</span>
        <span className={cols.qty}>Qtd</span>
        <span className={cols.price}>{priceLabel}</span>
        {showCommission && <span className={cols.comm}>Comissão</span>}
      </div>
      {lines.map((line, idx) => {
        const p = byId[line.product_id];
        const available = p ? p.stock + (stockBonus[p.id] || 0) : 0;
        const qty = parseInt(line.quantity) || 0;
        const lineTotal = qty * (parseFloat(line.price) || 0);
        const isPercent = line.commission_type === 'percent';
        const commAmount = isPercent
          ? lineTotal * (parseFloat(line.commission_value) || 0) / 100
          : qty * (parseFloat(line.commission_value) || 0);
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg">
            <div className={`col-span-12 ${cols.product}`}>
              <select
                className={SELECT_CLASS}
                value={line.product_id}
                onChange={(e) => selectProduct(idx, e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {productLabel(prod)}{showStock ? ` (estoque: ${prod.stock + (stockBonus[prod.id] || 0)})` : ''}
                  </option>
                ))}
              </select>
              {showStock && p && qty > available && (
                <p className="text-xs text-rose-400 mt-1">Só há {available} em estoque</p>
              )}
            </div>
            <Input
              className={`col-span-4 ${cols.qty}`}
              type="number" min="1" step="1" required
              value={line.quantity}
              onChange={(e) => update(idx, { quantity: e.target.value })}
            />
            <Input
              className={`col-span-4 ${cols.price}`}
              type="number" min="0" step="0.01" required
              value={line.price}
              onChange={(e) => update(idx, { price: e.target.value })}
              title={money ? money(lineTotal) : undefined}
            />
            {showCommission && (
              <div className={`col-span-3 ${cols.comm}`}>
                <div className="relative">
                  <Input
                    type="number" min="0" step="0.01" required
                    max={isPercent ? 100 : undefined}
                    className="pr-7"
                    value={line.commission_value ?? ''}
                    onChange={(e) => update(idx, { commission_value: e.target.value })}
                    title={isPercent ? '% sobre o valor do item' : 'R$ por unidade'}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    {isPercent ? '%' : '/un'}
                  </span>
                </div>
                {p && money && <p className="text-[11px] text-slate-500 mt-0.5">= {money(commAmount)}</p>}
              </div>
            )}
            <Button
              type="button" variant="ghost" size="icon" className="col-span-1"
              onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              disabled={lines.length === 1}
              title="Remover item"
            >
              <Trash2 className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button" variant="outline" size="sm"
        onClick={() => setLines([...lines, emptyLine()])}
      >
        <Plus className="h-4 w-4 mr-1" /> Adicionar item
      </Button>
    </div>
  );
};

export const linesTotal = (lines) =>
  lines.reduce((sum, l) => sum + (parseInt(l.quantity) || 0) * (parseFloat(l.price) || 0), 0);

export const emptyLine = () => ({ product_id: '', quantity: '1', price: '', commission_type: 'fixed', commission_value: '' });

export default ItemLines;
