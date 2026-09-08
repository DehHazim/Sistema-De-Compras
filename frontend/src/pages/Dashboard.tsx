import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import { brl, statusLabel } from '../lib/format';
import { Section } from '../components/ui';

interface DashboardData {
  kpis: {
    pending_approvals: number;
    open_requests: number;
    open_orders: number;
    ytd_spend: number;
    active_suppliers: number;
  };
  spendByDepartment: { department_name: string; total_spent: number; orders_count: number }[];
  topSuppliers: { legal_name: string; total_spent: number; orders_count: number; rating_avg: number }[];
  totalSavings: number;
  monthlySpend: { month: string; total_spent: number }[];
  requestPipeline: { status: string; count: number }[];
}

const COLORS = ['#2f5bea', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardData>('/dashboard').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card error">{error}</div>;
  if (!data) return <p>Carregando indicadores…</p>;

  const k = data.kpis;
  const kpis = [
    { label: 'Aprovações pendentes', value: k.pending_approvals },
    { label: 'Solicitações abertas', value: k.open_requests },
    { label: 'Pedidos em aberto', value: k.open_orders },
    { label: 'Gasto no ano', value: brl(k.ytd_spend) },
    { label: 'Economia negociada', value: brl(data.totalSavings) },
    { label: 'Fornecedores ativos', value: k.active_suppliers },
  ];

  return (
    <>
      <h1>Dashboard Gerencial</h1>
      <div className="grid cols-3" style={{ marginBottom: '1rem' }}>
        {kpis.map((kpi) => (
          <div className="card kpi" key={kpi.label}>
            <div className="value">{kpi.value}</div>
            <div className="label">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <Section title="Evolução de gastos (12 meses)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.monthlySpend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Line type="monotone" dataKey="total_spent" stroke="#2f5bea" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Gastos por setor (ano)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.spendByDepartment}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department_name" />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="total_spent" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Pipeline de solicitações">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.requestPipeline.map((p) => ({ ...p, name: statusLabel(p.status) }))}
                dataKey="count"
                nameKey="name"
                outerRadius={90}
                label
              >
                {data.requestPipeline.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Top fornecedores">
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Pedidos</th>
                <th>Valor</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {data.topSuppliers.map((s) => (
                <tr key={s.legal_name}>
                  <td>{s.legal_name}</td>
                  <td>{s.orders_count}</td>
                  <td>{brl(s.total_spent)}</td>
                  <td>{Number(s.rating_avg).toFixed(1)} ★</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  );
}
