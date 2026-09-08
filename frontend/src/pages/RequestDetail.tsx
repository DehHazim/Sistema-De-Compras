import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { brl, date, dateTime } from '../lib/format';
import { StatusBadge } from '../components/ui';
import { useAuth } from '../lib/auth';

interface Detail {
  id: string;
  number: string;
  title: string;
  justification: string;
  status: string;
  priority: string;
  estimated_total: number;
  needed_by: string | null;
  requester_name: string;
  department_name: string;
  cost_center_name: string;
  created_at: string;
  items: { id: string; line_no: number; description: string; unit: string; quantity: number; estimated_price: number }[];
  approvalSteps: { level: number; decision: string; comment: string | null; decided_at: string | null; approver: string | null }[];
}

export function RequestDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api<Detail>(`/requests/${id}`).then(setD);
  }, [id]);
  useEffect(load, [load]);

  async function decide(decision: 'aprovado' | 'reprovado') {
    setMsg('');
    try {
      await api(`/approvals/${id}/decision`, { method: 'POST', json: { decision, comment } });
      setComment('');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    }
  }

  if (!d) return <p>Carregando…</p>;

  const canDecide = can('aprovador', 'gestor', 'admin') && d.status === 'em_aprovacao';

  return (
    <>
      <div className="toolbar">
        <h1 className="grow">
          {d.number} — {d.title}
        </h1>
        <StatusBadge status={d.status} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Dados</h3>
          <p>
            <span className="muted">Solicitante:</span> {d.requester_name}
            <br />
            <span className="muted">Setor:</span> {d.department_name}
            <br />
            <span className="muted">Centro de custo:</span> {d.cost_center_name}
            <br />
            <span className="muted">Prioridade:</span> {d.priority}
            <br />
            <span className="muted">Necessário até:</span> {date(d.needed_by)}
            <br />
            <span className="muted">Criada em:</span> {dateTime(d.created_at)}
          </p>
          <p>
            <span className="muted">Justificativa:</span>
            <br />
            {d.justification}
          </p>
        </div>

        <div className="card">
          <h3>Fluxo de aprovação</h3>
          <table>
            <thead>
              <tr>
                <th>Nível</th>
                <th>Aprovador</th>
                <th>Decisão</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {d.approvalSteps.map((s) => (
                <tr key={s.level}>
                  <td>{s.level}</td>
                  <td>{s.approver ?? '—'}</td>
                  <td>
                    <StatusBadge status={s.decision === 'pendente' ? 'em_aprovacao' : s.decision === 'aprovado' ? 'aprovada' : 'reprovada'} />
                    {s.comment ? <div className="muted">{s.comment}</div> : null}
                  </td>
                  <td>{dateTime(s.decided_at)}</td>
                </tr>
              ))}
              {!d.approvalSteps.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    Ainda não submetida.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canDecide && (
            <div style={{ marginTop: '1rem' }}>
              <label>Comentário</label>
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="row" style={{ marginTop: '0.5rem' }}>
                <button onClick={() => decide('aprovado')}>Aprovar</button>
                <button className="danger" onClick={() => decide('reprovado')}>
                  Reprovar
                </button>
              </div>
              {msg && <div className="error">{msg}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Itens</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Descrição</th>
              <th>Unid.</th>
              <th>Qtd</th>
              <th>Preço est.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((it) => (
              <tr key={it.id}>
                <td>{it.line_no}</td>
                <td>{it.description}</td>
                <td>{it.unit}</td>
                <td>{it.quantity}</td>
                <td>{brl(it.estimated_price)}</td>
                <td>{brl(it.quantity * it.estimated_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right' }}>
                <strong>Total estimado</strong>
              </td>
              <td>
                <strong>{brl(d.estimated_total)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
