# Auditoria n8n — fluxos que impactam outbound (repo)

**Objetivo:** inventário dos JSON/JS em [`workflows/`](../workflows/) e relação com colisão de envio (orquestrador × agente × lembretes). A **instância** (`n8n.nola.com.br`) pode ter IDs e nós adicionais — comparar com export atual.

## Regra de ouro (produto)

Para cada `session_id`, deve existir **no máximo um** “dono” do próximo envio imediato: **orquestrador SDR Outbound**, **agente Outbound v2**, ou **nenhum** (pausa / encerrado). Fluxos paralelos (anti-no-show, métricas) não devem competir com cadência sem checagem de `status` e timestamps.

## Inventário por arquivo (Git)

| Arquivo | Nome típico no export | Gatilho / papel | Colisão com SDR? |
|---------|----------------------|-----------------|------------------|
| [`sdr-outbound-workflow.json`](../workflows/sdr-outbound-workflow.json) | SDR Outbound | Schedule (~15 min SP); `v_sessao_completa`; claim lease (015); UAZAPI; Supabase. | — (é o orquestrador) |
| [`metrics-aggregator-workflow.json`](../workflows/metrics-aggregator-workflow.json) | Agregador de Métricas Outbound | Cron 22h; lê eventos/sessões; grava `outbound_copy_metrics`. | Não (só leitura/agregado) |
| [`anti-noshow-workflow.json`](../workflows/anti-noshow-workflow.json) | Anti No-Show | Crons D-1 / D0; sessões `agendado`; UAZAPI. | **Sim** se disparar mesmo número em janela de cadência sem regra |
| [`inbound-lead-entry-outbound-cadencia-workflow.json`](../workflows/inbound-lead-entry-outbound-cadencia-workflow.json) | Inbound Lead Entry | Criação de sessão / entrada na cadência. | Cria estado; não é loop de WA contínuo |
| [`agrupar-mensagens-recebidas-workflow.json`](../workflows/agrupar-mensagens-recebidas-workflow.json) | Agrupar Mensagens Recebidas | Subfluxo (Execute Workflow); Redis; debounce inbound. | Mitiga duplicata do **agente** |
| [`hubspot-deal-on-schedule-workflow.json`](../workflows/hubspot-deal-on-schedule-workflow.json) | HubSpot agendamento | Referência / não operacional (ver RUNBOOK). | Fora de escopo |
| [`n8n-cadencia-omnichannel-modelo.json`](../workflows/n8n-cadencia-omnichannel-modelo.json) | Modelo D1–D21 | Modelo documental; não substitui produção. | N/A |
| `agendamentoCloser.json` (raiz do repo, se existir) | Agendamento Closer | Subfluxo calendário. | Não envia cadência fria |

### Code colado em nós (referência)

| Arquivo | Uso |
|---------|-----|
| `sdr-outbound-filtrar-vencidos.js` | Fila do orquestrador; inbound > outbound pausa fila. |
| `sdr-outbound-prepare-touchpoint.js` | Touchpoints + reforço 1h / D+1 9h. |
| `sdr-outbound-claim-dispatch-lease.js` | Lease antes de preparar envio. |
| `outbound-v2-merge-classificacao-ia.js` | Merge/classificação agente v2. |
| `sync-sdr-outbound-workflow.cjs` | Regenerar `sdr-outbound-workflow.json` a partir dos `.js`. |

## Workflows só na instância (documentação externa)

| Nome | ID (referência RUNBOOK) | Função |
|------|-------------------------|--------|
| AGENTE DE OUTBOUND v2 | `CgRaaq7ZUEfgSO1x` | Resposta conversacional; risco de duplicata se inbound duplo — ver mitigações no RUNBOOK. |
| Inbound Lead Entry | `tSjAUJUoY8VAP6qk` | Entrada lead / cadência. |
| Agregador | `95QTb55ZLM0r0AIe` | Métricas. |
| Anti No-Show | `Bc5WU9srWdiy23Mr` | Lembretes. |
| SDR Outbound | `XolilRXoC0RzMd6E` | Orquestrador (par ao JSON do repo). |

## Ações recomendadas

1. Export periódico da instância → `workflows/` para reduzir drift.
2. Agente v2: avaliar **claim** ou skip se `status`/`cadencia_pausada`/lease ativo (ver [`OUTBOUND_IMPL_MINIMA_PENDENTES.md`](OUTBOUND_IMPL_MINIMA_PENDENTES.md)).
3. Preencher [`OUTBOUND_QUESTIONARIO_ESTRATEGICO.md`](OUTBOUND_QUESTIONARIO_ESTRATEGICO.md) para fechar “quem fala quando”.
