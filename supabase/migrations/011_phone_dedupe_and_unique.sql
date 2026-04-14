-- Normaliza telefones (só dígitos), remove duplicatas por número, índices únicos.
-- Ordem: função → UPDATEs de normalização → fusão outbound_cadencia_sessions → fusão follow_up →
--         fusão ifood_estabelecimentos + filhos → índices únicos.

-- ---------------------------------------------------------------------------
-- 1) Função imutável: apenas dígitos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.phone_digits_normalized(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(t, ''), '[^0-9]', '', 'g'), '');
$$;

-- ---------------------------------------------------------------------------
-- 2) Normalizar colunas de telefone existentes
-- ---------------------------------------------------------------------------
UPDATE ifood_estabelecimentos
SET phone = public.phone_digits_normalized(phone)
WHERE phone IS NOT NULL AND phone <> public.phone_digits_normalized(phone);

UPDATE leads_qualificados
SET phone = public.phone_digits_normalized(phone)
WHERE phone IS NOT NULL AND phone <> public.phone_digits_normalized(phone);

UPDATE outbound_cadencia_sessions
SET
  phone = public.phone_digits_normalized(phone),
  phone_e164 = CASE
    WHEN length(public.phone_digits_normalized(phone)) >= 10
    THEN '+' || public.phone_digits_normalized(phone)
    ELSE phone_e164
  END
WHERE phone IS NOT NULL;

UPDATE follow_up_tracking
SET phone = public.phone_digits_normalized(phone)
WHERE phone IS NOT NULL AND phone <> public.phone_digits_normalized(phone);

-- ---------------------------------------------------------------------------
-- 3) outbound_cadencia_sessions: fundir sessões com o mesmo telefone (≥10 dígitos)
--    Mantém a sessão com updated_at mais recente (empate: created_at desc).
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    public.phone_digits_normalized(phone) AS ph,
    ROW_NUMBER() OVER (
      PARTITION BY public.phone_digits_normalized(phone)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM outbound_cadencia_sessions
  WHERE length(public.phone_digits_normalized(phone)) >= 10
),
pairs AS (
  SELECT w.id AS keeper_id, l.id AS loser_id
  FROM ranked w
  INNER JOIN ranked l ON w.ph = l.ph AND w.rn = 1 AND l.rn > 1
)
UPDATE outbound_cadencia_eventos e
SET session_id = p.keeper_id
FROM pairs p
WHERE e.session_id = p.loser_id;

DELETE FROM outbound_cadencia_sessions s
WHERE s.id IN (
  SELECT l.id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY public.phone_digits_normalized(phone)
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS rn
    FROM outbound_cadencia_sessions
    WHERE length(public.phone_digits_normalized(phone)) >= 10
  ) x
  JOIN outbound_cadencia_sessions l ON l.id = x.id
  WHERE x.rn > 1
);

-- ---------------------------------------------------------------------------
-- 4) follow_up_tracking: um registro por telefone (mantém o de id maior / mais recente)
-- ---------------------------------------------------------------------------
DELETE FROM follow_up_tracking f
WHERE f.id IN (
  SELECT t.id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY public.phone_digits_normalized(phone)
        ORDER BY updated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM follow_up_tracking
    WHERE length(public.phone_digits_normalized(phone)) >= 10
  ) t
  WHERE t.rn > 1
);

-- ---------------------------------------------------------------------------
-- 5) ifood_estabelecimentos: fundir por telefone (mantém created_at mais antigo)
--    Usa tabela temporária para os pares winner/loser em vários comandos.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _phone_estab_merge;
CREATE TEMP TABLE _phone_estab_merge (
  winner_id uuid NOT NULL,
  loser_id uuid NOT NULL,
  PRIMARY KEY (loser_id)
);

