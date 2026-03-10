# Task: Plano de Scrape por Estado + Mapeamento de Endereços Relevantes no Supabase

**Contexto:** Este documento deve ser usado por um quorum de engenheiros especializados para desenhar e implementar uma solução **state-of-the-art**, **production-ready** e com **completude lógica** total. Espera-se **raciocínio profundo** e **ostensividade** no processo: cada decisão deve ser explícita, justificada e rastreável.

---

## 1. Objetivo da task

- **Cobrir todos os estabelecimentos do iFood em cada estado brasileiro** por meio de scrapes planejados.
- **Mapear e persistir os endereços relevantes** (usados como “sementes” de busca) no Supabase, de forma que o plano de scrape seja **dado, versionável e auditável**, não apenas hardcoded em script.

O resultado deve ser um **plano de scrapes por estado** que oriente exatamente quais scrapes executar para maximizar a cobertura de estabelecimentos, além de um modelo de dados e fluxo para **relevant_addresses** no Supabase.

---

## 2. Entendimento do mecanismo de scrape (área de busca)

**O iFood não utiliza raio em km.** O sistema atual funciona assim:

- **Entrada:** um **endereço** (ex.: `"Av. Paulista 1000, São Paulo"`).
- **Comportamento do iFood:** o site retorna os **restaurantes que entregam naquele endereço** (zona de entrega daquele ponto).
- **Consequência:** para “varrer” um estado inteiro é necessário rodar o scrape com **múltiplos endereços** em **múltiplas cidades e bairros**, usando o **mesmo sufixo** do estado. Cada endereço cobre uma zona; a união das zonas cobre o estado.

**Detalhes técnicos atuais:**

- **Script:** `scrapeIfoodLeads.js`.
- **Invocação:** `node scrapeIfoodLeads.js "ENDEREÇO" SUFIXO`
- **Saída:** CSV `ifoodLeads_SUFIXO.csv`. Se o arquivo já existir, o script **acumula apenas restaurantes novos** (desduplicação por URL).
- **Orquestração:** `run-scrapes-estado.js` recebe a UF (ex.: `SP`) e executa em sequência todos os endereços definidos em um objeto estático `ENDERECOS_POR_ESTADO[UF]`.

Ou seja: a “área” de busca é definida por **endereços discretos** (pontos de entrega), não por raio em km. O plano deve ser construído em cima dessa unidade: **lista de endereços relevantes por estado**.

---

## 3. O que deve ser entregue (escopo)

1. **Plano de scrape por estado**
   - Para cada UF (AC, AL, ..., TO):
     - Lista de **endereços relevantes** (localizações ideais para maximizar cobertura).
     - Critério explícito de escolha (ex.: capital, cidades com mais iFood, bairros centrais e periféricos para cobrir zonas distintas).
     - Ordem sugerida de execução (ex.: por volume esperado ou por prioridade de negócio).
   - Justificativa de **completude**: por que esse conjunto de endereços tende a cobrir “todos” os estabelecimentos do estado (ou qual estratégia de expansão se um censo exaustivo for impossível).

2. **Modelo de dados e persistência no Supabase**
   - Tabela (ou esquema) para **relevant_addresses**:
     - Campos necessários para identificar o endereço, estado, cidade, tipo (ex.: centro, bairro, cidade satélite), ordem de execução, e qualquer metadado útil para auditoria e reexecução.
   - Definição de como o plano de scrape (por estado) é **alimentado** a partir do Supabase (ex.: script que lê `relevant_addresses` por UF e chama o scraper), garantindo **single source of truth**.

3. **Integração com o fluxo existente**
   - Como `run-scrapes-estado.js` (ou sucessor) passa a usar **relevant_addresses** do Supabase em vez de (ou em complemento a) listas hardcoded.
   - Migrations e seeds necessários para popular os endereços iniciais por estado.

4. **Qualidade e robustez**
   - **State-of-the-art:** uso de boas práticas de modelagem, idempotência, e observabilidade.
   - **Production-ready:** tratamento de falhas, retries, logging, e (se aplicável) idempotência por endereço/estado.
   - **Completude lógica:** nenhum estado deixado sem plano; critérios claros para “endereço relevante”; estratégia explícita para estados com pouca presença iFood.

---

## 4. Requisitos de processo (raciocínio profundo e ostensividade)

- **Ostensividade:** todas as premissas, fontes de dados (ex.: como saber “cidades com mais iFood”) e regras de negócio devem estar **explícitas** no plano ou na documentação (não apenas implícitas no código).
- **Deep reasoning:** para cada estado, o plano deve refletir:
  - Por que aqueles municípios/bairros foram escolhidos.
  - Como o número de endereços por estado foi definido (evitar subcobertura ou desperdício).
  - Como lidar com estados muito grandes (ex.: SP, MG, BA) vs. estados menores (ex.: RR, AP).
- **Rastreabilidade:** versionamento do plano (ex.: via migrations ou tabela de “versão do plano”) para que mudanças futuras (novos endereços, novos estados) sejam auditáveis.

---

## 5. Artefatos de referência no repositório

- **`PLANO_SCRAPE_ESTADOS.md`** – plano atual por estado com endereços sugeridos e ordem de execução (pode ser usado como base para popular `relevant_addresses`).
- **`run-scrapes-estado.js`** – orquestrador que hoje usa `ENDERECOS_POR_ESTADO` estático; alvo de integração com Supabase.
- **`scrapeIfoodLeads.js`** – scraper que recebe endereço + sufixo e grava em `ifoodLeads_SUFIXO.csv`.
- **`supabase/migrations/001_schema_leads.sql`** – schema atual (ifood_estabelecimentos, leads_qualificados, leads_perfil, cardapio); **não existe ainda** tabela para endereços de busca; essa tabela deve ser proposta e implementada.

---

## 6. Resumo executivo para o quorum

Construir um **plano de scrapes por estado** que:

1. Entenda que a “área” de scrape é **por endereço** (zona de entrega), não por raio em km.
2. Defina, por estado, as **localizações ideais** (relevant_addresses) para maximizar a cobertura de estabelecimentos.
3. **Persista** esses endereços no Supabase e integre o fluxo de scrape a essa fonte.
4. Seja **state-of-the-art**, **production-ready**, com **completude lógica** e processo **ostensivo** e de **raciocínio profundo**, pronto para resolver de forma eficiente as necessidades da empresa.
