import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Row {
  id: string;
  legal_name: string;
  trade_name: string | null;
  tax_id: string;
  email: string | null;
  status: string;
  rating_avg: number;
  orders_count: number;
}

export function Suppliers() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ legalName: '', taxId: '', email: '' });
  const [error, setError] = useState('');

  function load() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    api<{ data: Row[] }>(`/suppliers?${params}`).then((r) => setRows(r.data));
  }
  useEffect(load, [q]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/suppliers', { method: 'POST', json: form });
      setShowForm(false);
      setForm({ legalName: '', taxId: '', email: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <>
      <div className="toolbar">
        <h1 className="grow">Fornecedores</h1>
        {can('comprador', 'gestor', 'admin') && (
          <button onClick={() => setShowForm((v) => !v)}>+ Novo fornecedor</button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={create} style={{ marginBottom: '1rem' }}>
          <div className="row">
            <div className="field">
              <label>Razão social</label>
              <input
                required
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>CNPJ/CPF</label>
              <input
                required
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              />
            </div>
            <div className="field">
              <label>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          {error && <div className="error">{error}</div>}
          <button>Salvar</button>
        </form>
      )}

      <div className="card">
        <input
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: '1rem', maxWidth: 320 }}
        />
        <table>
          <thead>
            <tr>
              <th>Razão social</th>
              <th>CNPJ</th>
              <th>Status</th>
              <th>Avaliação</th>
              <th>Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.legal_name}</td>
                <td>{s.tax_id}</td>
                <td>
                  <span className={`badge ${s.status === 'ativo' ? 'green' : s.status === 'bloqueado' ? 'red' : ''}`}>
                    {s.status}
                  </span>
                </td>
                <td>{Number(s.rating_avg).toFixed(1)} ★</td>
                <td>{s.orders_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
