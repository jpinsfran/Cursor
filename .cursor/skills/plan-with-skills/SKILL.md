---
name: plan-with-skills
description: Structures multi-step work and plans so relevant Agent Skills are read first and applied per phase. Use when the user asks for a plan, roadmap, breakdown, estratégia, fases, próximos passos, or before large refactors, n8n workflows, Jira batches, scrapers, or code review — whenever planning should follow project skills and rules.
---

# Plan with Skills (best practices)

## When to use

- Pedidos de **plano**, **roadmap**, **fases**, **breakdown**, **próximos passos**, **como fazer X em etapas**.
- Tarefas **multi-arquivo** ou de **alto risco** (produção, credenciais, dados sensíveis).
- Domínios com skill dedicada no projeto: **n8n**, **Jira**, **scrape iFood**, **revisão sênior**, **dailybot**, **evaluate-prompt**, etc.

## Core rule

**Ler as skills pertinentes antes de escrever o plano.** O plano deve **explicitar** qual skill (ou regra `.cursor/rules`) governa cada fase — não apenas listar passos genéricos.

## Workflow (ordem fixa)

### 1. Inventário rápido

- Listar **domínios** do pedido (ex.: automação, Supabase, PR, PDF).
- Cruzar com **skills disponíveis** na mensagem do sistema / lista do projeto (` .cursor/skills/ `).
- Cruzar com **regras always-applied** do workspace (já valem; não repetir no plano, só não contradizer).

### 2. Carregar contexto de skills (antes do plano)

Para **cada** domínio com skill:

- **Ler o `SKILL.md` completo** (ou o trecho necessário se a skill for longa) **nesta ordem de prioridade**:
  1. Skills **obrigatórias por regra** (ex.: n8n → skill n8n; scrape regional → skill scrape-ifood).
  2. **evaluate-prompt-optimize** quando houver ambiguidade, gaps de dados ou credenciais.
  3. **code-review-senior** quando o plano incluir mudança em módulos core ou revisão formal.
- Se duas skills se sobrepõem: aplicar a **mais específica** ao domínio; a genérica (ex.: evaluate) entra na fase “entender pedido”.

### 3. Escrever o plano (formato)

Use seções curtas; cada fase com **skill ou regra** nomeada.

```markdown
## Objetivo
[1–2 frases]

## Fases
1. **[Nome]** — Skill: `skill-id` (ou Rule: `nome.mdc`)
   - Entregável:
   - Riscos / limites:
2. ...

## Ordem e dependências
[o que bloqueia o quê]

## Checklist de saída
[itens verificáveis alinhados às skills usadas]
```

- **Não** copiar a skill inteira no plano; **referenciar** e cumprir o que ela exige (formatos, checklists, bloqueadores).
- Se a skill pedir um **template de saída** (ex.: revisão n8n), o plano deve dizer que a **entrega final** segue esse template.

### 4. Execução após o plano

Ao implementar cada fase:

- Reabrir ou manter em mente a skill daquela fase.
- Se o usuário **mudar de escopo** no meio: repetir passo 1–2 só para o delta (novas skills?).

## Anti-patterns

| Evitar | Preferir |
|--------|----------|
| Plano genérico sem citar skills | Cada bloco crítico amarrado a uma skill/regra |
| Ler skill só na hora de codar | Ler antes de commitar o plano ao usuário |
| Empilhar skills irrelevantes | Só o que o pedido realmente toca |
| Ignorar “honestidade/limites” em planos arriscados | Incluir faixa de incerteza e o que não se pode garantir (regra do projeto) |

## Mini checklist (antes de enviar o plano)

- [ ] Toda área **especializada** do pedido tem skill (ou regra) **lida** e **citada** no plano.
- [ ] Fase de **clareza do pedido** incluída se houver ambiguidade (`evaluate-prompt-optimize`).
- [ ] **Uma** abordagem padrão por fase (evitar “pode A ou B” sem default).
- [ ] Entregas e critérios de pronto são **verificáveis**, não vagos.

---

**Integração com outras skills**: Para **criar** novas skills, use `create-skill-optimized`. Para **avaliar** o pedido antes de agir, use `evaluate-prompt-optimize` na primeira fase do plano quando fizer sentido.
