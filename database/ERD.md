# Modelo de Dados - Diagrama Entidade-Relacionamento

Modelo físico completo em [`schema.sql`](schema.sql). Dados de demonstração em [`seed.sql`](seed.sql).

```mermaid
erDiagram
    organizations   ||--o{ departments        : possui
    organizations   ||--o{ cost_centers        : possui
    organizations   ||--o{ users               : possui
    organizations   ||--o{ categories          : possui
    organizations   ||--o{ suppliers           : cadastra
    organizations   ||--o{ approval_rules      : configura
    organizations   ||--o{ purchase_requests   : registra
    organizations   ||--o{ contracts           : mantem

    departments     ||--o{ cost_centers        : agrupa
    departments     ||--o{ users               : lota
    departments     ||--o{ purchase_requests   : origina

    users           ||--o{ purchase_requests   : solicita
    users           ||--o{ approval_steps      : decide
    users           ||--o{ quotations          : conduz
    users           ||--o{ purchase_orders     : emite

    categories      ||--o{ purchase_requests   : classifica
    categories      ||--o{ supplier_categories : rotula
    suppliers       ||--o{ supplier_categories : atende
    suppliers       ||--o{ supplier_documents  : anexa
    suppliers       ||--o{ supplier_evaluations: recebe
    suppliers       ||--o{ quotation_offers    : propoe
    suppliers       ||--o{ purchase_orders     : fornece
    suppliers       ||--o{ contracts           : assina

    purchase_requests       ||--o{ purchase_request_items : contem
    purchase_requests       ||--|| approval_workflows      : dispara
    approval_workflows      ||--o{ approval_steps          : compoe
    purchase_requests       ||--o{ quotations              : gera
    quotations              ||--o{ quotation_offers        : recebe
    quotation_offers        ||--o{ quotation_offer_items   : detalha
    purchase_request_items  ||--o{ quotation_offer_items   : cotado_em
    purchase_requests       ||--o{ purchase_orders         : converte
    quotation_offers        ||--o{ purchase_orders         : baseia
    purchase_orders         ||--o{ purchase_order_items    : contem
    purchase_orders         ||--o{ supplier_evaluations    : avaliado_por

    cost_centers    ||--o{ budgets              : orca
    budgets         ||--o{ budget_movements     : movimenta
    purchase_orders ||--o{ budget_movements     : compromete

    organizations   ||--o{ notifications        : envia
    users           ||--o{ notifications        : recebe
    organizations   ||--o{ audit_logs           : registra
```

## Blocos funcionais

| Bloco | Tabelas | Papel |
|---|---|---|
| Estrutura organizacional | `organizations`, `departments`, `cost_centers`, `users`, `categories` | Base multiempresa e RBAC |
| Fornecedores | `suppliers`, `supplier_categories`, `supplier_documents`, `supplier_evaluations` | Cadastro, homologação, desempenho |
| Solicitações | `purchase_requests`, `purchase_request_items` | Registro da necessidade |
| Aprovação | `approval_rules`, `approval_workflows`, `approval_steps` | Motor de fluxo por alçada/nível |
| Cotação | `quotations`, `quotation_offers`, `quotation_offer_items` | Comparativo de propostas |
| Pedido | `purchase_orders`, `purchase_order_items` | Compromisso formal com fornecedor |
| Orçamento | `budgets`, `budget_movements`, `vw_budget_balance` | Planejado / comprometido / realizado |
| Contratos | `contracts` | Alertas de vencimento |
| Observabilidade | `notifications`, `audit_logs` | Alertas e trilha imutável |

## Regras de integridade relevantes

- **Auditoria**: `fn_audit()` grava `audit_logs` em `INSERT/UPDATE/DELETE` das tabelas transacionais, capturando `actor_id`/`client_ip` via `SET LOCAL app.current_user_id`.
- **Numeração**: sequências dedicadas geram `SC-*`, `COT-*`, `PC-*`.
- **Cotação vencedora única**: índice parcial `uq_quotation_single_selected` garante 1 `quotation_offers.is_selected` por cotação.
- **Saldo orçamentário**: `vw_budget_balance` deriva disponível de `budget_movements` (livro-razão append-only).
- **Rating de fornecedor**: `fn_supplier_rating()` recalcula `suppliers.rating_avg` a cada avaliação.
- **Totais de linha**: `line_total` é coluna `GENERATED ALWAYS AS ... STORED`.
