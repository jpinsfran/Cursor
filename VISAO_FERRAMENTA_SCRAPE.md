# Visão da ferramenta de scrape

Documento de alinhamento: o que a ferramenta é, para que serve e como os dois módulos principais se encaixam.

---

## Objetivo

Construir uma **base de dados para um bom rapport** com leads: dados que permitam **busca personalizada** e **abordagem humanizada** (entender o cliente antes do contato).

A ferramenta tem **duas funções principais**, cada uma com um módulo base:

---

## 1. Scrape iFood — Oportunidades de leads

**Arquivo:** `scrapeIfoodLeads.js`

**Função:** Buscar **oportunidades de leads** por endereço/região.

- Entrada: endereço + sufixo (ex.: "Av Paulista 1000" SP).
- Processo: abre o iFood, informa o endereço, coleta a lista de restaurantes (e “Ver mais” quando existir), extrai dados de cada estabelecimento.
- Saída: CSV com **name, url, phone, cnpj, streetAddress, neighborhood, zipcode, rating, email, cuisine, priceRange** (e coluna **regiao** quando gerado por região).
- Uso: alimentar o funil com **quem** são os potenciais clientes e **onde** estão.

**Papel na base para rapport:** Lista de estabelecimentos que viram **candidatos a lead**; a base de “quem abordar” vem daqui.

---

## 2. Scrape Instagram — Entender o perfil do cliente

**Arquivo:** `scrapeInstagram.js` (e `instagram_ai.py` para IA)

**Função:** Entender o **perfil do cliente** e tirar as **principais conclusões** a partir do Instagram.

- Entrada: URL do perfil ou @username (usado sozinho ou pelo unificador, que descobre o perfil a partir do nome/região).
- Processo:
  - Extrai informações do perfil (bio, nome, seguidores, seguindo, link da bio).
  - Analisa os posts (legendas + imagens, com IA quando disponível); foco no **último post**.
  - Passa por **todos os destaques** (highlights), com screenshot e descrição (foto/vídeo).
  - Se houver link externo na bio (e não for iFood), acessa e resume o conteúdo.
- Saída (via `runFullInstagramAnalysis` ou CSV direto): **perfil, seguidores, seguindo, tema_da_loja, ultimo_post, destaques, unidades, funcionarios, link_externo, link_externo_resumo, contextualizacao_loja, punch_line**.

**Papel na base para rapport:** Entender **como** o cliente se apresenta (tema, tipo de conteúdo, último post, destaques, site). É a matéria-prima para **rapport** e **abordagem personalizada**.

---

## Como os dois se conectam

| Etapa | Módulo | O que entrega |
|-------|--------|----------------|
| 1. Oportunidades | `scrapeIfoodLeads.js` | Lista de estabelecimentos (leads em potencial) por região. |
| 2. Perfil do cliente | `scrapeInstagram.js` | Para cada lead (ou para um perfil específico): entendimento do negócio, tema, último post, destaques, link externo, resumo para abordagem. |

O **unificador** (`unificaIfoodInstagram.js`) usa um CSV de leads (vindo do iFood, da Vuca ou outro), **busca o Instagram** de cada linha (nome + bairro/cidade) e chama `runFullInstagramAnalysis` para cada perfil encontrado. O resultado é uma **única base**: dados do estabelecimento + dados do Instagram para rapport.

---

## Base para busca personalizada e rapport

- **iFood:** “Quem” e “onde” (nome, endereço, contato, tipo de cozinha, faixa de preço).
- **Instagram:** “Como” o negócio se apresenta (bio, tema, último post, destaques, site) e **gancho para abertura** (contextualizacao_loja, punch_line).

Juntos, esses dois módulos formam a **base para**:

- Filtrar e priorizar leads (região, tipo, rating, etc.).
- Preparar o primeiro contato (contexto + punch line).
- Manter uma base única (CSV unificado) como fonte da verdade para prospecção e rapport.

---

## Resumo em uma frase

**scrapeIfoodLeads.js** = buscar oportunidades de leads; **scrapeInstagram.js** = entender o perfil do cliente (perfil, posts, destaques). Os dois são a base da ferramenta de scrape para **busca personalizada** e **rapport**.
