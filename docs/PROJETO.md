# SIC — Documentação do Projeto

## 1. Metodologia

1. **Análise de requisitos** — levantamento das dores no processo de compras.
2. **Identificação de stakeholders** — quem influencia ou é impactado.
3. **Personas e jornadas** — comportamento e objetivos dos usuários-chave.
4. **Funcionalidades essenciais** — recorte do que entrega valor.
5. **Prototipação** — validação de navegação (refletida no frontend).
6. **Especificação do MVP** — escopo mínimo entregável.

## 2. Stakeholders

| Stakeholder | Interesse |
|---|---|
| Solicitante (colaborador) | Registrar necessidade e acompanhar status |
| Aprovador / Gestor de área | Controlar gasto dentro da alçada e do orçamento |
| Comprador / Suprimentos | Cotar, negociar e emitir pedidos |
| Financeiro / Controladoria | Execução orçamentária e conformidade |
| Auditoria / Compliance | Rastreabilidade das decisões |
| Fornecedor | Receber solicitações de cotação e pedidos |
| Diretoria | Indicadores estratégicos e economia gerada |

## 3. Personas

**Erica — Solicitante (Operações)**
Precisa de insumos rápido, não conhece o processo de compras, quer transparência sobre "onde está meu pedido".

**Carla — Aprovadora (Coordenação Administrativa)**
Recebe dezenas de pedidos por semana, precisa aprovar/reprovar com contexto (valor, orçamento, justificativa) em poucos cliques.

**Diego — Comprador (Suprimentos)**
Trabalha com múltiplos fornecedores, precisa comparar cotações lado a lado e provar a economia obtida.

**Bruno — Gestor Financeiro**
Acompanha o orçamento comprometido x realizado por centro de custo e cobra previsibilidade.

## 4. Jornadas de usuário

### Jornada do solicitante
Percebe a necessidade → cria solicitação com itens e justificativa → envia → acompanha aprovação → recebe notificação de conclusão.

### Jornada do aprovador
Recebe alerta → abre a fila de aprovações → analisa valor, orçamento e justificativa → aprova/reprova com comentário → o fluxo avança de nível ou encerra.

### Jornada do comprador
Solicitação aprovada entra na fila → abre cotação com N fornecedores → registra propostas → seleciona a vencedora → emite o pedido → acompanha entrega e avalia o fornecedor.

## 5. MVP

**Incluído**
- Autenticação + RBAC (5 papéis)
- Solicitação de compra com itens
- Motor de aprovação por alçada e nível (configurável)
- Cotação multi-fornecedor + seleção
- Pedido de compra + compromisso orçamentário
- Controle orçamentário (planejado / comprometido / realizado / disponível)
- Cadastro e avaliação de fornecedores
- Dashboard, relatórios (com export CSV) e trilha de auditoria
- Notificações in-app + job de alertas (contratos, aprovações paradas)

**Fora do MVP (evolução)**
- Portal do fornecedor (resposta de cotação pelo próprio fornecedor)
- Recebimento com conferência fiscal / integração com NF-e
- Integração contábil/ERP e SSO corporativo
- Anexos em storage externo (S3) e assinatura eletrônica
- App mobile e envio real de e-mail/push

## 6. Arquitetura

```
landing/           Página estática de apresentação
  │
frontend/  (React SPA, Vite)  ──HTTP/JSON──▶  backend/  (Express REST)
                                                  │
                                                  ▼
                                          database/  (PostgreSQL)
                                          - triggers de auditoria
                                          - views de dashboard
                                          - livro-razão orçamentário
```

Detalhes de cada artefato nos READMEs de `database/` (via `ERD.md`), `backend/` e `frontend/`.
