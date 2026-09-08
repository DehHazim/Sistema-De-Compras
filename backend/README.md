# SIC - Serviço Backend

API REST em Node.js 20 + TypeScript + Express, acesso ao PostgreSQL via `pg`.

## Rodar

```bash
npm install
cp .env.example .env          # ajuste DATABASE_URL / JWT_SECRET
npm run migrate -- --seed     # cria schema + dados demo
npm run dev                   # http://localhost:3333
npm test                      # unit tests (vitest)
```

## Arquitetura

```
src/
├── config/        env (zod) + logger (pino)
├── db/pool.ts     pool pg + withTransaction (propaga ator p/ triggers de auditoria)
├── middleware/    auth (JWT), authorize (RBAC), validate (zod), error handler
├── services/
│   ├── approvalEngine.ts   monta e avança o fluxo de aprovação por alçada/nível
│   └── notifier.ts         persiste notificações (e-mail = stub)
├── jobs/alerts.ts          contratos vencendo + aprovações paradas
└── modules/       um router por domínio
    auth · requests · approvals · suppliers · quotations ·
    purchase-orders · budget · dashboard · audit · notifications ·
    catalog · reports
```

## Papéis (RBAC)

| Papel | Pode |
|---|---|
| `solicitante` | criar/submeter/cancelar as próprias solicitações |
| `aprovador` | decidir aprovações da sua alçada |
| `comprador` | cotações, pedidos, fornecedores |
| `gestor` | tudo de compras + orçamento + auditoria + relatórios |
| `admin` | tudo, inclusive regras de aprovação |

## Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | autenticação, retorna JWT |
| GET | `/api/dashboard` | KPIs, gastos por setor, top fornecedores, economia |
| GET/POST | `/api/requests` | listar / criar solicitação |
| POST | `/api/requests/:id/submit` | dispara o fluxo de aprovação |
| GET | `/api/approvals/inbox` | fila do aprovador |
| POST | `/api/approvals/:requestId/decision` | aprovar / reprovar |
| POST | `/api/quotations` | abrir cotação (multi-fornecedor) |
| PUT | `/api/quotations/offers/:offerId` | registrar proposta |
| POST | `/api/quotations/:id/select/:offerId` | escolher vencedora |
| POST | `/api/purchase-orders` | emitir pedido + comprometer orçamento |
| PATCH | `/api/purchase-orders/:id/status` | avançar status / realizar / estornar |
| GET/POST | `/api/suppliers` | cadastro e avaliação de fornecedores |
| GET/POST | `/api/budget` | situação e planejamento orçamentário |
| GET | `/api/audit-logs` | trilha de auditoria (gestor/admin) |
| GET | `/api/reports/:name?format=csv` | relatórios operacionais/gerenciais |
| GET | `/api/notifications` | alertas do usuário |

Coleção de testes manuais em [`test/http.rest`](test/http.rest).

## Auditoria

Toda escrita nas tabelas transacionais passa por `withTransaction`, que executa
`SET LOCAL app.current_user_id` / `app.client_ip`. O trigger `fn_audit()` no banco
grava `audit_logs` com ator, IP, campos alterados e diff `old/new` em JSONB.
