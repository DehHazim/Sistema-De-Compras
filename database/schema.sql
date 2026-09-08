-- =============================================================================
--  SISTEMA INTEGRADO DE COMPRAS (SIC)
--  Modelo físico - PostgreSQL 15+
--  Convenções: snake_case, PK "id" uuid, timestamps UTC, soft-delete via deleted_at
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- e-mails case-insensitive

-- -----------------------------------------------------------------------------
--  DOMÍNIOS / TIPOS
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('solicitante', 'aprovador', 'comprador', 'gestor', 'admin');

CREATE TYPE request_status AS ENUM (
  'rascunho', 'em_aprovacao', 'aprovada', 'reprovada',
  'em_cotacao', 'em_pedido', 'concluida', 'cancelada'
);

CREATE TYPE approval_decision AS ENUM ('pendente', 'aprovado', 'reprovado', 'delegado');

CREATE TYPE quotation_status AS ENUM ('aberta', 'respondida', 'selecionada', 'descartada', 'expirada');

CREATE TYPE po_status AS ENUM ('emitido', 'enviado_fornecedor', 'confirmado', 'recebido_parcial', 'recebido', 'faturado', 'cancelado');

CREATE TYPE budget_movement_type AS ENUM ('aprovado', 'comprometido', 'realizado', 'estorno');

CREATE TYPE notification_channel AS ENUM ('in_app', 'email');

CREATE TYPE supplier_status AS ENUM ('ativo', 'inativo', 'bloqueado', 'homologacao');

-- =============================================================================
--  ORGANIZAÇÃO / ESTRUTURA
-- =============================================================================
CREATE TABLE organizations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name      varchar(160) NOT NULL,
    trade_name      varchar(160),
    tax_id          varchar(20) NOT NULL UNIQUE,        -- CNPJ
    size            varchar(20) NOT NULL DEFAULT 'media'
                      CHECK (size IN ('pequena', 'media', 'grande')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id       uuid REFERENCES departments(id) ON DELETE SET NULL,
    code            varchar(30) NOT NULL,
    name            varchar(120) NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code)
);

CREATE TABLE cost_centers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
    code            varchar(30) NOT NULL,
    name            varchar(120) NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    UNIQUE (organization_id, code)
);

-- =============================================================================
--  USUÁRIOS E ACESSO
-- =============================================================================
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
    full_name       varchar(160) NOT NULL,
    email           citext NOT NULL,
    password_hash   varchar(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'solicitante',
    approval_limit  numeric(14,2) NOT NULL DEFAULT 0    -- alçada financeira do aprovador
                      CHECK (approval_limit >= 0),
    is_active       boolean NOT NULL DEFAULT true,
    last_login_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    UNIQUE (organization_id, email)
);
CREATE INDEX idx_users_org_role ON users(organization_id, role) WHERE deleted_at IS NULL;

-- =============================================================================
--  CATÁLOGO / CATEGORIAS
-- =============================================================================
CREATE TABLE categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id       uuid REFERENCES categories(id) ON DELETE SET NULL,
    name            varchar(120) NOT NULL,
    kind            varchar(10) NOT NULL DEFAULT 'material'
                      CHECK (kind IN ('material', 'servico')),
    is_active       boolean NOT NULL DEFAULT true,
    UNIQUE (organization_id, name)
);

-- =============================================================================
--  FORNECEDORES
-- =============================================================================
CREATE TABLE suppliers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    legal_name      varchar(160) NOT NULL,
    trade_name      varchar(160),
    tax_id          varchar(20) NOT NULL,               -- CNPJ / CPF
    email           citext,
    phone           varchar(30),
    address         jsonb NOT NULL DEFAULT '{}'::jsonb,
    status          supplier_status NOT NULL DEFAULT 'homologacao',
    rating_avg      numeric(3,2) NOT NULL DEFAULT 0     -- média das avaliações 0-5
                      CHECK (rating_avg BETWEEN 0 AND 5),
    notes           text,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    UNIQUE (organization_id, tax_id)
);
CREATE INDEX idx_suppliers_status ON suppliers(organization_id, status) WHERE deleted_at IS NULL;

CREATE TABLE supplier_categories (
    supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id     uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (supplier_id, category_id)
);

