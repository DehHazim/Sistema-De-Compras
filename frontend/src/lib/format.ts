export const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

export const date = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat('pt-BR').format(new Date(v)) : '—';

export const dateTime = (v: string | null | undefined) =>
  v ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : '—';

export const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_aprovacao: 'Em aprovação',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
  em_cotacao: 'Em cotação',
  em_pedido: 'Em pedido',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  emitido: 'Emitido',
  enviado_fornecedor: 'Enviado ao fornecedor',
  confirmado: 'Confirmado',
  recebido_parcial: 'Recebido parcial',
  recebido: 'Recebido',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
};

export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s;
