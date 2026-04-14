## Runbook Outbound Contrato e Rollback

### Documentação do ecossistema (visão única)

- Arquitetura, dados e fluxos: [`OUTBOUND_ARQUITETURA_E_FLUXOS.md`](OUTBOUND_ARQUITETURA_E_FLUXOS.md) (inclui §1.1–1.2 norte de produto e máquina de estados).
- Questionário de decisões (preencher pela equipe): [`OUTBOUND_QUESTIONARIO_ESTRATEGICO.md`](OUTBOUND_QUESTIONARIO_ESTRATEGICO.md).
- Auditorias: Supabase [`OUTBOUND_AUDIT_SUPABASE.md`](OUTBOUND_AUDIT_SUPABASE.md), n8n [`OUTBOUND_AUDIT_N8N.md`](OUTBOUND_AUDIT_N8N.md).
- Pendências técnicas mínimas: [`OUTBOUND_IMPL_MINIMA_PENDENTES.md`](OUTBOUND_IMPL_MINIMA_PENDENTES.md).
- Forense / spam: [`FORENSE_OUTBOUND_CADENCIA.sql`](FORENSE_OUTBOUND_CADENCIA.sql), [`MONITOR_OUTBOUND_SPAM.md`](MONITOR_OUTBOUND_SPAM.md).

### Escopo
- `AGENTE DE OUTBOUND v2`
- `Inbound Lead Entry — Outbound Cadência`
- `Agregador de Métricas Outbound`
- `Anti No-Show — Lembretes`

**Fora de escopo (operacional):** criação de deal HubSpot via webhook de agendamento (`HubSpot — Criar Deal no Agendamento`). A operação passou a tratar HubSpot no fim dos fluxos (ex.: SDR outbound) e fase no agente — esse workflow não entra em rollout, smoke tests nem planos.

### Contrato mínimo de evento
- `outbound_cadencia_eventos` deve registrar: `session_id`, `direcao`, `canal`, `mensagem_texto`.
- Eventos de cadência devem incluir `message_kind`.
- Eventos inbound classificados devem incluir `response_actor` e `contact_outcome`.

### Contrato mínimo de sessão
- `outbound_cadencia_sessions` deve manter:
  - `primeira_mensagem_enviada_at`
  - `primeira_resposta_lead_at`
  - `ultimo_response_actor`
  - `flag_resposta_bot`
  - `flag_contato_errado`
  - `flag_numero_inexistente`
  - `reforco_1h_enviado_at`
  - `followup_d1_9h_enviado_at`

### Validação n8n (MCP / API)

Workflows em escopo com `n8n_validate_workflow` **sem erros** (2026-04-09): `CgRaaq7ZUEfgSO1x` (AGENTE DE OUTBOUND v2), `tSjAUJUoY8VAP6qk` (Inbound Lead Entry), `95QTb55ZLM0r0AIe` (Agregador), `Bc5WU9srWdiy23Mr` (Anti No-Show), `XolilRXoC0RzMd6E` (SDR Outbound). HubSpot agendamento excluído do escopo operacional.

### P1 — ambiente e segurança (não bloqueiam smoke)

- **AGENTE DE OUTBOUND v2** usa community node como tool: garantir `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true` no host n8n se o tool “SDR” for necessário.
- **Agregador — Notificar Admin:** URL é `{{ $env.UAZAPI_URL }}/send/text`; o validador pode avisar sobre “protocolo” — em runtime exige `UAZAPI_URL` com `https://`. Definir também `ADMIN_PHONE`, `UAZAPI_TOKEN`.
- **Webhooks sem autenticação:** auditoria da instância lista vários (incl. Lead Entry e Agente Outbound). Mitigação futura: header auth ou validação de payload; fora do escopo deste runbook.

### Mensagens duplicadas do agente (mesmo texto em segundos)

