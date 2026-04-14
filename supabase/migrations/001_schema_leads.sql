-- Schema Nola: estabelecimentos iFood → qualificados (contato) → perfil/rapport → cardapio
-- Chave de relação: ifood_estabelecimentos.id (referenciado por ifood_url como identificador único do restaurante)

-- 1) Todos os estabelecimentos encontrados no scrape do iFood
CREATE TABLE IF NOT EXISTS ifood_estabelecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifood_url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  cnpj TEXT,
  street_address TEXT,
  neighborhood TEXT,
  zipcode TEXT,
  rating TEXT,
  email TEXT,
  cuisine TEXT,
  price_range TEXT,
  regiao TEXT,
  classificacao INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ifood_estabelecimentos_ifood_url ON ifood_estabelecimentos(ifood_url);
CREATE INDEX IF NOT EXISTS idx_ifood_estabelecimentos_name ON ifood_estabelecimentos(name);
CREATE INDEX IF NOT EXISTS idx_ifood_estabelecimentos_regiao ON ifood_estabelecimentos(regiao);
CREATE INDEX IF NOT EXISTS idx_ifood_estabelecimentos_regiao_classificacao ON ifood_estabelecimentos(regiao, classificacao);

-- 2) Qualificados: estabelecimentos em que encontramos contato (telefone/email)
CREATE TABLE IF NOT EXISTS leads_qualificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifood_estabelecimento_id UUID NOT NULL REFERENCES ifood_estabelecimentos(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ifood_estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_qualificados_estabelecimento ON leads_qualificados(ifood_estabelecimento_id);

-- 3) Perfil e rapport: Instagram + perfil_do_lead + punch_line
CREATE TABLE IF NOT EXISTS leads_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifood_estabelecimento_id UUID NOT NULL REFERENCES ifood_estabelecimentos(id) ON DELETE CASCADE,
  instagram_url TEXT,
  instagram_profile_url TEXT,
  instagram_user_id TEXT,
  seguidores TEXT,
  perfil_do_lead TEXT,
  punch_line TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ifood_estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_perfil_estabelecimento ON leads_perfil(ifood_estabelecimento_id);

-- 4) Cardápio atual (a ser preenchido pelo scrape de menu do iFood que você fornecerá)
CREATE TABLE IF NOT EXISTS cardapio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifood_estabelecimento_id UUID NOT NULL REFERENCES ifood_estabelecimentos(id) ON DELETE CASCADE,
  payload JSONB,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ifood_estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_cardapio_estabelecimento ON cardapio(ifood_estabelecimento_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ifood_estabelecimentos_updated_at ON ifood_estabelecimentos;
CREATE TRIGGER ifood_estabelecimentos_updated_at
  BEFORE UPDATE ON ifood_estabelecimentos
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS leads_perfil_updated_at ON leads_perfil;
CREATE TRIGGER leads_perfil_updated_at
  BEFORE UPDATE ON leads_perfil
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
