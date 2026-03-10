---
name: code-review-senior
description: Performs senior-level code review (Google-style). Evaluates modules for portability, robustness, resource cleanup, alignment with product vision; lists positives and improvements with priority. Use when reviewing code, before or after changing core modules (e.g. scrapeIfoodLeads, scrapeInstagram), or when the user asks for a code review or "revisão".
---

# Revisão de código (nível sênior)

Avalia código como um dev sênior em uma organização de alto nível: foco em manutenibilidade, robustez e alinhamento com o objetivo do produto.

## Quando aplicar

- Ao revisar PRs, diffs ou arquivos alterados.
- Antes ou depois de mudanças em módulos principais (ex.: scrapeIfoodLeads.js, scrapeInstagram.js).
- Quando o usuário pedir "revisão", "avaliar o código", "code review" ou "boas práticas".

## Estrutura da revisão

1. **Pontos positivos** — O que está bem feito (objetivo claro, fallbacks, dedup, modularidade, tratamento de erro, portabilidade).
2. **Pontos a melhorar** — Itens concretos com sugestão de correção (não genéricos).
3. **Alinhamento com a visão** — O módulo entrega o que o produto espera? (ex.: iFood = oportunidades de leads; Instagram = entender perfil do cliente.)
4. **Prioridade** — Tabela Alta / Média / Baixa com "Onde" e "O quê".

## Checklist de avaliação

- **Portabilidade:** paths, CHROME_PATH, `process.platform` / `path.join(process.cwd(), ...)`.
- **Persistência/export:** BOM no CSV quando relevante; encoding UTF-8.
- **Recursos:** browser, temp dirs, file handles fechados em `finally` ou equivalente.
- **Robustez:** extração de dados (evitar `.split()` frágil; preferir regex/parser quando fizer sentido); retry/backoff em requests críticos; timeouts explícitos.
- **Controle de fluxo:** flags para headless/debug; constantes para timeouts e delays.
- **Documentação:** JSDoc ou comentários para funções exportadas e shape de retorno.
- **Regras do projeto:** não inventar dados; usar apenas fontes seguras (ver rule scraper-dados).

## Formato de saída

- Seção **Pontos positivos** (bullets).
- Seção **Pontos a melhorar** (numerado, com sugestão por item).
- Seção **Alinhamento** (uma linha por módulo).
- Tabela **Prioridade** (Prioridade | Onde | O quê).

Manter a revisão concisa; se for longo, resumir no chat e sugerir documento em arquivo (ex.: REVISAO_CODIGO_SENIOR.md) para referência.
