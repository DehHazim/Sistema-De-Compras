import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Requests } from './pages/Requests';
import { RequestNew } from './pages/RequestNew';
import { RequestDetail } from './pages/RequestDetail';
import { Approvals } from './pages/Approvals';
import { Suppliers } from './pages/Suppliers';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Budget } from './pages/Budget';
import { Audit } from './pages/Audit';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="content">Carregando…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="solicitacoes" element={<Requests />} />
        <Route path="solicitacoes/nova" element={<RequestNew />} />
        <Route path="solicitacoes/:id" element={<RequestDetail />} />
        <Route path="aprovacoes" element={<Approvals />} />
        <Route path="fornecedores" element={<Suppliers />} />
        <Route path="pedidos" element={<PurchaseOrders />} />
        <Route path="orcamento" element={<Budget />} />
        <Route path="auditoria" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
