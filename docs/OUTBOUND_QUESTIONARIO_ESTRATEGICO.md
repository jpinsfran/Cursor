# Questionário estratégico — ecossistema Outbound NOLA

**Objetivo:** fechar regras de negócio e integrações para o desenho único (orquestrador SDR Outbound × agente Outbound v2 × Supabase × CRM).  
**Como usar:** preencher as colunas **Resposta** e **Responsável/data**; quando completo, o documento vira especificação para implementação.

| # | Tema | Pergunta | Resposta | Responsável / data |
|---|------|----------|----------|-------------------|
| **E.1 — Regras de negócio** |||||
| 1 | Criação de sessão | Toda linha em `leads_perfil` deve gerar automaticamente uma `outbound_cadencia_sessions`, ou só após gatilho (manual, tier, região)? | **A:** automática — todo lead com linha em `leads_perfil` entra na cadência (criar sessão). | Chat NOLA / 2026-04-13 |
| 2 | Duplicidade | Um mesmo telefone pode ter mais de uma sessão ativa? Política desejada? | **A:** no máximo **uma** sessão ativa por telefone normalizado. | Chat NOLA / 2026-04-13 |
| 3 | Parada do orquestrador | Além de inbound recente e `em_conversa`, há opt-out por palavra, bloqueio manual, ou “só agente” após primeira resposta humana? | **D (opções anteriores):** regras combinadas — inbound/`em_conversa` **+** opt-out por palavra **+** bloqueio manual. | Chat NOLA / 2026-04-13 |
| 4 | Agente v2 | Após o lead responder, o único remetente deve ser o agente até agendar/perder? O orquestrador fica sempre pausado? | **B:** agente responde; orquestrador pode **tentar quebrar silêncio** após **3h** sem resposta do lead (`ultima_inbound_at`), com **no máximo 2** mensagens (`QUEBRA_SILENCIO_1` / `_2`, espaçadas em **3h**). Depois da 2ª, a sessão volta a **`em_cadencia`** com **próximo envio** no slot normal da cadência (head atual). Implementação: `supabase/migrations/016_quebra_silencio_retomada.sql`, nós Filtrar vencidos / Preparar touchpoint / workflow SDR Outbound. | Chat NOLA / 2026-04-13 |
| 5 | Reforço 1h | Reforço aplica-se só antes da primeira resposta humana, ou também entre mensagens do agente? Separar explicitamente **cadência** vs **follow-up do agente**. | **A:** só **antes** da primeira resposta humana (cadência fria); não como reforço entre mensagens do agente neste desenho. | Chat NOLA / 2026-04-13 |
| **E.2 — Integrações** |||||
| 6 | CRM | HubSpot, outro sistema, ou nenhum espelhamento obrigatório? | **A:** HubSpot. | Chat NOLA / 2026-04-13 |
| 7 | CRM — campos | Quais campos devem espelhar no CRM após cada mensagem (contato, deal, propriedades custom)? | **B:** deal / pipeline quando existir (foco em estágio do negócio). | Chat NOLA / 2026-04-13 |
| **E.3 — Operação e erros** |||||
| 8 | Conflito | Em empate: prioridade **entregar mensagem** ou **nunca duplicar**? | **B:** priorizar **entregar**, com **risco controlado** + mitigação técnica (lease, dedupe). | Chat NOLA / 2026-04-13 |
| 9 | SLA inbound | SLA máximo aceitável entre mensagem real do lead e atualização de `ultima_inbound_at` (segundos/minutos)? | **B:** até ~**2 minutos**. | Chat NOLA / 2026-04-13 |
| **E.4 — Métricas** |||||
| 10 | KPI | KPI principal do outbound neste trimestre (ex.: taxa de resposta, reunião agendada, pipeline)? | **B:** **reuniões agendadas** como KPI principal. | Chat NOLA / 2026-04-13 |

## Decisões em aberto (próximo alinhamento)

1. **Item 7:** confirmar se além de deal/pipeline deve haver atualização mínima de **contato** (telefone/nome) na primeira interação — opcional para implementação incremental.

## Mapa rápido letra → opção (formulário chat)

| # | Letras |
|---|--------|
| 1 | A |
| 2 | A |
| 3 | D |
| 4 | B |
| 5 | A |
| 6 | A |
| 7 | B |
| 8 | B |
| 9 | B |
| 10 | B |

## Referências no repositório

- Plano e arquitetura: [`OUTBOUND_ARQUITETURA_E_FLUXOS.md`](OUTBOUND_ARQUITETURA_E_FLUXOS.md) (seção 1.1–1.2).
- Contrato inbound: [`INBOUND_OUTBOUND_SESSAO_CONTRATO.md`](INBOUND_OUTBOUND_SESSAO_CONTRATO.md).
- Pendências técnicas mínimas: [`OUTBOUND_IMPL_MINIMA_PENDENTES.md`](OUTBOUND_IMPL_MINIMA_PENDENTES.md).