CREATE TABLE supplier_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    doc_type        varchar(40) NOT NULL,               -- 'contrato_social', 'certidao_negativa'...
    file_url        varchar(500) NOT NULL,
    issued_at       date,
    expires_at      date,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_supplier_docs_expiry ON supplier_documents(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE supplier_evaluations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    purchase_order_id uuid,                             -- FK adiada (ver ALTER abaixo)
    evaluator_id    uuid REFERENCES users(id) ON DELETE SET NULL,
    score_quality   smallint NOT NULL CHECK (score_quality BETWEEN 1 AND 5),
    score_deadline  smallint NOT NULL CHECK (score_deadline BETWEEN 1 AND 5),
    score_price     smallint NOT NULL CHECK (score_price BETWEEN 1 AND 5),
    comment         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
--  ORÇAMENTO
-- =============================================================================
CREATE TABLE budgets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cost_center_id  uuid NOT NULL REFERENCES cost_centers(id) ON DELETE CASCADE,
    fiscal_year     smallint NOT NULL,
    period_month    smallint CHECK (period_month BETWEEN 1 AND 12),  -- NULL = anual
    amount_planned  numeric(14,2) NOT NULL CHECK (amount_planned >= 0),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (cost_center_id, fiscal_year, period_month)
);

-- Livro-razão de movimentações orçamentárias (append-only)
CREATE TABLE budget_movements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id       uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    movement_type   budget_movement_type NOT NULL,
    amount          numeric(14,2) NOT NULL,
    source_table    varchar(40) NOT NULL,               -- 'purchase_requests' | 'purchase_orders'
    source_id       uuid NOT NULL,
    created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_budget_mov_budget ON budget_movements(budget_id, movement_type);

-- Saldo consolidado por orçamento
CREATE VIEW vw_budget_balance AS
SELECT b.id AS budget_id,
       b.cost_center_id,
       b.fiscal_year,
       b.period_month,
       b.amount_planned,
       COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'comprometido'), 0)
         - COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'estorno'), 0) AS amount_committed,
       COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'realizado'), 0)   AS amount_executed,
       b.amount_planned
         - COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type IN ('comprometido','realizado')), 0)
         + COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'estorno'), 0) AS amount_available
FROM budgets b
LEFT JOIN budget_movements m ON m.budget_id = b.id
GROUP BY b.id;

-- =============================================================================
--  SOLICITAÇÕES DE COMPRA
-- =============================================================================
CREATE SEQUENCE seq_request_number START 1000;

CREATE TABLE purchase_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    number          varchar(20) NOT NULL DEFAULT ('SC-' || nextval('seq_request_number')),
    requester_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_id   uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    cost_center_id  uuid NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
    category_id     uuid REFERENCES categories(id) ON DELETE SET NULL,
    title           varchar(160) NOT NULL,
    justification   text NOT NULL,
    priority        varchar(10) NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
    needed_by       date,
    status          request_status NOT NULL DEFAULT 'rascunho',
    estimated_total numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_total >= 0),
    submitted_at    timestamptz,
    closed_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    UNIQUE (organization_id, number)
);
CREATE INDEX idx_pr_status ON purchase_requests(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_pr_requester ON purchase_requests(requester_id);

CREATE TABLE purchase_request_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    line_no         smallint NOT NULL,
    description     varchar(255) NOT NULL,
    unit            varchar(15) NOT NULL DEFAULT 'un',
    quantity        numeric(14,3) NOT NULL CHECK (quantity > 0),
    estimated_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (estimated_price >= 0),
    UNIQUE (request_id, line_no)
);

-- =============================================================================
--  MOTOR DE APROVAÇÃO
-- =============================================================================
-- Regras configuráveis por organização (faixa de valor -> nível exigido)
CREATE TABLE approval_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id   uuid REFERENCES departments(id) ON DELETE CASCADE,   -- NULL = todas
    category_id     uuid REFERENCES categories(id) ON DELETE CASCADE,    -- NULL = todas
    min_amount      numeric(14,2) NOT NULL DEFAULT 0,
    max_amount      numeric(14,2),                                       -- NULL = infinito
    level           smallint NOT NULL CHECK (level BETWEEN 1 AND 10),
    approver_role   user_role NOT NULL DEFAULT 'aprovador',
    is_active       boolean NOT NULL DEFAULT true,
    CHECK (max_amount IS NULL OR max_amount > min_amount)
);
CREATE INDEX idx_approval_rules_org ON approval_rules(organization_id, is_active);

