-- =============================================================================
--  SEED - dados de demonstração
--  Senha de todos os usuários: "admin123"
--  hash bcrypt: $2a$10$GG1X.cvpW4u8dwypsPUEI.5LoDuE2v8.b9aMYzFClsydziWZddCui
-- =============================================================================
BEGIN;

-- Organização
INSERT INTO organizations (id, legal_name, trade_name, tax_id, size) VALUES
 ('00000000-0000-0000-0000-000000000001', 'Compras Integradas Ltda', 'SIC Demo', '12345678000199', 'media');

-- Departamentos
INSERT INTO departments (id, organization_id, code, name) VALUES
 ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TI',  'Tecnologia da Informação'),
 ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ADM', 'Administrativo'),
 ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'OPS', 'Operações');

-- Centros de custo
INSERT INTO cost_centers (id, organization_id, department_id, code, name) VALUES
 ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'CC-TI-01',  'Infraestrutura TI'),
 ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'CC-ADM-01', 'Facilities'),
 ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'CC-OPS-01', 'Produção');

-- Usuários
INSERT INTO users (id, organization_id, department_id, full_name, email, password_hash, role, approval_limit) VALUES
 ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Ana Admin',      'admin@sic.dev',      '$2a$10$GG1X.cvpW4u8dwypsPUEI.5LoDuE2v8.b9aMYzFClsydziWZddCui', 'admin',       1000000),
 ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Bruno Gestor',   'gestor@sic.dev',     '$2a$10$GG1X.cvpW4u8dwypsPUEI.5LoDuE2v8.b9aMYzFClsydziWZddCui', 'gestor',      500000),
 ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Carla Aprovadora','aprovador@sic.dev', '$2a$10$GG1X.cvpW4u8dwypsPUEI.5LoDuE2v8.b9aMYzFClsydziWZddCui', 'aprovador',   50000),
 ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Diego Comprador','comprador@sic.dev', '$2a$10$GG1X.cvpW4u8dwypsPUEI.5LoDuE2v8.b9aMYzFClsydziWZddCui', 'comprador',   0),
 ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Erica Solicitante','user@sic.dev',   '$2a$10$GG1X.cvpW4u8dwypsPUEI.5LoDuE2v8.b9aMYzFClsydziWZddCui', 'solicitante', 0);

-- Categorias
INSERT INTO categories (id, organization_id, name, kind) VALUES
 ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Equipamentos de TI', 'material'),
 ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Material de Escritório', 'material'),
 ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Serviços de Manutenção', 'servico');

-- Fornecedores
INSERT INTO suppliers (id, organization_id, legal_name, trade_name, tax_id, email, status, created_by) VALUES
 ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'TechDistrib SA',   'TechDistrib', '11222333000144', 'vendas@techdistrib.com', 'ativo', '30000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Papelaria Central', 'PapelCentral','22333444000155', 'contato@papelcentral.com','ativo', '30000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'ManutPro Serviços', 'ManutPro',   '33444555000166', 'sac@manutpro.com',        'homologacao', '30000000-0000-0000-0000-000000000001');

INSERT INTO supplier_categories (supplier_id, category_id) VALUES
 ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002'),
 ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003');

-- Regras de aprovação (por faixa de valor)
INSERT INTO approval_rules (organization_id, min_amount, max_amount, level, approver_role) VALUES
 ('00000000-0000-0000-0000-000000000001',      0,   5000, 1, 'aprovador'),
 ('00000000-0000-0000-0000-000000000001',   5000,  50000, 2, 'gestor'),
 ('00000000-0000-0000-0000-000000000001',  50000,   NULL, 3, 'admin');

-- Orçamento 2026
INSERT INTO budgets (id, organization_id, cost_center_id, fiscal_year, period_month, amount_planned) VALUES
 ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2026, NULL, 300000),
 ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 2026, NULL, 120000),
 ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 2026, NULL, 500000);

-- Solicitação de exemplo (aprovada)
INSERT INTO purchase_requests (id, organization_id, requester_id, department_id, cost_center_id, category_id,
                               title, justification, priority, status, estimated_total, submitted_at) VALUES
 ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
  'Notebooks para equipe de desenvolvimento', 'Substituição de 5 notebooks fora de garantia.',
  'alta', 'aprovada', 32500, now() - interval '5 days');

INSERT INTO purchase_request_items (request_id, line_no, description, unit, quantity, estimated_price) VALUES
 ('70000000-0000-0000-0000-000000000001', 1, 'Notebook 16GB RAM / 512GB SSD', 'un', 5, 6500);

INSERT INTO approval_workflows (id, request_id, current_level, status, finished_at) VALUES
 ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 2, 'aprovado', now() - interval '3 days');

INSERT INTO approval_steps (workflow_id, level, approver_id, decision, decided_at, comment) VALUES
 ('80000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-000000000003', 'aprovado', now() - interval '4 days', 'OK'),
 ('80000000-0000-0000-0000-000000000001', 2, '30000000-0000-0000-0000-000000000002', 'aprovado', now() - interval '3 days', 'Aprovado dentro do orçamento');

-- Cotação + propostas
INSERT INTO quotations (id, organization_id, request_id, buyer_id, deadline, status) VALUES
 ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004',
  current_date + 7, 'concluida');

INSERT INTO quotation_offers (id, quotation_id, supplier_id, status, delivery_days, total_amount, is_selected, responded_at) VALUES
 ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'respondida', 10, 31000, true,  now() - interval '2 days'),
 ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'respondida', 15, 33500, false, now() - interval '2 days');

-- Pedido de compra emitido
INSERT INTO purchase_orders (id, organization_id, request_id, quotation_offer_id, supplier_id, cost_center_id,
                             issued_by, status, expected_date, subtotal, total_amount) VALUES
 ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000004', 'confirmado', current_date + 10, 31000, 31000);

INSERT INTO purchase_order_items (purchase_order_id, line_no, description, unit, quantity, unit_price) VALUES
 ('a0000000-0000-0000-0000-000000000001', 1, 'Notebook 16GB RAM / 512GB SSD', 'un', 5, 6200);

-- Movimentações orçamentárias
INSERT INTO budget_movements (budget_id, movement_type, amount, source_table, source_id, created_by) VALUES
 ('60000000-0000-0000-0000-000000000001', 'comprometido', 31000, 'purchase_orders', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004');

-- Contrato próximo do vencimento (dispara alerta)
INSERT INTO contracts (organization_id, supplier_id, code, description, start_date, end_date, total_value) VALUES
 ('00000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', 'CT-2025-014',
  'Manutenção predial preventiva', current_date - interval '11 months', current_date + interval '20 days', 84000);

-- Avaliação de fornecedor
INSERT INTO supplier_evaluations (supplier_id, purchase_order_id, evaluator_id, score_quality, score_deadline, score_price, comment) VALUES
 ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 5, 4, 4, 'Entrega no prazo, boa qualidade.');

COMMIT;
