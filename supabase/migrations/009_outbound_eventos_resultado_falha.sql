-- Documentação: valores usados em outbound_cadencia_eventos.resultado pelo SDR Outbound / n8n.
-- Coluna já é TEXT sem CHECK; apenas comentário para o time.

COMMENT ON COLUMN outbound_cadencia_eventos.resultado IS
  'Resultado do envio/recebimento. Ex.: enviado | falha_envio | (outros conforme fluxos).';

COMMENT ON COLUMN outbound_cadencia_eventos.metadata IS
  'JSON livre. Em falha UAZAPI: uazapi_http_status, uazapi_error_message, uazapi_error_body, falha_motivo.';
