import type { ReactNode } from 'react';
import { statusLabel } from '../lib/format';

export function StatusBadge({ status }: { status: string }) {
  const tone =
    ['aprovada', 'concluida', 'confirmado', 'recebido', 'faturado'].includes(status)
      ? 'green'
      : ['reprovada', 'cancelada', 'cancelado'].includes(status)
        ? 'red'
        : ['em_aprovacao', 'em_cotacao', 'em_pedido', 'emitido'].includes(status)
          ? 'amber'
          : 'blue';
  return <span className={`badge ${tone}`}>{statusLabel(status)}</span>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="toolbar">
        <h3 className="grow" style={{ margin: 0 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
