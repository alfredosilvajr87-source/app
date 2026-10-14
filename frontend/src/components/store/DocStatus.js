import { BadgeCheck, Lock } from 'lucide-react';

// Situação de uma compra/venda: concluída/cancelada, revisada e caixa do dia fechado
const DocStatus = ({ doc }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className={doc.status === 'cancelada' ? 'status-critical' : 'status-ok'}>
      {doc.status === 'cancelada' ? 'Cancelada' : 'Concluída'}
    </span>
    {doc.reviewed && (
      <span className="inline-flex items-center gap-1 text-xs text-sky-300" title={`Revisada por ${doc.reviewed_by_name || ''}`}>
        <BadgeCheck className="h-4 w-4" /> Revisada
      </span>
    )}
    {doc.cash_closed && (
      <span className="inline-flex items-center gap-1 text-xs text-amber-300" title="Caixa do dia fechado">
        <Lock className="h-3.5 w-3.5" /> Caixa fechado
      </span>
    )}
  </div>
);

// Pode editar: concluída, não revisada, caixa aberto e (admin ou quem lançou)
export const canEdit = (doc, user, isAdmin) =>
  doc.status === 'concluida' && !doc.reviewed && !doc.cash_closed && (isAdmin || doc.created_by === user?.id);

export default DocStatus;
