# Matriz de QA — SDR Outbound (cadência + lease)

Pré-requisitos: migration `015_outbound_dispatch_lease.sql` aplicada; variável de ambiente `UAZAPI_TOKEN` no n8n; workflow importado/atualizado a partir de [`workflows/sdr-outbound-workflow.json`](../workflows/sdr-outbound-workflow.json).

| # | Cenário | Passos | Resultado esperado |
|---|---------|--------|---------------------|
| 1 | Lease impede duplicata | Duas execuções manuais **ao mesmo tempo** no mesmo `session_id` elegível | Uma obtém `_dispatch_claimed`; a outra falha o claim e volta ao `Um lead por vez` sem enviar WA |
| 2 | Inbound após outbound | Com `ultima_inbound_at` > `ultima_outbound_at` e status `em_cadencia` | Sessão **não** passa em **Filtrar vencidos** (nada na fila) |
| 3 | Skip libera lease | Touchpoint com `skip: true` (ex.: fora da janela D1) até **Supabase — reagendar skip** | Colunas `outbound_dispatch_*` nulas após update |
| 4 | Sucesso envio | Ramo feliz até **Supabase — atualizar sessão** | `ultima_outbound_at` atualizada e lease nulo |
| 5 | Falha UAZAPI | Forçar erro no envio (ramo **Error?** true) | Evento `falha_envio` + **reagendar após falha** com lease nulo |
| 6 | Reforço com lead já respondido | `ultima_inbound_at` mais recente que `ultima_outbound_at` | **Preparar touchpoint** não escolhe `REFORCO_1H` / follow-up virtual |

## Monitoramento contínuo

- Consultas em [`FORENSE_OUTBOUND_CADENCIA.sql`](FORENSE_OUTBOUND_CADENCIA.sql).
- Checklist n8n em [`MONITOR_OUTBOUND_SPAM.md`](MONITOR_OUTBOUND_SPAM.md).

## Regredir sync JSON ↔ fontes

```bash
node workflows/sync-sdr-outbound-workflow.cjs
```
