# Rollout — Follow-up 1h + D+1 09:00 (SP)

## Pré-requisitos
- Aplicar migration `supabase/migrations/012_followup_contract_and_leads_perfil_principal.sql`.
- Publicar os updates dos workflows/scripts:
  - `workflows/sdr-outbound-prepare-touchpoint.js`
  - `workflows/sdr-outbound-classificar-resposta.js`
  - `workflows/metrics-aggregator-workflow.json`
- Confirmar timezone operacional no n8n: `America/Sao_Paulo`.

## Sequência recomendada de ativação
1. Executar em lote de 20-50 leads novos.
2. Validar duplicidade de reforço em 1h (não pode repetir para mesma sessão).
3. Validar disparo D+1 09:00 apenas para não respondidos.
4. Validar persistência de classificação inbound (`response_actor`, `contact_outcome`).
5. Escalar gradualmente para o restante da base nova.

## Queries de validação rápida
```sql
-- Reforço 1h duplicado por sessão (esperado: 0 linhas)
SELECT session_id, COUNT(*) AS total
FROM outbound_cadencia_eventos
WHERE message_kind = 'reforco_1h'
GROUP BY session_id
HAVING COUNT(*) > 1;
```

```sql
-- Follow-up D+1 duplicado por sessão (esperado: 0 linhas)
SELECT session_id, COUNT(*) AS total
FROM outbound_cadencia_eventos
WHERE message_kind = 'followup_d1_9h'
GROUP BY session_id
HAVING COUNT(*) > 1;
```

```sql
-- Monitor de classificação inbound
SELECT
  response_actor,
  contact_outcome,
  COUNT(*) AS total
FROM outbound_cadencia_eventos
WHERE direcao = 'inbound'
GROUP BY response_actor, contact_outcome
ORDER BY total DESC;
```

```sql
-- Sessões com estado de follow-up pendente
SELECT
  id,
  status,
  ultimo_evento_aguardando_resposta_at,
  reforco_1h_enviado_at,
  followup_d1_9h_enviado_at
FROM outbound_cadencia_sessions
WHERE status IN ('novo', 'em_cadencia', 'em_conversa')
ORDER BY ultimo_evento_aguardando_resposta_at NULLS LAST
LIMIT 200;
```

## Critérios de aceite
- Reforço de 1h enviado corretamente nos dois cenários:
  - após primeira mensagem sem resposta,
  - após primeira resposta do agente sem nova resposta do lead.
- Follow-up D+1 às 09:00 enviado apenas para não respondidos elegíveis.
- Tabela `leads_perfil` atualizada com dados-base (ifood + qualificação) e usada como referência principal.
- Métricas mostram distinção entre resposta humana, bot, contato errado e número inexistente.
