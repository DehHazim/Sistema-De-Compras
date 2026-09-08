import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { brl, date, dateTime } from '../lib/format';
import { StatusBadge } from '../components/ui';

interface Row {
  id: string;
  number: string;
  status: string;
  total_amount: number;
  expected_date: string | null;
  issued_at: string;
  supplier_name: string;
  request_number: string;
}

export function PurchaseOrders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');

  function load() {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    api<{ data: Row[] }>(`/purchase-orders?${p}`).then((r) => setRows(r.data));
  }
  useEffect(load, [status]);

  async function advance(id: string, next: string) {
    await api(`/purchase-orders/${id}/status`, { method: 'PATCH', json: { status: next } });
    load();
  }

  return (
    <>
      <h1>Pedidos de Compra</h1>
      <div className="card">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: 220, marginBottom: '1rem' }}
        >
          <option value="">Todos os status</option>
          <option value="emitido">Emitido</option>
          <option value="confirmado">Confirmado</option>
          <option value="recebido">Recebido</option>
          <option value="faturado">Faturado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Solicitação</th>
              <th>Fornecedor</th>
              <th>Valor</th>
              <th>Previsão</th>
              <th>Emitido</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((po) => (
              <tr key={po.id}>
                <td>{po.number}</td>
                <td>{po.request_number}</td>
                <td>{po.supplier_name}</td>
                <td>{brl(po.total_amount)}</td>
                <td>{date(po.expected_date)}</td>
                <td>{dateTime(po.issued_at)}</td>
                <td>
                  <StatusBadge status={po.status} />
                </td>
                <td>
                  {po.status === 'emitido' && (
                    <button className="ghost" onClick={() => advance(po.id, 'confirmado')}>
                      Confirmar
                    </button>
                  )}
                  {po.status === 'confirmado' && (
                    <button className="ghost" onClick={() => advance(po.id, 'recebido')}>
                      Receber
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="muted">
                  Nenhum pedido.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
