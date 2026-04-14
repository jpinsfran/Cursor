-- ==========================================================================
-- Cadência outbound omnichannel (21 dias / 12 touchpoints) + conversa IA
-- Fonte de verdade para o orquestrador (SDR Outbound) e o agente (AGENTE DE OUTBOUND v2).
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1. Sessão: um lead ativo (ou encerrado) na cadência
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbound_cadencia_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK opcional para o scrape
  ifood_estabelecimento_id UUID REFERENCES ifood_estabelecimentos(id) ON DELETE SET NULL,

  -- Contato
  phone          TEXT NOT NULL,
  phone_e164     TEXT,
  email          TEXT,
  linkedin_url   TEXT,
  instagram_handle TEXT,

  -- Dados denormalizados do lead (para o agente IA ter tudo numa query)
  nome_lead      TEXT,
  nome_negocio   TEXT,
  bairro         TEXT,
  regiao         TEXT,
  cuisine        TEXT,
  price_range    TEXT,
  rating         TEXT,
  cnpj           TEXT,
  perfil_do_lead TEXT,
  rapport        TEXT,
  seguidores     TEXT,
  instagram_profile_url TEXT,
  ifood_url      TEXT,

  -- Radar denormalizado
  radar_url               TEXT,
  radar_score_geral       INTEGER,
  radar_score_reputacao   INTEGER,
  radar_score_digital     INTEGER,
  radar_score_competitivo INTEGER,
  radar_score_financeiro  INTEGER,
  radar_oportunidade_min  NUMERIC,
  radar_oportunidade_max  NUMERIC,

  -- Priorização
  tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),
  angulo_copy INTEGER CHECK (angulo_copy BETWEEN 1 AND 8),

  -- Estado da cadência
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN (
      'novo',
      'em_cadencia',
      'em_conversa',
      'agendado',
      'pausado',
      'opt_out',
      'perdido',
      'encerrado_breakup'
    )),

  primeiro_contato_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  dia_referencia          DATE,

  touchpoints_executados  TEXT[] NOT NULL DEFAULT '{}',
  ultimo_touchpoint_id    TEXT,
  proximo_touchpoint_id   TEXT,
  proximo_envio_at        TIMESTAMPTZ,

  cadencia_pausada  BOOLEAN NOT NULL DEFAULT false,
  pausa_motivo      TEXT,

  ultima_inbound_at       TIMESTAMPTZ,
  ultima_outbound_at      TIMESTAMPTZ,
  lead_respondeu_alguma_vez BOOLEAN NOT NULL DEFAULT false,

  -- Qualificação IA (atualizado pelo agente em conversa)
  temperatura TEXT CHECK (temperatura IN ('quente', 'morno', 'frio')),
  conversa_fase TEXT CHECK (conversa_fase IN (
    'abertura',
    'radar_enviado',
    'investigacao',
    'transicao_nola',
    'agendamento',
    'pos_agendamento'
  )),

  bant_budget    TEXT,
  bant_authority TEXT,
  bant_need      TEXT,
  bant_timeline  TEXT,

  -- Agendamento
  agendamento_at    TIMESTAMPTZ,
  agendamento_data  TIMESTAMPTZ,
  agendamento_link  TEXT,

  -- Encerramento / reativação
  opt_out_at    TIMESTAMPTZ,
  motivo_perda  TEXT,
  reativar_em   DATE,

  -- HubSpot
  hubspot_contact_id TEXT,
  hubspot_deal_id    TEXT,

  -- Flexível
  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocs_phone
  ON outbound_cadencia_sessions(phone);

CREATE INDEX IF NOT EXISTS idx_ocs_phone_e164
  ON outbound_cadencia_sessions(phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ocs_ifood
  ON outbound_cadencia_sessions(ifood_estabelecimento_id)
  WHERE ifood_estabelecimento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ocs_proximo_envio
  ON outbound_cadencia_sessions(proximo_envio_at)
  WHERE cadencia_pausada = false
    AND status IN ('novo', 'em_cadencia');

CREATE INDEX IF NOT EXISTS idx_ocs_status
  ON outbound_cadencia_sessions(status);

CREATE INDEX IF NOT EXISTS idx_ocs_em_conversa_silencio
  ON outbound_cadencia_sessions(ultima_inbound_at)
  WHERE status = 'em_conversa';

-- ---------------------------------------------------------------------------
-- 2. Eventos: cada envio ou recebimento (auditoria + contexto para o agente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbound_cadencia_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES outbound_cadencia_sessions(id) ON DELETE CASCADE,

  touchpoint_id  TEXT,
  canal          TEXT,
  formato        TEXT,
  direcao        TEXT NOT NULL CHECK (direcao IN ('outbound', 'inbound')),

  resumo          TEXT,
  mensagem_texto  TEXT,

  resultado       TEXT,
  n8n_execution_id TEXT,
  workflow_name    TEXT,

  -- Qualificação snapshot após esta interação
  temperatura_pos    TEXT,
  conversa_fase_pos  TEXT,
  agente_action      TEXT,

  bant_budget    TEXT,
  bant_authority TEXT,
  bant_need      TEXT,
  bant_timeline  TEXT,

  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oce_session_created
  ON outbound_cadencia_eventos(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oce_canal
  ON outbound_cadencia_eventos(canal)
  WHERE canal IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Métricas agregadas de copy (preenchidas por job diário)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbound_copy_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  bucket_inicio DATE NOT NULL,
  bucket_fim    DATE NOT NULL,

  angulo_copy INTEGER,
  formato     TEXT,
  canal       TEXT,
  tom         TEXT,

  enviados      INTEGER NOT NULL DEFAULT 0,
  respostas     INTEGER NOT NULL DEFAULT 0,
  agendamentos  INTEGER NOT NULL DEFAULT 0,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT outbound_copy_metrics_bucket_chk CHECK (bucket_fim >= bucket_inicio)
);

CREATE INDEX IF NOT EXISTS idx_ocm_bucket
  ON outbound_copy_metrics(bucket_inicio, bucket_fim);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ocm_unique_dim
  ON outbound_copy_metrics(
    bucket_inicio, bucket_fim,
    COALESCE(angulo_copy, -1),
    COALESCE(formato, ''),
    COALESCE(canal, ''),
    COALESCE(tom, '')
  );

-- ---------------------------------------------------------------------------
-- 4. View: sessão + estabelecimento + perfil + radar em uma query
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sessao_completa AS
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

-- ---------------------------------------------------------------------------
-- 5. Triggers updated_at
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ocs_updated_at ON outbound_cadencia_sessions;
CREATE TRIGGER trg_ocs_updated_at
  BEFORE UPDATE ON outbound_cadencia_sessions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
