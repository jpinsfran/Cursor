-- Tabela de endereços relevantes para scrape iFood por estado (single source of truth).
-- Fonte inicial: PLANO_SCRAPE_ESTADOS.md / run-scrapes-estado.js ENDERECOS_POR_ESTADO.
-- Cada endereço = zona de entrega; múltiplos endereços por UF cobrem o estado.

CREATE TABLE IF NOT EXISTS relevant_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  uf TEXT NOT NULL,
  city TEXT,
  label TEXT,
  execution_order INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(uf, address)
);

CREATE INDEX IF NOT EXISTS idx_relevant_addresses_uf ON relevant_addresses(uf);
CREATE INDEX IF NOT EXISTS idx_relevant_addresses_uf_order ON relevant_addresses(uf, execution_order) WHERE is_active = true;

COMMENT ON TABLE relevant_addresses IS 'Endereços usados como semente de busca no scrape iFood por estado; alimenta run-scrapes-estado.';

-- Trigger updated_at
DROP TRIGGER IF EXISTS relevant_addresses_updated_at ON relevant_addresses;
CREATE TRIGGER relevant_addresses_updated_at
  BEFORE UPDATE ON relevant_addresses
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
