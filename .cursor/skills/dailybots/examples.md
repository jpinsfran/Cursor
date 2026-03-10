# Exemplos — Dailybots

## Exemplo de pergunta ao usuário

Depois de preencher a parte "Trabalho no Cursor", o agente pode perguntar:

> "Para completar seu dailybot, quais **outras atividades** você fez hoje fora do Cursor? (ex.: reuniões, tarefas no Jira, mensagens no Slack, suporte, planejamento)"

## Exemplo de "Outras atividades" resumidas

Entrada do usuário (exemplo):
- "Reunião com o time de produto"
- "Fiz 3 tarefas no Jira"
- "Respondi dúvidas no Slack do comercial"

Saída na seção "Outras atividades do dia":

```markdown
## Outras atividades do dia

- **Reunião**: Alinhamento com o time de produto.
- **Jira**: Conclusão de 3 tarefas (listar IDs ou nomes se o usuário informar).
- **Slack**: Suporte e respostas ao time comercial.
```

## Exemplo de dailybot completo

```markdown
# Dailybot — 04/03/2025

## Trabalho no Cursor / com o agente

### Criação
- Skill `dailybots` para resumo diário (SKILL.md + examples.md).
- Ajuste no script de unificação para nova coluna `link_externo_resumo`.

### Testes
- Execução do scrape iFood para SP; CSV gerado com 120 leads.
- Validação do fluxo unificaIfoodInstagram com amostra de 50 linhas.

### Erros corrigidos
- Corrigido lint em `instagram_ai.py` (import não usado).
- Ajuste no tratamento de campo vazio no CSV unificado (evitar "N/A" inventado).

### Outros
- Revisão das regras do scraper (dados nunca inventar).

---

## Outras atividades do dia

- **Reunião**: Planejamento do sprint com foco em automação n8n.
- **Jira**: Conclusão de NOLA-42 (documentação da API de leads).
- **Slack**: Suporte ao comercial com dúvidas sobre base de leads.

---

## Resumo em uma linha
Avancei na skill de dailybot, correções no unificador e no instagram_ai; reunião de planejamento e conclusão de documentação (NOLA-42).
```

## Integrações (só para consultar o que você fez no dia)

Quando o usuário pedir ajuda com integrações, oferecer **apenas** consulta para preencher "Outras atividades"—não envio do relatório:

- **Google Calendar**: "Posso te guiar a consultar os eventos do dia no Google Calendar para preencher a seção de outras atividades; precisa configurar credenciais de leitura (OAuth) em .env."
- **Jira**: "Para puxar as tarefas que você mexeu hoje no Jira, podemos usar a API (filtro por dia); você tem URL da instância e token de API?"
- **Slack**: "Para refletir sua atividade no Slack no dailybot (canais, suporte), dá para usar a API em modo leitura; posso te orientar a configurar o token e um script que liste o que você fez no dia."
- **n8n**: "Dá para montar um workflow no n8n que **consulta** Calendar, Jira e/ou Slack e devolve os dados do dia; você usa esse resultado aqui na conversa para eu montar o dailybot. Quer que eu descreva os nós?"