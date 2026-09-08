import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('admin@sic.dev');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <h2>Entrar no SIC</h2>
        <p className="muted">Sistema Integrado de Compras</p>
        <div className="field">
          <label>E-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>
        <button disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        {error && <div className="error">{error}</div>}
        <p className="muted" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
          Demo: admin@sic.dev · gestor@sic.dev · aprovador@sic.dev · comprador@sic.dev · user@sic.dev
          <br />
          Senha: <code>admin123</code>
        </p>
      </form>
    </div>
  );
}
