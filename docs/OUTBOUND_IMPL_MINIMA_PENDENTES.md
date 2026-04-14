# Implementações mínimas pendentes — ecossistema Outbound

Lista objetiva pós-plano. **Não substitui** respostas ao [`OUTBOUND_QUESTIONARIO_ESTRATEGICO.md`](OUTBOUND_QUESTIONARIO_ESTRATEGICO.md); alguns itens dependem delas.

## Já no repositório (referência)

| Item | Onde |
|------|------|
| Lease no orquestrador | `015_outbound_dispatch_lease.sql`; nó **Claim dispatch lease** chama RPC `try_claim_outbound_session` (ver [`sdr-outbound-claim-dispatch-lease.js`](../workflows/sdr-outbound-claim-dispatch-lease.js)) |
| Filtro inbound > outbound | [`sdr-outbound-filtrar-vencidos.js`](../workflows/sdr-outbound-filtrar-vencidos.js) |
| Reforço só `novo`/`em_cadencia` + inbound check | [`sdr-outbound-prepare-touchpoint.js`](../workflows/sdr-outbound-prepare-touchpoint.js) |
| Verificação SQL 015 | [`verify_outbound_migration_015.sql`](../supabase/verify_outbound_migration_015.sql) |

## Pendentes (código ou config)

1. **Variável `UAZAPI_TOKEN`** na instância n8n (workflow usa `$env.UAZAPI_TOKEN`).
2. **Agente Outbound v2:** antes de envio **proativo** (não resposta direta ao webhook), validar sessão (ex.: não competir com lease do orquestrador ou exigir `status`/pausa). Checklist em [`OUTBOUND_AUDIT_N8N.md`](OUTBOUND_AUDIT_N8N.md) § Agente. *Resposta inbound pode seguir regra de produto separada.*
3. **Webhook inbound:** garantir atualização de `ultima_inbound_at` e transição de status conforme [`INBOUND_OUTBOUND_SESSAO_CONTRATO.md`](INBOUND_OUTBOUND_SESSAO_CONTRATO.md).
4. **CRM:** mapear campos HubSpot (ou outro) após respostas do agente — *depende de E.2.*
5. **Drift:** reimportar workflow SDR após pull do Git; rodar `node workflows/sync-sdr-outbound-workflow.cjs` quando alterar só os `.js`.

## Fora de escopo imediato

- Fila Redis/BullMQ (alternativa de médio prazo).
- Novas colunas `ultima_outbound_orquestrador_at` / `ultima_outbound_agente_at` — só se métricas mostrarem colisão frequente.
