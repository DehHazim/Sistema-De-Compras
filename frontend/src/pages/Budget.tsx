import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { brl } from '../lib/format';

interface BudgetRow {
  cost_center_code: string;
  cost_center_name: string;
  department_name: string | null;
  amount_planned: number;
  amount_committed: number;
  amount_executed: number;
  amount_available: number;
}
interface BudgetData {
  year: number;
  costCenters: BudgetRow[];
  totals: { planned: number; committed: number; executed: number; available: number };
}

function Bar({ planned, committed, executed }: { planned: number; committed: number; executed: number }) {
  const pctExec = planned ? (executed / planned) * 100 : 0;
  const pctComm = planned ? (committed / planned) * 100 : 0;
  return (
    <div style={{ background: '#eef1f8', borderRadius: 6, height: 10, overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: `${pctExec}%`, background: '#16a34a' }} />
      <div style={{ width: `${Math.max(0, pctComm - pctExec)}%`, background: '#d97706' }} />
    </div>
  );
}

export function Budget() {
  const [data, setData] = useState<BudgetData | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    api<BudgetData>(`/budget?year=${year}`).then(setData);
  }, [year]);

  if (!data) return <p>Carregando…</p>;
  const t = data.totals;

  return (
    <>
      <h1>Controle Orçamentário {data.year}</h1>
      <div className="grid cols-4" style={{ marginBottom: '1rem' }}>
        <div className="card kpi">
          <div className="value">{brl(t.planned)}</div>
          <div className="label">Planejado</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: '#d97706' }}>
            {brl(t.committed)}
          </div>
          <div className="label">Comprometido</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: '#16a34a' }}>
            {brl(t.executed)}
          </div>
          <div className="label">Realizado</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: t.available < 0 ? '#dc2626' : undefined }}>
            {brl(t.available)}
          </div>
          <div className="label">Disponível</div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Centro de custo</th>
              <th>Setor</th>
              <th>Planejado</th>
              <th>Comprometido</th>
              <th>Realizado</th>
              <th>Disponível</th>
              <th style={{ width: 160 }}>Execução</th>
            </tr>
          </thead>
          <tbody>
            {data.costCenters.map((r) => (
              <tr key={r.cost_center_code}>
                <td>
                  {r.cost_center_code}
                  <div className="muted">{r.cost_center_name}</div>
                </td>
                <td>{r.department_name ?? '—'}</td>
                <td>{brl(r.amount_planned)}</td>
                <td>{brl(r.amount_committed)}</td>
                <td>{brl(r.amount_executed)}</td>
                <td style={{ color: r.amount_available < 0 ? '#dc2626' : undefined }}>
                  {brl(r.amount_available)}
                </td>
                <td>
                  <Bar
                    planned={r.amount_planned}
                    committed={r.amount_committed}
                    executed={r.amount_executed}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          <span style={{ color: '#16a34a' }}>■</span> realizado&nbsp;&nbsp;
          <span style={{ color: '#d97706' }}>■</span> comprometido
        </p>
      </div>
    </>
  );
}
