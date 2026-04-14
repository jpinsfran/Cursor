# Questionário estratégico — ecossistema Outbound NOLA

**Objetivo:** fechar regras de negócio e integrações para o desenho único (orquestrador SDR Outbound × agente Outbound v2 × Supabase × CRM).  
**Como usar:** preencher as colunas **Resposta** e **Responsável/data**; quando completo, o documento vira especificação para implementação.

| # | Tema | Pergunta | Resposta | Responsável / data |
|---|------|----------|----------|-------------------|
| **E.1 — Regras de negócio** |||||
| 1 | Criação de sessão | Toda linha em `leads_perfil` deve gerar automaticamente uma `outbound_cadencia_sessions`, ou só após gatilho (manual, tier, região)? | | |
| 2 | Duplicidade | Um mesmo telefone pode ter mais de uma sessão ativa? Política desejada? | | |
| 3 | Parada do orquestrador | Além de inbound recente e `em_conversa`, há opt-out por palavra, bloqueio manual, ou “só agente” após primeira resposta humana? | | |
| 4 | Agente v2 | Após o lead responder, o único remetente deve ser o agente até agendar/perder? O orquestrador fica sempre pausado? | | |
| 5 | Reforço 1h | Reforço aplica-se só antes da primeira resposta humana, ou também entre mensagens do agente? Separar explicitamente **cadência** vs **follow-up do agente**. | | |
| **E.2 — Integrações** |||||
| 6 | CRM | HubSpot, outro sistema, ou nenhum espelhamento obrigatório? | | |
| 7 | CRM — campos | Quais campos devem espelhar no CRM após cada mensagem (contato, deal, propriedades custom)? | | |
| **E.3 — Operação e erros** |||||
| 8 | Conflito | Em empate: prioridade **entregar mensagem** ou **nunca duplicar**? | | |
| 9 | SLA inbound | SLA máximo aceitável entre mensagem real do lead e atualização de `ultima_inbound_at` (segundos/minutos)? | | |
| **E.4 — Métricas** |||||
| 10 | KPI | KPI principal do outbound neste trimestre (ex.: taxa de resposta, reunião agendada, pipeline)? | | |

## Referências no repositório

- Plano e arquitetura: [`OUTBOUND_ARQUITETURA_E_FLUXOS.md`](OUTBOUND_ARQUITETURA_E_FLUXOS.md) (seção 1.1–1.2).
- Contrato inbound: [`INBOUND_OUTBOUND_SESSAO_CONTRATO.md`](INBOUND_OUTBOUND_SESSAO_CONTRATO.md).
- Pendências técnicas mínimas: [`OUTBOUND_IMPL_MINIMA_PENDENTES.md`](OUTBOUND_IMPL_MINIMA_PENDENTES.md).
