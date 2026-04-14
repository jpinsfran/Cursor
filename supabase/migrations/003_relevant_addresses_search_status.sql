-- Status de execução por endereço para evitar repetição de busca no scraper.
ALTER TABLE relevant_addresses
  ADD COLUMN IF NOT EXISTS search_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_found_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_searched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_relevant_addresses_status
  ON relevant_addresses (uf, search_status, execution_order)
  WHERE is_active = true;

COMMENT ON COLUMN relevant_addresses.search_status IS 'pending | done | error. done = endereço já retornou resultados no scrape.';
COMMENT ON COLUMN relevant_addresses.last_found_count IS 'Quantidade de novos registros observados na última busca bem-sucedida.';
COMMENT ON COLUMN relevant_addresses.last_searched_at IS 'Timestamp da última tentativa de busca desse endereço.';
