-- ============================================================================
-- 012 - Contrato de follow-up/métricas + fortalecimento do leads_perfil
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Sessões outbound: estado explícito de follow-up e métricas de parada
-- ---------------------------------------------------------------------------
ALTER TABLE outbound_cadencia_sessions
  ADD COLUMN IF NOT EXISTS ultimo_evento_aguardando_resposta_id UUID,
  ADD COLUMN IF NOT EXISTS ultimo_evento_aguardando_resposta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_evento_aguardando_resposta_tipo TEXT,
  ADD COLUMN IF NOT EXISTS reforco_1h_enviado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d1_9h_enviado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ponto_parada_touchpoint TEXT,
  ADD COLUMN IF NOT EXISTS ponto_parada_message_kind TEXT,
  ADD COLUMN IF NOT EXISTS primeira_resposta_positiva_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_response_actor TEXT,
  ADD COLUMN IF NOT EXISTS flag_resposta_bot BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_contato_errado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_numero_inexistente BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE outbound_cadencia_sessions
  DROP CONSTRAINT IF EXISTS ocs_ultimo_evento_aguardando_resposta_tipo_chk;
ALTER TABLE outbound_cadencia_sessions
  ADD CONSTRAINT ocs_ultimo_evento_aguardando_resposta_tipo_chk
  CHECK (
    ultimo_evento_aguardando_resposta_tipo IS NULL OR
    ultimo_evento_aguardando_resposta_tipo IN ('mensagem_inicial', 'resposta_agente')
  );

ALTER TABLE outbound_cadencia_sessions
  DROP CONSTRAINT IF EXISTS ocs_ultimo_response_actor_chk;
ALTER TABLE outbound_cadencia_sessions
  ADD CONSTRAINT ocs_ultimo_response_actor_chk
  CHECK (
    ultimo_response_actor IS NULL OR
    ultimo_response_actor IN ('humano', 'bot', 'desconhecido')
  );

CREATE INDEX IF NOT EXISTS idx_ocs_aguardando_resposta_at
  ON outbound_cadencia_sessions (ultimo_evento_aguardando_resposta_at)
  WHERE status IN ('novo', 'em_cadencia', 'em_conversa')
    AND cadencia_pausada = FALSE;

CREATE INDEX IF NOT EXISTS idx_ocs_followup_1h_pendente
  ON outbound_cadencia_sessions (ultimo_evento_aguardando_resposta_at)
  WHERE reforco_1h_enviado_at IS NULL
    AND status IN ('novo', 'em_cadencia', 'em_conversa')
    AND cadencia_pausada = FALSE;

CREATE INDEX IF NOT EXISTS idx_ocs_followup_d1_pendente
  ON outbound_cadencia_sessions (ultimo_evento_aguardando_resposta_at)
  WHERE followup_d1_9h_enviado_at IS NULL
    AND status IN ('novo', 'em_cadencia', 'em_conversa')
    AND cadencia_pausada = FALSE;

-- ---------------------------------------------------------------------------
-- 2) Eventos outbound/inbound: classificação explícita de mensagem/resposta
-- ---------------------------------------------------------------------------
ALTER TABLE outbound_cadencia_eventos
  ADD COLUMN IF NOT EXISTS message_kind TEXT,
  ADD COLUMN IF NOT EXISTS espera_resposta BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS janela_resposta_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_actor TEXT,
  ADD COLUMN IF NOT EXISTS contact_outcome TEXT;

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
      'resposta_lead'
    )
  );

ALTER TABLE outbound_cadencia_eventos
  DROP CONSTRAINT IF EXISTS oce_response_actor_chk;
ALTER TABLE outbound_cadencia_eventos
  ADD CONSTRAINT oce_response_actor_chk
  CHECK (
    response_actor IS NULL OR
    response_actor IN ('humano', 'bot', 'desconhecido')
  );

ALTER TABLE outbound_cadencia_eventos
  DROP CONSTRAINT IF EXISTS oce_contact_outcome_chk;
ALTER TABLE outbound_cadencia_eventos
  ADD CONSTRAINT oce_contact_outcome_chk
  CHECK (
    contact_outcome IS NULL OR
    contact_outcome IN ('ok', 'contato_errado', 'numero_inexistente')
  );

