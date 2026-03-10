---
name: evaluate-prompt-optimize
description: Evaluates user prompts and commands to identify missing data, credentials, or specifications and to clarify intent for optimal execution. Use when processing any user request, command, or task to ensure the agent understands what is needed before acting.
---

# Evaluate Prompt — Optimize Understanding

Apply this evaluation at the **start** of processing the user's message. Goal: understand exactly what they want and what is missing, with minimal back-and-forth.

## 1. Parse the request

- **Intent**: What is the user trying to achieve? (action + target, e.g. "run scraper for city X", "create automation that does Y")
- **Entities**: What concrete things are involved? (files, tools, regions, accounts, APIs, env vars)
- **Context**: What is implied by the workspace (e.g. existing scripts, .env, configs) that can be used without asking

## 2. Identify gaps

Check whether the prompt clearly specifies:

| Tipo | Exemplos | Se faltar |
|------|----------|-----------|
| **Dados** | arquivo, região, lista, filtros | Inferir do contexto ou pedir o mínimo (ex.: "qual região?"). |
| **Credenciais** | API key, senha, token | Não pedir valor no chat; indicar onde configurar (`.env`, variável, settings). |
| **Especificações** | formato de saída, limites, opções | Assumir padrão razoável e informar, ou uma pergunta curta. |

Prioridade: **não** perguntar o que dá para inferir (projeto, arquivos abertos, convenções). Só perguntar o que for indispensável e não óbvio.

## 3. Optimize before answering

- **Resumir o entendido**: Em 1–2 frases, o que você entendeu que será feito.
- **Preencher silêncios**: Assumir padrões (ex.: salvar em CSV, usar script X do projeto) e dizer "Assumindo Y; se for diferente, avise."
- **Uma rodada de dúvidas**: Se precisar de 2+ informações, agrupe numa única pergunta objetiva.
- **Segurança**: Nunca solicitar senha/token no texto; sempre orientar uso de variável de ambiente ou config segura.

## 4. When to ask vs assume

- **Perguntar**: escolha que afeta resultado (ex.: qual cidade, qual conta, qual formato).
- **Assumir e informar**: convenções do projeto, nomes de arquivos óbvios, formato padrão (CSV, JSON).
- **Não pedir no chat**: credenciais; orientar onde configurar.

---

**Nota sobre uso automático**: Esta skill é ativada quando o Cursor considera a description relevante para o pedido. Para aumentar a chance de ser usada em todo pedido: se o Cursor tiver opção de "skills fixas", "default skills" ou "always-on rules", inclua ou referencie esta skill lá. Regras em `.cursor/rules` ou no Agent podem também instruir: "Antes de executar, avaliar o prompt com a skill evaluate-prompt-optimize."
