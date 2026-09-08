import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth, type User } from '../lib/auth';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  roles?: User['role'][];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/solicitacoes', label: 'Solicitações' },
  { to: '/aprovacoes', label: 'Aprovações', roles: ['aprovador', 'gestor', 'admin'] },
  { to: '/fornecedores', label: 'Fornecedores' },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/orcamento', label: 'Orçamento' },
  { to: '/auditoria', label: 'Auditoria', roles: ['gestor', 'admin'] },
];

export function Layout() {
  const { user, logout, can } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api<{ unreadCount: number }>('/notifications?unread=true')
      .then((r) => setUnread(r.unreadCount))
      .catch(() => {});
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">SIC · Compras</div>
        {NAV.filter((n) => !n.roles || can(...n.roles)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end ?? false}>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <span className="muted" style={{ padding: '0 0.75rem', fontSize: '0.8rem' }}>
          {user?.name} · {user?.role}
        </span>
        <a onClick={logout} style={{ cursor: 'pointer' }}>
          Sair
        </a>
      </aside>
      <div className="main">
        <header className="topbar">
          <strong>Sistema Integrado de Compras</strong>
          <span className="badge blue">{unread} notificações</span>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