**Contexto:** O **AGENTE DE OUTBOUND v2** (`CgRaaq7ZUEfgSO1x`) recebe cada evento inbound pelo **Webhook**, processa texto (incl. **Verifica bot** → **Humano?**), e só depois grava **Log Inbound** e chama o subfluxo **Agrupar Mensagens Recebidas** (`no6RDsi3HE4Heyqu`). Cada disparo do webhook é **uma execução completa** do workflow. Se o canal (ex.: UAZAPI) enviar **dois eventos quase ao mesmo tempo** para o mesmo número — por exemplo duas bolhas de texto em sequência — duas execuções podem chegar ao nó **SDR** antes de qualquer serialização forte por sessão, gerando **duas respostas idênticas** em poucos segundos. Isso não é corrigível só com prompt.

**Mitigações típicas (escolher conforme esforço):**

1. Ajustar janela e regras no subfluxo **Agrupar Mensagens Recebidas** (debounce por `phone`, merge de texto, uma saída por janela).
2. **Wait** curto + deduplicação por `session_id` / telefone antes do **SDR** (ex.: fila ou registro em Supabase com TTL de poucos segundos).
3. Idempotência na saída: hash da última resposta + `session_id` + janela de tempo antes de aceitar novo envio igual (avançado).

**Teste manual sugerido:** enviar em sequência "Boa tarde", "Não ficou claro", "De que empresa você fala?" e confirmar **uma** resposta consolidada ou **uma** execução do agente por turno (monitorar **Executions** no n8n).

### Smoke tests (produção)
1. Enviar inbound humano e confirmar:
   - evento com `message_kind='resposta_lead'`
   - sessão com `primeira_resposta_lead_at` preenchido (se vazio antes)
2. Enviar inbound com texto típico de bot e confirmar:
   - `response_actor='bot'`
   - `flag_resposta_bot=true` na sessão
3. Executar agregador e confirmar resumo com:
   - respostas humano/bot
   - contatos errados/números inexistentes
   - tempo médio resposta equipe
4. Disparo anti no-show deve registrar `message_kind`.

### Rollback rápido
1. n8n:
   - Restaurar versão anterior do workflow no histórico da instância.
2. Repo:
   - Reverter arquivos de workflow alterados para o commit anterior.
3. Banco:
   - Não remover colunas novas em produção durante incidente.
   - Em caso de inconsistência, pausar workflows e corrigir dados via script SQL pontual.

### Verificação de schema (012 + 013)

Rodar no SQL Editor do Supabase (mesmo projeto que o n8n usa): [`supabase/verify_outbound_migrations_012_013.sql`](../supabase/verify_outbound_migrations_012_013.sql).

### SDR Outbound — estratégia para testes

- **Workflow:** `SDR Outbound` (id na instância: `XolilRXoC0RzMd6E`). Estrutura validada (`valid: true`); em **abril/2026** estava **inativo** por padrão seguro.
- **Opção recomendada para primeiro dia de testes:** manter o workflow **inativo** e usar **Execute workflow** manual na UI com payload / dados de staging, para validar touchpoint e escritas no Supabase sem cron a cada 15 min em produção.
- **Opção ativar cron:** só após checar credenciais Supabase/UAZAPI, variáveis `UAZAPI_URL` / `UAZAPI_TOKEN` na instância, e monitorar **Executions** no n8n durante a janela.
- **Fora deste escopo:** HubSpot deal criado só pelo webhook de agendamento (fluxo descontinuado).

### SQL de sanity check
```sql
-- Eventos sem message_kind (cadência)
select count(*) as eventos_sem_message_kind
from outbound_cadencia_eventos
where direcao in ('outbound','inbound')
  and coalesce(message_kind,'') = '';
```

```sql
-- Sessões sem primeira resposta apesar de inbound recebido
select count(*) as sessoes_inconsistentes
from outbound_cadencia_sessions s
where s.primeira_resposta_lead_at is null
  and exists (
    select 1
    from outbound_cadencia_eventos e
    where e.session_id = s.id
      and e.direcao = 'inbound'
  );
```

