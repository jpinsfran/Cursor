# Supabase – Estrutura e integração

Base de dados para armazenar cada etapa do pipeline de leads **sem alterar** o fluxo atual das planilhas. As escritas no Supabase são opcionais (só ocorrem se `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` ou `SUPABASE_ANON_KEY` estiverem definidos).

## Tabelas e relações

Todas as tabelas se relacionam por **ifood_estabelecimentos.id**. O identificador estável do restaurante é **ifood_url** (URL do iFood do estabelecimento).

| Tabela | Descrição | Quando é alimentada |
|--------|-----------|----------------------|
| **ifood_estabelecimentos** | Todos os estabelecimentos encontrados no scrape do iFood, incluindo `regiao` normalizada e `classificacao` por rating dentro da região | Após `scrapeIfoodLeads.js` gravar o CSV e nas sincronizações com Supabase |
| **leads_qualificados** | Estabelecimentos em que foi encontrado contato (telefone e/ou email) | Quando há telefone ou email na linha (ex.: após tratamento/atualização por CNPJ ou ao unificar) |
| **leads_perfil** | Perfil da loja e rapport: Instagram, perfil_do_lead, punch_line | Após `unificaIfoodInstagram.js` preencher perfil_do_lead/punch_line |
| **cardapio** | Cardápio atual (a ser preenchido pelo seu scrape de menu do iFood) | Por você, quando tiver o scraper de menu; tabela já criada |

## Como criar o schema no Supabase

1. No dashboard do Supabase: **SQL Editor** → New query.
2. Cole o conteúdo de `supabase/migrations/001_schema_leads.sql`.
3. Execute (Run).

Se o projeto já existe no Supabase, rode também `supabase/migrations/002_add_classificacao_ifood_estabelecimentos.sql` para adicionar a nova coluna `classificacao`.

## Variáveis de ambiente

No `.env` (ou no ambiente):

```env
SUPABASE_URL=https://seu-projeto.supabase.co
# Service role (recomendado): Project Settings → API → service_role (secret)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Ou, se preferir o nome alternativo:

```env
SUPABASE_SERVICE_KEY=eyJ...
```

**Ordem de leitura:** o código usa primeiro `SUPABASE_SERVICE_ROLE_KEY`, depois `SUPABASE_SERVICE_KEY`, depois `SUPABASE_ANON_KEY`. Para alimentar as tabelas com os scripts, use a **service_role** (bypass de RLS). A anon key só funciona se as políticas RLS permitirem insert/update.

## Onde cada etapa grava

- **scrapeIfoodLeads.js** – Após salvar o CSV, normaliza `regiao` e faz upsert em `ifood_estabelecimentos` (se Supabase estiver configurado).
- **unificaIfoodInstagram.js** – Após atualizar cada linha no CSV, mantém `regiao` normalizada, faz upsert em `ifood_estabelecimentos`, em `leads_perfil` e, se houver phone/email, em `leads_qualificados`.
- **cardapio** – Você alimenta quando tiver o scrape de menu (use `lib/supabaseLeads.js` → `upsertCardapio(ifoodUrl, payload)`).

## Script manual de sincronização

O script `syncLeadsToSupabase.js` lê um CSV (ex.: o unificado), normaliza `regiao`, calcula `classificacao` por região apenas em memória e sincroniza todas as linhas para as três tabelas (estabelecimentos, qualificados quando houver contato, perfil quando houver perfil_do_lead/punch_line). Assim a classificação fica só no Supabase, sem precisar existir na planilha.

```bash
node syncLeadsToSupabase.js ifoodLeads_unificado.csv
```

## Dependências

```bash
npm install
```

O `package.json` já inclui `@supabase/supabase-js` e `dotenv`. As variáveis do `.env` (incluindo `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`) são carregadas automaticamente ao rodar os scripts. Se não configurar o Supabase, os scripts continuam gerando apenas os CSVs.
