# Referência — Integrações para consultar o que você fez no dia

Todas as integrações abaixo são **somente para consulta**: obter dados do dia (eventos, issues, atividade) e usar no preenchimento da seção "Outras atividades do dia" do dailybot. Nada de envio ou automação do relatório.

## Google Calendar

- **Objetivo**: Consultar eventos do dia (reuniões, blocos) para preencher "Outras atividades".
- **Requisitos**: Google Cloud projeto, Calendar API ativada, credenciais OAuth 2.0 ou service account (leitura).
- **Dados úteis**: `summary`, `start`, `end` dos eventos do dia; opcionalmente filtrar por calendário.
- **Credenciais**: `credentials.json` ou variáveis (client_id, client_secret, refresh_token) em .env; nunca commitar.

## Jira

- **Objetivo**: Consultar issues em que o usuário trabalhou ou concluiu no dia.
- **Requisitos**: URL da instância (ex.: `https://sua-empresa.atlassian.net`), API token ou Basic Auth. JQL para filtrar (ex.: `assignee = currentUser() AND updated >= startOfDay()`).
- **Dados úteis**: key, summary, status; opcionalmente link.
- **Credenciais**: `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` em .env.

## Slack

- **Objetivo**: Consultar atividade do dia (canais em que participou, threads, mensagens enviadas) para refletir no resumo (ex.: "suporte no canal comercial", "alinhamento no #produto").
- **Requisitos**: Slack app com permissões de leitura (ex.: `channels:history`, `users:read`); ou export/API conforme disponível na workspace. Foco em **ler** atividade, não em enviar o dailybot.
- **Credenciais**: token em .env (ex.: `SLACK_BOT_TOKEN`); nunca commitar.

## n8n (opcional)

- **Objetivo**: Workflow ou script que **consulta** Calendar, Jira e/ou Slack e devolve os dados (eventos, issues, resumo de atividade) para o usuário ou para o agente usar ao montar o dailybot.
- **Uso**: O agente pode orientar nós de "Google Calendar", "Jira", "Slack" em modo leitura e um nó que agrega o resultado; o usuário roda o workflow e cola o resultado na conversa, ou integra com um script local que o agente ajudar a escrever.

## Ordem sugerida

1. Usar a skill no Cursor para gerar o dailybot (trabalho no Cursor + outras atividades que o usuário informar manualmente).
2. Se quiser **consultar** Calendar/Jira/Slack em vez de digitar: configurar uma integração por vez (credenciais, script ou n8n em modo leitura) e pedir ao agente ajuda para o script ou para interpretar os dados no dailybot.
