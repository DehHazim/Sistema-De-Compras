import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { brl } from '../lib/format';

interface Option {
  id: string;
  name: string;
  code?: string;
  department_id?: string;
}
interface Item {
  description: string;
  unit: string;
  quantity: number;
  estimatedPrice: number;
}

export function RequestNew() {
  const nav = useNavigate();
  const [departments, setDepartments] = useState<Option[]>([]);
  const [costCenters, setCostCenters] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [form, setForm] = useState({
    departmentId: '',
    costCenterId: '',
    categoryId: '',
    title: '',
    justification: '',
    priority: 'normal',
    neededBy: '',
  });
  const [items, setItems] = useState<Item[]>([
    { description: '', unit: 'un', quantity: 1, estimatedPrice: 0 },
  ]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Option[]>('/catalog/departments').then(setDepartments);
    api<Option[]>('/catalog/cost-centers').then(setCostCenters);
    api<Option[]>('/catalog/categories').then(setCategories);
  }, []);

  const total = items.reduce((a, i) => a + i.quantity * i.estimatedPrice, 0);

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api<{ id: string }>('/requests', {
        method: 'POST',
        json: { ...form, categoryId: form.categoryId || undefined, neededBy: form.neededBy || undefined, items },
      });
      await api(`/requests/${created.id}/submit`, { method: 'POST' });
      nav(`/solicitacoes/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  }

  const ccOptions = costCenters.filter((c) => !form.departmentId || c.department_id === form.departmentId);

  return (
    <>
      <h1>Nova Solicitação de Compra</h1>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label>Título</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="row">
          <div className="field">
            <label>Setor</label>
            <select
              required
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value, costCenterId: '' })}
            >
              <option value="">Selecione…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Centro de custo</label>
            <select
              required
              value={form.costCenterId}
              onChange={(e) => setForm({ ...form, costCenterId: e.target.value })}
            >
              <option value="">Selecione…</option>
              {ccOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Categoria</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Prioridade</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div className="field">
            <label>Necessário até</label>
            <input
              type="date"
              value={form.neededBy}
              onChange={(e) => setForm({ ...form, neededBy: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Justificativa</label>
          <textarea
            required
            rows={3}
            value={form.justification}
            onChange={(e) => setForm({ ...form, justification: e.target.value })}
          />
        </div>

        <h3>Itens</h3>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th style={{ width: 80 }}>Unid.</th>
              <th style={{ width: 90 }}>Qtd</th>
              <th style={{ width: 130 }}>Preço unit.</th>
              <th style={{ width: 120 }}>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    required
                    value={it.description}
                    onChange={(e) => setItem(idx, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input value={it.unit} onChange={(e) => setItem(idx, { unit: e.target.value })} />
                </td>
                <td>
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={it.quantity}
                    onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={it.estimatedPrice}
                    onChange={(e) => setItem(idx, { estimatedPrice: Number(e.target.value) })}
                  />
                </td>
                <td>{brl(it.quantity * it.estimatedPrice)}</td>
                <td>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            setItems([...items, { description: '', unit: 'un', quantity: 1, estimatedPrice: 0 }])
          }
        >
          + Adicionar item
        </button>

        <p style={{ textAlign: 'right', fontSize: '1.1rem' }}>
          <strong>Total estimado: {brl(total)}</strong>
        </p>
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? 'Enviando…' : 'Criar e enviar para aprovação'}</button>
      </form>
    </>
  );
}
