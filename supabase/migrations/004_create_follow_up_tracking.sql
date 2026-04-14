-- follow_up_tracking: rastreia o estado de follow-up de cada conversa do SDR Outbound
-- Fonte de verdade para cadência, tentativas e timing dos touchpoints

CREATE TABLE IF NOT EXISTS follow_up_tracking (
  id            BIGSERIAL PRIMARY KEY,
  session_id    TEXT UNIQUE NOT NULL,          -- ex: chat_outbound_5511999999999
  phone         TEXT NOT NULL,                 -- telefone do lead (com DDI)
  touchpoint    INTEGER DEFAULT 1,             -- touchpoint atual (1-7)
  attempts      INTEGER DEFAULT 0,             -- total de follow-ups enviados
  last_message_at TIMESTAMPTZ DEFAULT NOW(),   -- data/hora da última msg do agente
  first_contact_at TIMESTAMPTZ DEFAULT NOW(),  -- data/hora do primeiro contato (TP1)
  lead_responded BOOLEAN DEFAULT FALSE,        -- true quando o lead responde
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'stopped', 'breakup')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_tracking_status
  ON follow_up_tracking(status);

CREATE INDEX IF NOT EXISTS idx_followup_tracking_phone
  ON follow_up_tracking(phone);

CREATE INDEX IF NOT EXISTS idx_followup_tracking_session
  ON follow_up_tracking(session_id);

CREATE INDEX IF NOT EXISTS idx_followup_tracking_last_msg
  ON follow_up_tracking(last_message_at)
  WHERE status = 'active' AND lead_responded = FALSE;

CREATE OR REPLACE FUNCTION update_followup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_followup_updated_at ON follow_up_tracking;
CREATE TRIGGER trg_followup_updated_at
  BEFORE UPDATE ON follow_up_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_followup_updated_at();