-- Instância do fluxo criada quando a solicitação é submetida
CREATE TABLE approval_workflows (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      uuid NOT NULL UNIQUE REFERENCES purchase_requests(id) ON DELETE CASCADE,
    current_level   smallint NOT NULL DEFAULT 1,
    status          approval_decision NOT NULL DEFAULT 'pendente',
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz
);

CREATE TABLE approval_steps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     uuid NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    level           smallint NOT NULL,
    approver_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    decision        approval_decision NOT NULL DEFAULT 'pendente',
    decided_at      timestamptz,
    comment         text,
    delegated_to    uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workflow_id, level)
);
CREATE INDEX idx_approval_steps_pending ON approval_steps(approver_id, decision)
    WHERE decision = 'pendente';

-- =============================================================================
--  COTAÇÕES
-- =============================================================================
CREATE SEQUENCE seq_quotation_number START 1000;

CREATE TABLE quotations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    request_id      uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    number          varchar(20) NOT NULL DEFAULT ('COT-' || nextval('seq_quotation_number')),
    buyer_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    deadline        date,
    status          varchar(15) NOT NULL DEFAULT 'aberta'
                      CHECK (status IN ('aberta', 'em_analise', 'concluida', 'cancelada')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, number)
);

-- Uma proposta de um fornecedor dentro da cotação
CREATE TABLE quotation_offers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id    uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status          quotation_status NOT NULL DEFAULT 'aberta',
    payment_terms   varchar(120),
    delivery_days   smallint CHECK (delivery_days >= 0),
    freight_amount  numeric(14,2) NOT NULL DEFAULT 0 CHECK (freight_amount >= 0),
    total_amount    numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    is_selected     boolean NOT NULL DEFAULT false,
    responded_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (quotation_id, supplier_id)
);
CREATE UNIQUE INDEX uq_quotation_single_selected
    ON quotation_offers(quotation_id) WHERE is_selected;

CREATE TABLE quotation_offer_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id        uuid NOT NULL REFERENCES quotation_offers(id) ON DELETE CASCADE,
    request_item_id uuid NOT NULL REFERENCES purchase_request_items(id) ON DELETE RESTRICT,
    unit_price      numeric(14,4) NOT NULL CHECK (unit_price >= 0),
    quantity        numeric(14,3) NOT NULL CHECK (quantity > 0),
    line_total      numeric(14,2) GENERATED ALWAYS AS (round(unit_price * quantity, 2)) STORED,
    UNIQUE (offer_id, request_item_id)
);

-- =============================================================================
--  PEDIDOS DE COMPRA
-- =============================================================================
CREATE SEQUENCE seq_po_number START 1000;

CREATE TABLE purchase_orders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    number          varchar(20) NOT NULL DEFAULT ('PC-' || nextval('seq_po_number')),
    request_id      uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE RESTRICT,
    quotation_offer_id uuid REFERENCES quotation_offers(id) ON DELETE SET NULL,
    supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    cost_center_id  uuid NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT,
    issued_by       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          po_status NOT NULL DEFAULT 'emitido',
    payment_terms   varchar(120),
    delivery_address jsonb NOT NULL DEFAULT '{}'::jsonb,
    expected_date   date,
    subtotal        numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    freight_amount  numeric(14,2) NOT NULL DEFAULT 0 CHECK (freight_amount >= 0),
    discount_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount    numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    issued_at       timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, number)
);
CREATE INDEX idx_po_status ON purchase_orders(organization_id, status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);

CREATE TABLE purchase_order_items (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_no         smallint NOT NULL,
    description     varchar(255) NOT NULL,
    unit            varchar(15) NOT NULL DEFAULT 'un',
    quantity        numeric(14,3) NOT NULL CHECK (quantity > 0),
    unit_price      numeric(14,4) NOT NULL CHECK (unit_price >= 0),
    received_qty    numeric(14,3) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    line_total      numeric(14,2) GENERATED ALWAYS AS (round(unit_price * quantity, 2)) STORED,
    UNIQUE (purchase_order_id, line_no)
);

