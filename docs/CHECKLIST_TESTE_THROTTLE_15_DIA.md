# Checklist de Teste — Throttle 15/dia (08h-18h SP)

## Objetivo
Validar que o volume combinado de disparos (alimentador + SDR) não ultrapassa 15 por dia e ocorre apenas na janela 08h-18h em `America/Sao_Paulo`.

## Pré-requisitos
- Migration aplicada: `supabase/migrations/013_primeiros_horarios_e_metrica_por_hora.sql`
- Code nodes atualizados:
  - `workflows/sdr-outbound-prepare-touchpoint.js`
  - `workflows/sdr-outbound-classificar-resposta.js`
- Workflow modelo importado/espelhado:
  - `workflows/n8n-cadencia-omnichannel-modelo.json`

## Verificações obrigatórias
1. **Janela horária**
   - Nenhum evento outbound entre 18:00 e 07:59 (SP).
2. **Cap diário**
   - Total outbound do dia <= 15 (combinado).
3. **Primeiros horários**
   - `primeira_mensagem_enviada_at` preenchido para sessões com outbound.
   - `primeira_resposta_lead_at` preenchido para sessões com inbound.
4. **Métrica por hora**
   - View `v_outbound_melhor_horario_sp` retornando buckets 8..17.

## SQL de validação rápida
```sql
-- Disparos fora da janela 08h-18h (SP): esperado 0
SELECT COUNT(*) AS fora_janela
FROM outbound_cadencia_eventos
WHERE direcao = 'outbound'
  AND (resultado IS NULL OR resultado <> 'falha_envio')
  AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'America/Sao_Paulo'))::int NOT BETWEEN 8 AND 17;
```

```sql
-- Volume diário combinado (SP): observar se passa de 15
SELECT
  (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia_sp,
  COUNT(*) AS disparos
FROM outbound_cadencia_eventos
WHERE direcao = 'outbound'
  AND (resultado IS NULL OR resultado <> 'falha_envio')
GROUP BY 1
ORDER BY 1 DESC;
```

```sql
-- Qualidade de persistência dos primeiros horários
SELECT
  COUNT(*) FILTER (WHERE primeira_mensagem_enviada_at IS NOT NULL) AS com_primeira_msg,
  COUNT(*) FILTER (WHERE primeira_resposta_lead_at IS NOT NULL) AS com_primeira_resposta,
  COUNT(*) AS total_sessoes
FROM outbound_cadencia_sessions;
```

```sql
-- Melhor horário (SP) para resposta
SELECT * FROM v_outbound_melhor_horario_sp;
```
