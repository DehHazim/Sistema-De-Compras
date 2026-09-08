import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';

interface Row {
  id: string;
  action: string;
  entity: string;
  entity_id: string;
  changed_fields: string[] | null;
  ip_address: string | null;
  created_at: string;
  actor_name: string | null;
}

export function Audit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [entity, setEntity] = useState('');

  useEffect(() => {
    const p = new URLSearchParams();
    if (entity) p.set('entity', entity);
    api<{ data: Row[] }>(`/audit-logs?${p}`).then((r) => setRows(r.data));
  }, [entity]);

  return (
    <>
      <h1>Trilha de Auditoria</h1>
      <div className="card">
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          style={{ maxWidth: 260, marginBottom: '1rem' }}
        >
          <option value="">Todas as entidades</option>
          <option value="purchase_requests">Solicitações</option>
          <option value="approval_steps">Etapas de aprovação</option>
          <option value="quotations">Cotações</option>
          <option value="purchase_orders">Pedidos</option>
          <option value="suppliers">Fornecedores</option>
          <option value="budgets">Orçamentos</option>
        </select>
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ator</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>Registro</th>
              <th>Campos alterados</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateTime(r.created_at)}</td>
                <td>{r.actor_name ?? 'sistema'}</td>
                <td>
                  <span className={`badge ${r.action === 'DELETE' ? 'red' : r.action === 'INSERT' ? 'green' : 'blue'}`}>
                    {r.action}
                  </span>
                </td>
                <td>{r.entity}</td>
                <td className="muted">{r.entity_id.slice(0, 8)}…</td>
                <td className="muted">{r.changed_fields?.join(', ') ?? '—'}</td>
                <td className="muted">{r.ip_address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