-- FK adiada de supplier_evaluations -> purchase_orders
ALTER TABLE supplier_evaluations
    ADD CONSTRAINT fk_supplier_eval_po
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;

-- =============================================================================
--  CONTRATOS (para alertas de vencimento)
-- =============================================================================
CREATE TABLE contracts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id     uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    code            varchar(40) NOT NULL,
    description     varchar(255) NOT NULL,
    start_date      date NOT NULL,
    end_date        date NOT NULL,
    total_value     numeric(14,2) NOT NULL DEFAULT 0,
    auto_renew      boolean NOT NULL DEFAULT false,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, code),
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_contracts_expiry ON contracts(end_date) WHERE is_active;

-- =============================================================================
--  NOTIFICAÇÕES
-- =============================================================================
CREATE TABLE notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         notification_channel NOT NULL DEFAULT 'in_app',
    event_type      varchar(50) NOT NULL,      -- 'approval.pending', 'contract.expiring'...
    title           varchar(160) NOT NULL,
    body            text,
    link            varchar(255),
    read_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;

-- =============================================================================
--  AUDITORIA (append-only, alimentada por trigger)
-- =============================================================================
CREATE TABLE audit_logs (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid,
    actor_id        uuid,                       -- app.current_user_id (SET LOCAL)
    action          varchar(10) NOT NULL,       -- INSERT | UPDATE | DELETE
    entity          varchar(60) NOT NULL,
    entity_id       text NOT NULL,
    old_data        jsonb,
    new_data        jsonb,
    changed_fields  text[],
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_org_time ON audit_logs(organization_id, created_at DESC);

-- =============================================================================
--  TRIGGERS
-- =============================================================================
-- 1) updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at' AND table_schema = 'public'
    LOOP
        EXECUTE format(
          'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
END$$;

-- 2) Trilha de auditoria genérica
CREATE OR REPLACE FUNCTION fn_audit() RETURNS trigger AS $$
DECLARE
    v_actor  uuid := nullif(current_setting('app.current_user_id', true), '')::uuid;
    v_ip     inet := nullif(current_setting('app.client_ip', true), '')::inet;
    v_org    uuid;
    v_old    jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_new    jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_fields text[];
BEGIN
    v_org := COALESCE((v_new->>'organization_id')::uuid, (v_old->>'organization_id')::uuid);

    -- Tabelas-filhas não têm organization_id: resolve pelo pai
    IF v_org IS NULL THEN
        v_org := CASE TG_TABLE_NAME
          WHEN 'approval_steps' THEN (
            SELECT pr.organization_id FROM approval_workflows w
              JOIN purchase_requests pr ON pr.id = w.request_id
             WHERE w.id = COALESCE(v_new->>'workflow_id', v_old->>'workflow_id')::uuid)
          WHEN 'approval_workflows' THEN (
            SELECT organization_id FROM purchase_requests
             WHERE id = COALESCE(v_new->>'request_id', v_old->>'request_id')::uuid)
          WHEN 'purchase_request_items' THEN (
            SELECT organization_id FROM purchase_requests
             WHERE id = COALESCE(v_new->>'request_id', v_old->>'request_id')::uuid)
          WHEN 'purchase_order_items' THEN (
            SELECT organization_id FROM purchase_orders
             WHERE id = COALESCE(v_new->>'purchase_order_id', v_old->>'purchase_order_id')::uuid)
          WHEN 'quotation_offers' THEN (
            SELECT organization_id FROM quotations
             WHERE id = COALESCE(v_new->>'quotation_id', v_old->>'quotation_id')::uuid)
          WHEN 'budget_movements' THEN (
            SELECT b.organization_id FROM budgets b
             WHERE b.id = COALESCE(v_new->>'budget_id', v_old->>'budget_id')::uuid)
          ELSE NULL END;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT array_agg(key) INTO v_fields
        FROM jsonb_each(v_new)
        WHERE v_new -> key IS DISTINCT FROM v_old -> key;
        IF v_fields IS NULL THEN
            RETURN NEW;  -- nada mudou
        END IF;
    END IF;

    INSERT INTO audit_logs(organization_id, actor_id, action, entity, entity_id,
                           old_data, new_data, changed_fields, ip_address)
    VALUES (v_org, v_actor, TG_OP, TG_TABLE_NAME,
            COALESCE(v_new->>'id', v_old->>'id'),
            v_old, v_new, v_fields, v_ip);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'purchase_requests', 'purchase_request_items', 'approval_steps',
        'approval_workflows', 'quotations', 'quotation_offers',
        'purchase_orders', 'purchase_order_items', 'suppliers',
        'budgets', 'budget_movements', 'contracts', 'users', 'approval_rules'
    ]
    LOOP
        EXECUTE format(
          'CREATE TRIGGER trg_%1$s_audit
             AFTER INSERT OR UPDATE OR DELETE ON %1$I
             FOR EACH ROW EXECUTE FUNCTION fn_audit()', t);
    END LOOP;
END$$;

-- 3) Recalcular média de avaliação do fornecedor
CREATE OR REPLACE FUNCTION fn_supplier_rating() RETURNS trigger AS $$
BEGIN
    UPDATE suppliers s
    SET rating_avg = sub.avg_score
    FROM (
        SELECT supplier_id,
               round(avg((score_quality + score_deadline + score_price) / 3.0), 2) AS avg_score
        FROM supplier_evaluations
        WHERE supplier_id = COALESCE(NEW.supplier_id, OLD.supplier_id)
        GROUP BY supplier_id
    ) sub
    WHERE s.id = sub.supplier_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplier_rating
    AFTER INSERT OR UPDATE OR DELETE ON supplier_evaluations
    FOR EACH ROW EXECUTE FUNCTION fn_supplier_rating();

