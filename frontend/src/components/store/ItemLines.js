import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { productLabel } from '../../lib/store';

export const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

// Linhas de itens de uma compra ou venda.
// lines: [{ product_id, quantity, price }]; `price` é custo (compra) ou preço de venda (venda).
const ItemLines = ({ products, lines, setLines, priceLabel, defaultPrice, showStock, money }) => {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  const update = (idx, patch) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const selectProduct = (idx, productId) => {
    const p = byId[productId];
    update(idx, { product_id: productId, price: p ? String(defaultPrice(p)) : '' });
  };

  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
        <span className="col-span-6">Produto</span>
        <span className="col-span-2">Qtd</span>
        <span className="col-span-3">{priceLabel}</span>
      </div>
      {lines.map((line, idx) => {
        const p = byId[line.product_id];
        const lineTotal = (parseInt(line.quantity) || 0) * (parseFloat(line.price) || 0);
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start p-2 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg">
            <div className="col-span-12 sm:col-span-6">
              <select
                className={SELECT_CLASS}
                value={line.product_id}
                onChange={(e) => selectProduct(idx, e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {productLabel(prod)}{showStock ? ` (estoque: ${prod.stock})` : ''}
                  </option>
                ))}
              </select>
              {showStock && p && (parseInt(line.quantity) || 0) > p.stock && (
                <p className="text-xs text-rose-600 mt-1">Só há {p.stock} em estoque</p>
              )}
            </div>
            <Input
              className="col-span-4 sm:col-span-2"
              type="number" min="1" step="1" required
              value={line.quantity}
              onChange={(e) => update(idx, { quantity: e.target.value })}
            />
            <Input
              className="col-span-6 sm:col-span-3"
              type="number" min="0" step="0.01" required
              value={line.price}
              onChange={(e) => update(idx, { price: e.target.value })}
              title={money ? money(lineTotal) : undefined}
            />
            <Button
              type="button" variant="ghost" size="icon" className="col-span-2 sm:col-span-1"
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
        onClick={() => setLines([...lines, { product_id: '', quantity: '1', price: '' }])}
      >
        <Plus className="h-4 w-4 mr-1" /> Adicionar item
      </Button>
    </div>
  );
};

export const linesTotal = (lines) =>
  lines.reduce((sum, l) => sum + (parseInt(l.quantity) || 0) * (parseFloat(l.price) || 0), 0);

export const emptyLine = () => ({ product_id: '', quantity: '1', price: '' });

export default ItemLines;
