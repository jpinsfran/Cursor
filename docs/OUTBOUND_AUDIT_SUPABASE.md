# Auditoria Supabase — outbound e entorno (repo)

**Escopo:** objetos em `supabase/migrations/` usados pelo outbound. **Data de referência:** alinhado ao plano “ecossistema Outbound NOLA”.

## Legenda

| Ação | Significado |
|------|-------------|
| **Manter** | Core do produto; continuar evoluindo com migrations. |
| **Consolidar** | Unificar consumo (uma view, um contrato de evento); evitar duas “fontes da verdade”. |
| **Deprecar / congelar** | Não expandir; leitura histórica ou migração futura para desligar. |

## Tabelas

| Objeto | Ação | Notas |
|--------|------|-------|
| `ifood_estabelecimentos` | Manter | Upstream; FK opcional em `outbound_cadencia_sessions`. |
| `leads_qualificados` | Manter | Gate de contato utilizável antes/enriquecimento de perfil. |
| `leads_perfil` | Manter | **Feed principal de interesse** (perfil + rapport); entra em `v_sessao_completa` via JOIN. |
| `radars` | Manter | Instrumento de copy/contexto; denormalizado na sessão para o agente. |
| `outbound_cadencia_sessions` | Manter | Estado único da cadência + campos IA/contrato 012/013/014/015. |
| `outbound_cadencia_eventos` | Manter | Timeline; usar sempre `message_kind` / `touchpoint_id` para métricas. |
| `outbound_copy_metrics` | Consolidar | Agregador diário; deve bater com definições de “resposta” em eventos. |
| `follow_up_tracking` | Deprecar / congelar | Modelo paralelo (`session_id` texto); não substitui UUID da sessão. Export opcional em `exportConversasSupabase.js`. |

## Views e funções

| Objeto | Ação | Notas |
|--------|------|-------|
| `v_sessao_completa` | Manter | JOIN sessão + estabelecimento + `leads_perfil` + `radars`. |
| `v_d1_wa_variacao_metricas` | Consolidar com métricas | Mesma família que `d1_wa_variacao_metricas(from,to)` e RPC rotação D1. |
| `next_d1_wa_variacao()` | Manter | Rotação 1–3 para D1_WA. |
| `try_claim_outbound_session` / `release_outbound_dispatch_lease` | Manter | Migration `015_outbound_dispatch_lease.sql`; uso pelo orquestrador n8n. |

## RLS e API

- Escrita outbound pelo n8n costuma usar **service role**; revisar na instância se há políticas que conflitem com automações.
- RPCs públicas: expor apenas o necessário; `try_claim_*` deve permanecer restrito a `service_role` (já concedido na 015).

## Próximos passos (não automáticos)

1. Preencher [`OUTBOUND_QUESTIONARIO_ESTRATEGICO.md`](OUTBOUND_QUESTIONARIO_ESTRATEGICO.md) para decidir política de sessão por `leads_perfil`.
2. Rodar verificação de schema: [`verify_outbound_migrations_012_013.sql`](../supabase/verify_outbound_migrations_012_013.sql) e [`verify_outbound_migration_015.sql`](../supabase/verify_outbound_migration_015.sql).