CREATE INDEX IF NOT EXISTS idx_oce_message_kind_created
  ON outbound_cadencia_eventos (message_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oce_response_actor_created
  ON outbound_cadencia_eventos (response_actor, created_at DESC)
  WHERE direcao = 'inbound';

-- ---------------------------------------------------------------------------
-- 3) Leads_perfil como tabela principal completa para consumo no n8n
-- ---------------------------------------------------------------------------
ALTER TABLE leads_perfil
  ADD COLUMN IF NOT EXISTS ifood_url TEXT,
  ADD COLUMN IF NOT EXISTS nome_negocio TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS zipcode TEXT,
  ADD COLUMN IF NOT EXISTS rating TEXT,
  ADD COLUMN IF NOT EXISTS cuisine TEXT,
  ADD COLUMN IF NOT EXISTS price_range TEXT,
  ADD COLUMN IF NOT EXISTS regiao TEXT,
  ADD COLUMN IF NOT EXISTS classificacao INTEGER,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_perfil_phone
  ON leads_perfil (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_perfil_regiao
  ON leads_perfil (regiao)
  WHERE regiao IS NOT NULL;

-- leads_perfil deve conter SOMENTE leads qualificados + com scrape de perfil.
-- 1) Remove linhas órfãs (não qualificadas)
DELETE FROM leads_perfil lp
WHERE NOT EXISTS (
  SELECT 1
  FROM leads_qualificados lq
  WHERE lq.ifood_estabelecimento_id = lp.ifood_estabelecimento_id
);

-- 1.1) Remove linhas incompletas: exige dados de lead + dados de perfil social
DELETE FROM leads_perfil
WHERE
  COALESCE(NULLIF(nome_negocio, ''), '') = ''
  OR COALESCE(NULLIF(phone, ''), '') = ''
  OR COALESCE(NULLIF(cnpj, ''), '') = ''
  OR (
    COALESCE(NULLIF(instagram_url, ''), '') = ''
    AND COALESCE(NULLIF(instagram_profile_url, ''), '') = ''
  )
  OR COALESCE(NULLIF(perfil_do_lead, ''), '') = ''
  OR COALESCE(NULLIF(punch_line, ''), '') = '';

-- 2) Garante vínculo forte com qualificados (1:1 por estabelecimento)
ALTER TABLE leads_perfil
  DROP CONSTRAINT IF EXISTS leads_perfil_ifood_qualificado_fk;
ALTER TABLE leads_perfil
  ADD CONSTRAINT leads_perfil_ifood_qualificado_fk
  FOREIGN KEY (ifood_estabelecimento_id)
  REFERENCES leads_qualificados(ifood_estabelecimento_id)
  ON DELETE CASCADE;

ALTER TABLE leads_perfil
  DROP CONSTRAINT IF EXISTS leads_perfil_completude_chk;
ALTER TABLE leads_perfil
  ADD CONSTRAINT leads_perfil_completude_chk
  CHECK (
    COALESCE(NULLIF(nome_negocio, ''), '') <> ''
    AND COALESCE(NULLIF(phone, ''), '') <> ''
    AND COALESCE(NULLIF(cnpj, ''), '') <> ''
    AND (
      COALESCE(NULLIF(instagram_url, ''), '') <> ''
      OR COALESCE(NULLIF(instagram_profile_url, ''), '') <> ''
    )
    AND COALESCE(NULLIF(perfil_do_lead, ''), '') <> ''
    AND COALESCE(NULLIF(punch_line, ''), '') <> ''
  );

-- 3) Atualiza campos-base apenas para registros já existentes no leads_perfil
UPDATE leads_perfil lp
SET
  ifood_url = e.ifood_url,
  nome_negocio = e.name,
  phone = q.phone,
  email = COALESCE(q.email, e.email),
  cnpj = e.cnpj,
  street_address = e.street_address,
  neighborhood = e.neighborhood,
  zipcode = e.zipcode,
  rating = e.rating,
  cuisine = e.cuisine,
  price_range = e.price_range,
  regiao = e.regiao,
  classificacao = e.classificacao,
  qualified_at = q.qualified_at,
  updated_at = now()
FROM ifood_estabelecimentos e
JOIN leads_qualificados q
  ON q.ifood_estabelecimento_id = e.id
WHERE lp.ifood_estabelecimento_id = e.id;

COMMENT ON COLUMN outbound_cadencia_eventos.message_kind IS
  'Tipo semântico do evento para métricas de cadência: mensagem_inicial, resposta_agente, reforco_1h, followup_d1_9h, resposta_lead.';

COMMENT ON COLUMN outbound_cadencia_eventos.contact_outcome IS
  'Classificação operacional do contato: ok, contato_errado, numero_inexistente.';
