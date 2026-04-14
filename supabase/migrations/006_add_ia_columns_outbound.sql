-- ==========================================================================
-- 006: Add IA-related columns to outbound_cadencia_sessions and eventos
-- Adds denormalized lead/radar data, BANT, temperatura, conversa_fase
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Sessions: denormalized lead data
-- ---------------------------------------------------------------------------
ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS nome_lead TEXT,
  ADD COLUMN IF NOT EXISTS nome_negocio TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS regiao TEXT,
  ADD COLUMN IF NOT EXISTS cuisine TEXT,
  ADD COLUMN IF NOT EXISTS price_range TEXT,
  ADD COLUMN IF NOT EXISTS rating TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS perfil_do_lead TEXT,
  ADD COLUMN IF NOT EXISTS rapport TEXT,
  ADD COLUMN IF NOT EXISTS seguidores TEXT,
  ADD COLUMN IF NOT EXISTS instagram_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS ifood_url TEXT;

-- ---------------------------------------------------------------------------
-- 2. Sessions: denormalized radar data
-- ---------------------------------------------------------------------------
ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS radar_url TEXT,
  ADD COLUMN IF NOT EXISTS radar_score_geral INTEGER,
  ADD COLUMN IF NOT EXISTS radar_score_reputacao INTEGER,
  ADD COLUMN IF NOT EXISTS radar_score_digital INTEGER,
  ADD COLUMN IF NOT EXISTS radar_score_competitivo INTEGER,
  ADD COLUMN IF NOT EXISTS radar_score_financeiro INTEGER,
  ADD COLUMN IF NOT EXISTS radar_oportunidade_min NUMERIC,
  ADD COLUMN IF NOT EXISTS radar_oportunidade_max NUMERIC;

-- ---------------------------------------------------------------------------
-- 3. Sessions: IA qualificação
-- ---------------------------------------------------------------------------
ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS temperatura TEXT,
  ADD COLUMN IF NOT EXISTS conversa_fase TEXT,
  ADD COLUMN IF NOT EXISTS bant_budget TEXT,
  ADD COLUMN IF NOT EXISTS bant_authority TEXT,
  ADD COLUMN IF NOT EXISTS bant_need TEXT,
  ADD COLUMN IF NOT EXISTS bant_timeline TEXT,
  ADD COLUMN IF NOT EXISTS agendamento_data TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agendamento_link TEXT,
  ADD COLUMN IF NOT EXISTS motivo_perda TEXT,
  ADD COLUMN IF NOT EXISTS reativar_em DATE;

-- Add CHECK constraints (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outbound_cadencia_sessions_temperatura_check'
  ) THEN
    ALTER TABLE outbound_cadencia_sessions
      ADD CONSTRAINT outbound_cadencia_sessions_temperatura_check
      CHECK (temperatura IN ('quente', 'morno', 'frio'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outbound_cadencia_sessions_conversa_fase_check'
  ) THEN
    ALTER TABLE outbound_cadencia_sessions
      ADD CONSTRAINT outbound_cadencia_sessions_conversa_fase_check
      CHECK (conversa_fase IN (
        'abertura', 'radar_enviado', 'investigacao',
        'transicao_nola', 'agendamento', 'pos_agendamento'
      ));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Eventos: IA snapshot columns
-- ---------------------------------------------------------------------------
ALTER TABLE outbound_cadencia_eventos
  ADD COLUMN IF NOT EXISTS temperatura_pos TEXT,
  ADD COLUMN IF NOT EXISTS conversa_fase_pos TEXT,
  ADD COLUMN IF NOT EXISTS agente_action TEXT,
  ADD COLUMN IF NOT EXISTS bant_budget TEXT,
  ADD COLUMN IF NOT EXISTS bant_authority TEXT,
  ADD COLUMN IF NOT EXISTS bant_need TEXT,
  ADD COLUMN IF NOT EXISTS bant_timeline TEXT;

-- ---------------------------------------------------------------------------
-- 5. Indexes for new columns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ocs_em_conversa_silencio
  ON outbound_cadencia_sessions(ultima_inbound_at)
  WHERE status = 'em_conversa';

CREATE INDEX IF NOT EXISTS idx_ocs_temperatura
  ON outbound_cadencia_sessions(temperatura)
  WHERE temperatura IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. View: sessão completa (drop + recreate — new table columns change s.*)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_sessao_completa;
CREATE VIEW v_sessao_completa AS
SELECT
  s.*,
  e.name        AS estab_name,
  e.street_address,
  e.neighborhood,
  e.zipcode,
  e.classificacao,
  p.perfil_do_lead  AS perfil_do_lead_perfil,
  p.punch_line      AS rapport_perfil,
  p.seguidores      AS seguidores_perfil,
  p.instagram_profile_url AS instagram_perfil,
  r.pdf_url         AS radar_pdf_url,
  r.slug            AS radar_slug,
  r.whatsapp_abertura,
  r.whatsapp_followup
FROM outbound_cadencia_sessions s
LEFT JOIN ifood_estabelecimentos e
  ON e.id = s.ifood_estabelecimento_id
LEFT JOIN leads_perfil p
  ON p.ifood_estabelecimento_id = s.ifood_estabelecimento_id
LEFT JOIN radars r
  ON r.ifood_estabelecimento_id = s.ifood_estabelecimento_id;
