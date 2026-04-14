-- Radars: PDF personalizado por estabelecimento com scores, URL pública e mensagens WhatsApp.
-- FK para ifood_estabelecimentos.id; permite regenerar (upsert) sem perder histórico.

CREATE TABLE IF NOT EXISTS radars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifood_estabelecimento_id UUID NOT NULL REFERENCES ifood_estabelecimentos(id) ON DELETE CASCADE,

  pdf_url TEXT,
  slug TEXT,

  score_geral INTEGER,
  score_reputacao INTEGER,
  score_digital INTEGER,
  score_competitivo INTEGER,
  score_financeiro INTEGER,
  nivel TEXT,

  oportunidade_mensal_min NUMERIC,
  oportunidade_mensal_max NUMERIC,
  oportunidade_anual_min NUMERIC,
  oportunidade_anual_max NUMERIC,

  whatsapp_abertura TEXT,
  whatsapp_followup TEXT,

  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(ifood_estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_radars_estabelecimento ON radars(ifood_estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_radars_slug ON radars(slug);
CREATE INDEX IF NOT EXISTS idx_radars_score_geral ON radars(score_geral);

DROP TRIGGER IF EXISTS radars_updated_at ON radars;
CREATE TRIGGER radars_updated_at
  BEFORE UPDATE ON radars
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
