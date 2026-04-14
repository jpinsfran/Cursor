-- ============================================================================
-- 016 — Quebra de silêncio (em_conversa): 3h sem resposta do lead, até 2 toques;
--         após a 2ª mensagem, volta à cadência normal (status em_cadencia).
-- ============================================================================

ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS quebra_silencio_tentativas INTEGER NOT NULL DEFAULT 0;

ALTER TABLE outbound_cadencia_sessions
  DROP CONSTRAINT IF EXISTS ocs_quebra_silencio_tentativas_chk;
ALTER TABLE outbound_cadencia_sessions
  ADD CONSTRAINT ocs_quebra_silencio_tentativas_chk
  CHECK (quebra_silencio_tentativas >= 0 AND quebra_silencio_tentativas <= 2);

COMMENT ON COLUMN outbound_cadencia_sessions.quebra_silencio_tentativas IS
  'Mensagens QUEBRA_SILENCIO já enviadas (0–2). Zera automaticamente quando ultima_inbound_at avança (trigger).';

CREATE OR REPLACE FUNCTION outbound_reset_quebra_silencio_on_inbound()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ultima_inbound_at IS NOT NULL
     AND (OLD.ultima_inbound_at IS NULL OR NEW.ultima_inbound_at > OLD.ultima_inbound_at) THEN
    NEW.quebra_silencio_tentativas := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outbound_reset_quebra_silencio_on_inbound ON outbound_cadencia_sessions;
CREATE TRIGGER trg_outbound_reset_quebra_silencio_on_inbound
  BEFORE UPDATE OF ultima_inbound_at ON outbound_cadencia_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE outbound_reset_quebra_silencio_on_inbound();

ALTER TABLE outbound_cadencia_eventos
  DROP CONSTRAINT IF EXISTS oce_message_kind_chk;
ALTER TABLE outbound_cadencia_eventos
  ADD CONSTRAINT oce_message_kind_chk
  CHECK (
    message_kind IS NULL OR
    message_kind IN (
      'mensagem_inicial',
      'resposta_agente',
      'reforco_1h',
      'followup_d1_9h',
      'resposta_lead',
      'quebra_silencio'
    )
  );
