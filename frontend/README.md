# SIC - Serviço Frontend

SPA em React 18 + TypeScript + Vite. Consome a API REST do backend.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173  (proxy /api -> :3333)
npm run build      # gera dist/
npm run preview
```

## Estrutura

```
src/
├── main.tsx              bootstrap + Router + AuthProvider
├── App.tsx               rotas (públicas / protegidas)
├── lib/
│   ├── api.ts            wrapper fetch + tratamento 401 + token em localStorage
│   ├── auth.tsx          contexto de autenticação + RBAC (can())
│   └── format.ts         moeda BRL, datas, rótulos de status
├── components/
│   ├── Layout.tsx        shell (sidebar + topbar + contador de notificações)
│   └── ui.tsx            StatusBadge, Section, Empty
└── pages/
    Login · Dashboard (Recharts) · Requests · RequestNew · RequestDetail ·
    Approvals · Suppliers · PurchaseOrders · Budget · Audit
```

## Telas x funcionalidades

| Tela | Cobre |
|---|---|
| Dashboard | KPIs, evolução de gastos, gasto por setor, pipeline, top fornecedores, economia |
| Solicitações / Nova | Gestão de solicitações de compra (itens, prioridade, justificativa) |
| Detalhe da solicitação | Fluxo de aprovação, itens, decisão inline (aprovar/reprovar) |
| Aprovações | Fila do aprovador (inbox por alçada) |
| Fornecedores | Cadastro, status de homologação, avaliação de desempenho |
| Pedidos | Emissão e avanço de status do pedido de compra |
| Orçamento | Planejado / comprometido / realizado / disponível por centro de custo |
| Auditoria | Trilha imutável de ações (gestor/admin) |

O menu lateral esconde itens conforme o papel do usuário logado.
