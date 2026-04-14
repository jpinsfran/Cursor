# Auditoria n8n — fluxos que impactam outbound (repo)

**Objetivo:** inventário dos JSON/JS em [`workflows/`](../workflows/) e relação com colisão de envio (orquestrador × agente × lembretes). A **instância** (`n8n.nola.com.br`) pode ter IDs e nós adicionais — comparar com export atual.

## Regra de ouro (produto)

Para cada `session_id`, deve existir **no máximo um** “dono” do próximo envio imediato: **orquestrador SDR Outbound**, **agente Outbound v2**, ou **nenhum** (pausa / encerrado). Fluxos paralelos (anti-no-show, métricas) não devem competir com cadência sem checagem de `status` e timestamps.

## Anti-rajada e janela (orquestrador — repo)

- **Lease (migration 015):** o nó **Claim dispatch lease** chama a RPC `try_claim_outbound_session` via credencial Supabase (`this.getCredentials('supabaseApi')` + `helpers.httpRequest`). TTL padrão **300 s**. O IF **Dispatch claim OK?** só segue para **Preparar touchpoint** quando `_dispatch_claimed === true`; caso contrário volta ao **Um lead por vez** sem preparar envio (evita corrida entre execuções do Cron 15 min).
- **Liberação do lease:** os nós Supabase **atualizar sessão**, **reagendar skip** e **reagendar após falha** zera `outbound_dispatch_lease_until` e `outbound_dispatch_lease_execution_id` (equivalente a liberar a reserva após processar o item).
- **Janela 8–18h America/Sao_Paulo:** **Preparar touchpoint** marca `skip: true` e `skipReason: fora_janela_08_18_sp` com `proximo_envio_at` no próximo início de janela para: reforço 1h, follow-up D+1 9h, quebra de silêncio e **todos** touchpoints WhatsApp da cadência (não só D1 inicial).
- **Publicar código no n8n:** `node workflows/sync-sdr-outbound-workflow.cjs` → `node scripts/build-sdr-outbound-code-push.mjs` → `node scripts/n8nPushPartialFromFile.mjs workflows/.n8n-sdr-code-push.json` (usa `~/.cursor/mcp.json` → credenciais Supabase para PUT do workflow).

### Agente Outbound v2 (instância — checklist manual)

Respostas **ao webhook** de mensagem recebida seguem o fluxo conversacional. Para **evitar colisão** com o orquestrador no mesmo minuto, ao implementar qualquer envio **proativo** pelo agente (não correlacionado a uma mensagem inbound imediata): consultar `outbound_cadencia_sessions` e **não enviar** se `outbound_dispatch_lease_until > now()` ou se a política de `status` / `cadencia_pausada` exigir pausa (ver [`OUTBOUND_IMPL_MINIMA_PENDENTES.md`](../OUTBOUND_IMPL_MINIMA_PENDENTES.md)).

### Anti No-Show

O workflow **Anti No-Show** deve operar só em sessões **agendadas** (ex. `status` coerente com reunião marcada) e **não** competir com a mesma linha de cadência fria sem filtro por telefone/sessão. Revisar o filtro da query na instância quando houver lembretes no mesmo número que ainda está em `em_cadencia` com `proximo_envio_at` ativo.

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