INSERT INTO _phone_estab_merge (winner_id, loser_id)
WITH ranked AS (
  SELECT
    id,
    public.phone_digits_normalized(phone) AS ph,
    ROW_NUMBER() OVER (
      PARTITION BY public.phone_digits_normalized(phone)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM ifood_estabelecimentos
  WHERE length(public.phone_digits_normalized(phone)) >= 10
)
SELECT w.id, l.id
FROM ranked w
INNER JOIN ranked l ON w.ph = l.ph AND w.rn = 1 AND l.rn > 1;

UPDATE outbound_cadencia_sessions s
SET ifood_estabelecimento_id = p.winner_id
FROM _phone_estab_merge p
WHERE s.ifood_estabelecimento_id = p.loser_id;

-- Uma linha proposta por winner_id (vários losers podem apontar pro mesmo winner)
INSERT INTO leads_qualificados (ifood_estabelecimento_id, phone, email, qualified_at)
SELECT DISTINCT ON (p.winner_id)
  p.winner_id,
  lq.phone,
  lq.email,
  lq.qualified_at
FROM leads_qualificados lq
INNER JOIN _phone_estab_merge p ON lq.ifood_estabelecimento_id = p.loser_id
ORDER BY p.winner_id, lq.qualified_at DESC NULLS LAST
ON CONFLICT (ifood_estabelecimento_id) DO UPDATE SET
  phone = COALESCE(NULLIF(EXCLUDED.phone, ''), leads_qualificados.phone),
  email = COALESCE(NULLIF(EXCLUDED.email, ''), leads_qualificados.email);

DELETE FROM leads_qualificados lq
WHERE lq.ifood_estabelecimento_id IN (SELECT loser_id FROM _phone_estab_merge);

INSERT INTO leads_perfil (
  ifood_estabelecimento_id,
  instagram_url,
  instagram_profile_url,
  instagram_user_id,
  seguidores,
  perfil_do_lead,
  punch_line,
  updated_at
)
SELECT DISTINCT ON (p.winner_id)
  p.winner_id,
  lp.instagram_url,
  lp.instagram_profile_url,
  lp.instagram_user_id,
  lp.seguidores,
  lp.perfil_do_lead,
  lp.punch_line,
  lp.updated_at
FROM leads_perfil lp
INNER JOIN _phone_estab_merge p ON lp.ifood_estabelecimento_id = p.loser_id
ORDER BY p.winner_id, lp.updated_at DESC NULLS LAST
ON CONFLICT (ifood_estabelecimento_id) DO UPDATE SET
  instagram_url = COALESCE(NULLIF(EXCLUDED.instagram_url, ''), leads_perfil.instagram_url),
  instagram_profile_url = COALESCE(NULLIF(EXCLUDED.instagram_profile_url, ''), leads_perfil.instagram_profile_url),
  instagram_user_id = COALESCE(NULLIF(EXCLUDED.instagram_user_id, ''), leads_perfil.instagram_user_id),
  seguidores = COALESCE(NULLIF(EXCLUDED.seguidores, ''), leads_perfil.seguidores),
  perfil_do_lead = COALESCE(NULLIF(EXCLUDED.perfil_do_lead, ''), leads_perfil.perfil_do_lead),
  punch_line = COALESCE(NULLIF(EXCLUDED.punch_line, ''), leads_perfil.punch_line),
  updated_at = GREATEST(leads_perfil.updated_at, EXCLUDED.updated_at);

DELETE FROM leads_perfil lp
WHERE lp.ifood_estabelecimento_id IN (SELECT loser_id FROM _phone_estab_merge);

UPDATE cardapio c
SET ifood_estabelecimento_id = p.winner_id
FROM _phone_estab_merge p
WHERE c.ifood_estabelecimento_id = p.loser_id
  AND NOT EXISTS (
    SELECT 1 FROM cardapio c2 WHERE c2.ifood_estabelecimento_id = p.winner_id
  );

DELETE FROM cardapio c
WHERE c.ifood_estabelecimento_id IN (SELECT loser_id FROM _phone_estab_merge);

UPDATE radars r
SET ifood_estabelecimento_id = p.winner_id
FROM _phone_estab_merge p
WHERE r.ifood_estabelecimento_id = p.loser_id
  AND NOT EXISTS (
    SELECT 1 FROM radars r2 WHERE r2.ifood_estabelecimento_id = p.winner_id
  );

DELETE FROM radars r
WHERE r.ifood_estabelecimento_id IN (SELECT loser_id FROM _phone_estab_merge);

DELETE FROM ifood_estabelecimentos e
WHERE e.id IN (SELECT loser_id FROM _phone_estab_merge);

DROP TABLE IF EXISTS _phone_estab_merge;

-- ---------------------------------------------------------------------------
-- 6) Índices únicos (telefone com ≥10 dígitos)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_ocs_phone;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ocs_phone_digits_unique
  ON outbound_cadencia_sessions (public.phone_digits_normalized(phone))
  WHERE length(public.phone_digits_normalized(phone)) >= 10;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ifood_estab_phone_digits_unique
  ON ifood_estabelecimentos (public.phone_digits_normalized(phone))
  WHERE length(public.phone_digits_normalized(phone)) >= 10;

CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_phone_digits_unique
  ON follow_up_tracking (public.phone_digits_normalized(phone))
  WHERE length(public.phone_digits_normalized(phone)) >= 10;

COMMENT ON FUNCTION public.phone_digits_normalized(text) IS 'Apenas dígitos; usado em índices únicos de telefone.';
