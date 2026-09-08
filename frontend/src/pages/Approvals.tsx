import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { brl, dateTime } from '../lib/format';

interface Row {
  request_id: string;
  number: string;
  title: string;
  estimated_total: number;
  level: number;
  waiting_since: string;
}

export function Approvals() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<{ data: Row[] }>('/approvals/inbox').then((r) => setRows(r.data));
  }, []);

  return (
    <>
      <h1>Minhas Aprovações</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Solicitação</th>
              <th>Título</th>
              <th>Valor</th>
              <th>Nível</th>
              <th>Aguardando desde</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.request_id}>
                <td>{r.number}</td>
                <td>{r.title}</td>
                <td>{brl(r.estimated_total)}</td>
                <td>{r.level}</td>
                <td>{dateTime(r.waiting_since)}</td>
                <td>
                  <Link className="btn" to={`/solicitacoes/${r.request_id}`}>
                    Analisar
                  </Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhuma aprovação pendente. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
