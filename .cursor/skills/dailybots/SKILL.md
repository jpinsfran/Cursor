---
name: dailybots
description: Produces a daily work summary (dailybot) for the user's superior. Gathers work done with the agent (creation, tests, fixes), asks for other daily activities, and formats a clear report. Use when the user asks for daily report, dailybot, resumo do dia, or to inform their superior. Can help set up integrations only to consult what the user did (Google Calendar, Jira, Slack) to fill "other activities"—no sending or automating the report.
---

# Dailybots — Resumo diário para o superior

Gera um resumo estruturado de tudo que foi trabalhado no dia para informar o superior. Inclui trabalho feito com o agente (Cursor) e outras atividades do dia. As integrações (Calendar, Jira, Slack) servem **apenas para consultar** o que você fez no dia e preencher "Outras atividades"—não para enviar ou automatizar o relatório.

## Quando usar

- O usuário pede **dailybot**, **resumo do dia**, **relatório diário** ou **informar o superior**.
- Pedidos como "faz meu dailybot", "resumo do que fiz hoje", "preparar o que trabalhei hoje para meu chefe".

## Fluxo

1. **Reunir trabalho com o agente**: Com base no histórico da conversa e no que foi feito nesta sessão (e, se disponível, em transcrições/contexto do dia), listar:
   - **Criação**: artefatos criados (arquivos, scripts, automações, regras, skills).
   - **Testes**: o que foi testado (comandos rodados, cenários validados).
   - **Erros corrigidos**: bugs, ajustes de lint, correções de lógica ou integração.
   - **Demais trabalho**: revisões, refatorações, documentação, configurações.
2. **Perguntar outras atividades**: Perguntar ao usuário de forma objetiva quais **outras atividades** ele realizou no dia fora do Cursor (reuniões, tarefas em outras ferramentas, suporte, etc.).
3. **Resumir outras atividades**: Para cada atividade informada, escrever uma linha clara: **o que foi feito** (tarefa desempenhada), sem inventar detalhes.
4. **Montar o resumo final** no template abaixo e entregar em markdown (ou texto) pronto para colar.

## Template do resumo

Usar a estrutura abaixo. Manter seções vazias se não houver dado (ou omitir a seção).

```markdown
# Dailybot — [DATA]

## Trabalho no Cursor / com o agente

### Criação
- [Item 1: o que foi criado]
- [Item 2]

### Testes
- [O que foi testado e resultado resumido]

### Erros corrigidos
- [Problema X: correção aplicada]
- [Problema Y: correção aplicada]

### Outros (revisões, refatoração, docs, config)
- [Item]

---

## Outras atividades do dia

- **[Contexto]**: [Tarefa desempenhada de forma clara]
- **[Contexto]**: [Tarefa desempenhada]

---

## Resumo em uma linha (opcional)
[Uma frase para o superior: ex. "Avancei no scraper iFood, corrigi bugs no unificador e participei da reunião de planejamento."]
```

## Como perguntar "outras atividades"

- Fazer **uma pergunta direta**, por exemplo:
  - "Quais outras atividades você fez hoje fora do Cursor? (reuniões, Jira, Slack, suporte, planejamento, etc.)"
- Para cada item que o usuário citar, **esclarecer se necessário** ("Foi reunião de alinhamento ou de sprint?") e então **resumir em uma linha** na seção "Outras atividades do dia", deixando explícita a **tarefa desempenhada** (ex.: "Reunião de planejamento: definição de prioridades do próximo sprint").

## Integrações (apenas para consultar o que você fez no dia)

As integrações servem **somente para consultar** dados do dia e preencher a seção "Outras atividades do dia". O agente **não** envia o dailybot para lugar nenhum; só ajuda a obter o que você fez.

| Integração | Uso |
|------------|-----|
| **Google Calendar** | Consultar eventos do dia (reuniões, blocos) para preencher "Outras atividades". |
| **Jira** | Consultar issues em que você trabalhou ou concluiu no dia. |
| **Slack** | Consultar atividade (canais, threads, mensagens relevantes) para refletir no resumo. |
| **n8n** | Script ou workflow que **consulta** Calendar/Jira/Slack e devolve os dados para o agente montar o dailybot. |

- **Não implementar** integrações sem o usuário pedir; quando pedir, orientar **apenas** a parte de **leitura/consulta** (APIs, credenciais de leitura, .env).
- Não sugerir envio do relatório (Slack, e-mail, etc.); o usuário copia/cola o dailybot onde quiser.

## Regras

- **Não inventar** atividades ou itens; usar só o que foi feito na conversa e o que o usuário informar.
- **Data**: usar a data do dia atual (ou a que o usuário indicar).
- **Linguagem**: manter o resumo profissional e objetivo; "resumo em uma linha" opcional para o superior.
- Se não houver histórico suficiente do trabalho no Cursor, dizer isso e basear o "Trabalho no Cursor" apenas no que for explícito na sessão atual; pedir ao usuário que complemente se quiser.