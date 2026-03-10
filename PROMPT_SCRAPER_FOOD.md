# Prompt e permissões – Scraper Food (iFood + Instagram)

Este documento consolida **tudo o que foi solicitado** para o fluxo de automação e define como o assistente pode atuar.

**Regra obrigatória:** Nunca inventar informação. Só preencher campos com dados de fonte segura (página, API, imagem analisada). Se não houver certeza, deixar o campo vazio.

---

## O que foi solicitado (resumo)

1. **Base de leads iFood por região**  
   Gerar planilha de estabelecimentos do iFood por endereço/região (nome, url, telefone, CNPJ, endereço, bairro, CEP, rating, email, tipo de cozinha, faixa de preço).

2. **Busca do Instagram correto**  
   Para cada lead, encontrar o perfil Instagram **correto** (nome + bairro + cidade, ou CNPJ quando disponível), evitando homônimos.

3. **Análise avançada do Instagram**  
   - **Tema da loja:** resumo em 1 parágrafo do ramo e foco do perfil (bio + legendas + descrição das imagens, com IA quando houver API).  
   - **Último post:** resumo do último post (legenda + análise da imagem; pular vídeos; em carrossel, considerar imagens).  
   - **Destaques:** conteúdo dos highlights (sem poluir com texto de UI do Instagram: “Ver story”, “poderá ver que você viu”, etc.).  
   - **Unidades:** detectar menção a número de unidades/lojas/filiais em bio, legendas e destaques.  
   - **Link externo:** se o link da bio não for iFood, abrir a página e gerar um resumo curto.

4. **Planilha unificada**  
   Um único CSV com colunas iFood + Instagram (tema_da_loja, ultimo_post, destaques, unidades, link_externo, link_externo_resumo), **uma linha por estabelecimento**, texto sem quebras de linha desnecessárias e sem placeholders tipo “Configure OPENAI_API_KEY”.

5. **Automação**  
   Entrada: região (ou endereço). O fluxo roda iFood → busca Instagram → análise completa → CSV unificado, com opções como `--limit`, `--resume`, `--skip-ifood`.

---

## Qualidade esperada da planilha

- **tema_da_loja:** parágrafo curto e objetivo (2–4 frases). Se não houver IA, usar bio + início das legendas (fallback). Nunca deixar “[Configure OPENAI_API_KEY]”.
- **ultimo_post:** resumo do último post (legenda + imagem). Se não houver IA, usar legenda + alt da imagem. Nunca deixar placeholder de API.
- **destaques:** só títulos e conteúdo útil dos highlights (ex.: “Destaque 1: Horários | Destaque 2: Cardápio”). Sem “Ver story”, “poderá ver que você viu”, “X sem”, etc.
- **unidades:** preenchido só quando houver menção clara a quantidade de unidades/lojas; vazio caso contrário.
- **link_externo / link_externo_resumo:** preenchidos quando o link da bio não for iFood; resumo em uma linha.
- **CSV:** uma linha lógica por estabelecimento; campos longos com quebras substituídas por ` | ` para facilitar leitura no Excel.

---

## Permissões (padrão)

**Você tem liberdade total para:**

- Ajustar prompts e textos enviados à IA (Python/OpenAI) para melhorar tema_da_loja e ultimo_post.
- Corrigir e melhorar a limpeza do texto dos destaques (remover UI, limitar tamanho).
- Implementar fallbacks quando `OPENAI_API_KEY` não estiver definida (usar bio, legendas, alt text).
- Sanitizar campos antes de gravar no CSV (substituir `\n` por ` | `, remover placeholders).
- Alterar `scrapeInstagram.js`, `instagram_ai.py`, `unificaIfoodInstagram.js`, `scraperFoodDefinitivo.js` e scripts auxiliares para atingir a qualidade acima.
- Adicionar ou refinar colunas na planilha unificada se fizer sentido para o fluxo.

**Pode me pedir permissão ou confirmação quando:**

- Quiser mudar a estrutura principal do fluxo (ex.: ordem das etapas, trocar iFood por outra fonte).
- For necessário usar outra API ou serviço pago além da OpenAI.
- Precisar de dados sensíveis (tokens, senhas, dados pessoais) ou acesso a contas.
- Houver dúvida se uma mudança quebra algo que você usa manualmente.

---

## Referência rápida de arquivos

| Arquivo | Papel |
|--------|--------|
| **scraperFoodDefinitivo.js** | Orquestrador: região → iFood → unificação. |
| **scrapeIfoodLeads.js** | Gera CSV de leads iFood por endereço. |
| **unificaIfoodInstagram.js** | Lê CSV iFood, busca Instagram, chama análise, gera CSV unificado. |
| **scrapeInstagram.js** | Análise completa do perfil (bio, posts, destaques, link externo, unidades). |
| **instagram_ai.py** | IA: análise de imagem e resumos (tema + último post); fallbacks sem API key. |

Detalhes em **ARQUIVOS_SCRAPER_FOOD.md**.
