-- ==========================================================================
-- 007: radars — rastrear envio do PDF ao lead (WhatsApp / agente)
-- Permite ao prompt e automações saberem se o Radar já foi entregue.
-- ==========================================================================

ALTER TABLE radars
  ADD COLUMN IF NOT EXISTS radar_enviado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS radar_enviado_em TIMESTAMPTZ;

COMMENT ON COLUMN radars.radar_enviado IS 'True quando o PDF do Radar foi enviado ao lead (ex.: tool Enviar Radar / WhatsApp).';
COMMENT ON COLUMN radars.radar_enviado_em IS 'Timestamp do primeiro envio ao lead; NULL se ainda não enviado.';

CREATE INDEX IF NOT EXISTS idx_radars_radar_enviado
  ON radars(radar_enviado)
  WHERE radar_enviado = false;

-- View: incluir flags de envio do radar (mesmo padrão da 006)
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
  r.whatsapp_followup,
  r.radar_enviado,
  r.radar_enviado_em
FROM outbound_cadencia_sessions s
LEFT JOIN ifood_estabelecimentos e
  ON e.id = s.ifood_estabelecimento_id
LEFT JOIN leads_perfil p
  ON p.ifood_estabelecimento_id = s.ifood_estabelecimento_id
LEFT JOIN radars r
  ON r.ifood_estabelecimento_id = s.ifood_estabelecimento_id;
