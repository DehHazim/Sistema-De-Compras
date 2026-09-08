import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { brl, date } from '../lib/format';
import { StatusBadge } from '../components/ui';

interface Row {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  estimated_total: number;
  needed_by: string | null;
  requester: string;
  department: string;
  created_at: string;
}

export function Requests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    api<{ data: Row[] }>(`/requests?${params}`).then((r) => setRows(r.data));
  }, [status, q]);

  return (
    <>
      <div className="toolbar">
        <h1 className="grow">Solicitações de Compra</h1>
        <Link className="btn" to="/solicitacoes/nova">
          + Nova solicitação
        </Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            className="grow"
            placeholder="Buscar por título ou número…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="em_aprovacao">Em aprovação</option>
            <option value="aprovada">Aprovada</option>
            <option value="em_cotacao">Em cotação</option>
            <option value="em_pedido">Em pedido</option>
            <option value="concluida">Concluída</option>
            <option value="reprovada">Reprovada</option>
          </select>
        </div>

        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Título</th>
              <th>Setor</th>
              <th>Solicitante</th>
              <th>Valor est.</th>
              <th>Necessidade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/solicitacoes/${r.id}`}>{r.number}</Link>
                </td>
                <td>{r.title}</td>
                <td>{r.department}</td>
                <td>{r.requester}</td>
                <td>{brl(r.estimated_total)}</td>
                <td>{date(r.needed_by)}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
