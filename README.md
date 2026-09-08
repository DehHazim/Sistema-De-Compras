# Sistema Integrado de Compras (SIC)

Plataforma para centralizar, automatizar e rastrear o ciclo de aquisição de bens e serviços
em organizações de pequeno, médio e grande porte.

## Artefatos do projeto

| Artefato | Local | Stack |
|---|---|---|
| Banco de Dados (modelo físico) | [`database/`](database/) | PostgreSQL 15 (DDL + seed + ERD) |
| Serviço backend | [`backend/`](backend/) | Node.js 20, TypeScript, Express, `pg` |
| Serviço frontend | [`frontend/`](frontend/) | React 18, TypeScript, Vite, React Router |
| Landing page | [`landing/`](landing/) | HTML + CSS estático |

## Funcionalidades cobertas

- Gestão de Solicitações de Compra
- Fluxo de Aprovação Automatizado (níveis hierárquicos + limites financeiros)
- Gestão de Cotações e comparativo de fornecedores
- Cadastro e avaliação de Fornecedores
- Emissão de Pedidos de Compra
- Controle Orçamentário (aprovado / comprometido / realizado)
- Rastreamento e Auditoria (audit log imutável)
- Dashboard Gerencial e Relatórios
- Notificações e Alertas

## Subir o ambiente

```bash
# 1. Banco
docker compose up -d db
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql

# 2. Backend
cd backend && npm install && cp .env.example .env && npm run dev   # http://localhost:3333

# 3. Frontend
cd frontend && npm install && npm run dev                          # http://localhost:5173

# 4. Landing
open landing/index.html
```

Ou tudo via Docker: `docker compose up --build`.

## Arquitetura

```
Landing page ──▶ Frontend (SPA React) ──▶ Backend REST (Express) ──▶ PostgreSQL
                                                │
                                                ├─ Auth JWT + RBAC
                                                ├─ Motor de aprovação
                                                ├─ Trilha de auditoria (triggers)
                                                └─ Agendador de alertas
```

Credenciais de teste (seed): `admin@sic.dev` / `admin123`.
