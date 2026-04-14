# Contrato: webhook de mensagem recebida (WhatsApp) ↔ `outbound_cadencia_sessions`

O orquestrador **SDR Outbound** no n8n usa `v_sessao_completa` e os nós **Filtrar vencidos** / **Preparar touchpoint**. Para não disparar após o lead ter falado, o fluxo que recebe **inbound** deve manter a sessão coerente com o que o SQL e o n8n esperam.

## Campos mínimos a atualizar ao receber mensagem do lead (humano)

Recomendação operacional (ajuste fino conforme classificador de “bot vs humano”):

| Campo | Valor sugerido |
|--------|----------------|
| `ultima_inbound_at` | `now()` |
| `lead_respondeu_alguma_vez` | `true` |
| `status` | `em_conversa` (se o AGENTE assume o thread) **ou** manter `em_cadencia` mas garantir `ultima_inbound_at` e a regra abaixo |
| `ultimo_response_actor` | `'humano'` quando aplicável |

Com a lógica atual do repositório (**Filtrar vencidos**), se `status` continuar `novo`/`em_cadencia`, ainda assim o orquestrador **não** enfileira o lead quando `ultima_inbound_at > ultima_outbound_at` (salvo `flag_resposta_bot = true`). Por isso **`ultima_inbound_at` é obrigatório** assim que a mensagem inbound for persistida.

## Opcional (reduz ruído em métricas de “aguardando resposta”)

- Ajustar `ultimo_evento_aguardando_resposta_*` quando fizer sentido para o classificador, para não acumular estado antigo de “espera resposta” depois que o lead já respondeu.

## Onde implementar

O fluxo ao vivo (webhook UAZAPI / Evolution / etc.) **não está** versionado neste repositório em um único arquivo; alinhar o nó **Update** / **RPC** que grava `outbound_cadencia_sessions` com a tabela acima.

## Lease (migration 015)

O orquestrador agora chama `try_claim_outbound_session` antes de preparar o touchpoint. O inbound **não** precisa mexer no lease; apenas sessão/eventos.
