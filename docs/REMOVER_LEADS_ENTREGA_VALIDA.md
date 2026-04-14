# Remover Leads com Entrega Valida (anti-reentrada na cadencia)

Este procedimento remove da base os leads que ja tiveram **entrega valida** segundo o arquivo de metricas profundo.

## Origem da lista e chave de remocao
- Arquivo: `docs/conversas-tracao-deep-metrics.json`
- Criterio usado:
  - `contacted = true`
  - `failed_without_delivery = false`
- Mapeamento robusto:
  - `session_id` do JSON -> `id` em `conversas/sessoes.csv`
  - de `conversas/sessoes.csv`, usa `ifood_estabelecimento_id` para remover no Supabase

## Script
- Arquivo: `deleteLeadsComEntregaValida.js`
- Remocao ocorre na tabela mae `ifood_estabelecimentos`.
- As tabelas filhas sao limpas por cascade (`leads_qualificados`, `leads_perfil`, etc.).

## Como rodar
1. Dry-run (recomendado primeiro):
   - `node deleteLeadsComEntregaValida.js --dry-run`
2. Execucao real:
   - `node deleteLeadsComEntregaValida.js`

Opcional: passar caminhos customizados:
- `node deleteLeadsComEntregaValida.js "docs/conversas-tracao-deep-metrics.json" "conversas/sessoes.csv" --dry-run`

## Variaveis obrigatorias
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_KEY`)

## Observacao importante
- Esta versao nao depende de nome do negocio; usa chaves de sessao e `ifood_estabelecimento_id`, reduzindo muito ambiguidades.