-- =============================================================================
--  VIEWS DE APOIO A DASHBOARD / RELATÓRIOS
-- =============================================================================
CREATE VIEW vw_spend_by_department AS
SELECT po.organization_id,
       d.id   AS department_id,
       d.name AS department_name,
       date_trunc('month', po.issued_at) AS month,
       count(*)               AS orders_count,
       sum(po.total_amount)   AS total_spent
FROM purchase_orders po
JOIN purchase_requests pr ON pr.id = po.request_id
JOIN departments d        ON d.id = pr.department_id
WHERE po.status <> 'cancelado'
GROUP BY po.organization_id, d.id, d.name, date_trunc('month', po.issued_at);

CREATE VIEW vw_top_suppliers AS
SELECT po.organization_id,
       s.id AS supplier_id,
       s.legal_name,
       count(*)             AS orders_count,
       sum(po.total_amount) AS total_spent,
       s.rating_avg
FROM purchase_orders po
JOIN suppliers s ON s.id = po.supplier_id
WHERE po.status <> 'cancelado'
GROUP BY po.organization_id, s.id, s.legal_name, s.rating_avg;

CREATE VIEW vw_savings AS  -- economia = (menor cotação recusada - cotação selecionada)
SELECT q.organization_id,
       q.request_id,
       min(o.total_amount) FILTER (WHERE NOT o.is_selected) AS best_rejected,
       min(o.total_amount) FILTER (WHERE o.is_selected)     AS selected_total,
       GREATEST(
         COALESCE(min(o.total_amount) FILTER (WHERE NOT o.is_selected), 0)
         - COALESCE(min(o.total_amount) FILTER (WHERE o.is_selected), 0), 0) AS savings
FROM quotations q
JOIN quotation_offers o ON o.quotation_id = q.id AND o.status = 'respondida'
GROUP BY q.organization_id, q.request_id;

CREATE VIEW vw_open_approvals AS
SELECT s.approver_id,
       w.request_id,
       pr.number,
       pr.title,
       pr.estimated_total,
       s.level,
       s.created_at AS waiting_since
FROM approval_steps s
JOIN approval_workflows w ON w.id = s.workflow_id
JOIN purchase_requests pr ON pr.id = w.request_id
WHERE s.decision = 'pendente' AND w.status = 'pendente';

COMMIT;

-- =============================================================================
--  FIM DO MODELO FÍSICO
-- =============================================================================
