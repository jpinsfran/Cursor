# Arquivos do Scraper Definitivo – Food

Resumo dos arquivos utilizados e do uso de cada um.

**Visão da ferramenta:** dois módulos principais — **scrapeIfoodLeads.js** (oportunidades de leads) e **scrapeInstagram.js** (entender o perfil do cliente) — formam a base para busca personalizada e rapport. Detalhes em **VISAO_FERRAMENTA_SCRAPE.md**. Revisão de código (nível sênior): **REVISAO_CODIGO_SENIOR.md**.

---

## Uso rápido (automático)

```bash
# 1) Uma vez: fazer login no Instagram
node scrapeInstagram.js --login

# 2) Rodar o scraper pela região (iFood + busca Instagram + análise completa)
node scraperFoodDefinitivo.js SP
# ou
node scraperFoodDefinitivo.js "Av Paulista 1000" SP
```

Saída: `ifoodLeads_SP_unificado.csv` com dados iFood + Instagram (tema, último post, destaques, unidades, link externo).

---

## Arquivos e função de cada um

| Arquivo | Uso |
|--------|-----|
| **scraperFoodDefinitivo.js** | **Orquestrador.** Você informa só a região (ex.: SP, RJ). Ele chama o iFood para gerar a base, depois o unificador para buscar Instagram e fazer a análise completa. Entrada: região (e opcionalmente endereço). Saída: planilha unificada. |
| **scrapeIfoodLeads.js** | **Etapa 1 – Base de leads.** Gera a planilha de estabelecimentos do iFood por endereço/região. Entrada: endereço + sufixo (ex.: "Av Paulista 1000" SP). Saída: `ifoodLeads_XX.csv` (name, url, phone, cnpj, streetAddress, neighborhood, zipcode, rating, email, cuisine, priceRange). |
| **unificaIfoodInstagram.js** | **Etapa 2 – Unificação.** Lê o CSV do iFood, para cada linha busca o perfil no Instagram (nome + bairro + cidade), roda a análise completa do perfil e junta tudo em um CSV. Entrada: caminho do CSV iFood (ex.: ifoodLeads_SP.csv). Saída: `ifoodLeads_XX_unificado.csv`. |
| **scrapeInstagram.js** | **Análise do Instagram.** Abre perfil, extrai bio, link da bio, destaques (highlights), posts (ignora vídeo; em carrossel percorre as imagens), consulta link externo quando não for iFood, detecta “unidades” no texto. Expõe `runFullInstagramAnalysis()` para uso pelo unificador. Uso direto: `node scrapeInstagram.js USERNAME` ou `--login` para salvar sessão. |
| **instagram_ai.py** | **Análise com IA.** Chamado pelo scrapeInstagram: análise de imagens (visão) e resumo de tema/último post. Requer OPENAI_API_KEY e `pip install openai`. |
| **findInstagramByCnpj.js** | **Busca por CNPJ/nome.** Encontra perfil e userId do Instagram a partir de CNPJ (Brasil API) ou nome + cidade. Uso: `node findInstagramByCnpj.js --cnpj 123...` ou `--name "X" --city "Y"`. |
| **getInstagramUserId.js** | **Só userId.** Dado @username ou URL do perfil, abre o perfil e retorna o ID numérico (pk). Uso: `node getInstagramUserId.js nike`. |
| **buscaInstagramPorDados.js** | **Busca por nome.** Busca no DuckDuckGo “nome + local instagram” e retorna a primeira URL de perfil. Uso: `node buscaInstagramPorDados.js "Nome" "Cidade"` ou `--csv ifoodLeads_SP.csv` para preencher coluna. |
| **diagnoseIfood.js** | Diagnóstico/ajuste do fluxo iFood (se existir no projeto). |
| **requirements-instagram-ai.txt** | Dependências Python para a IA (openai). |

---

## Colunas da planilha unificada

- **Do iFood:** name, url, phone, cnpj, streetAddress, neighborhood, zipcode, rating, email, cuisine, priceRange  
- **Do Instagram:**  
  - instagram_profile_url, instagram_user_id  
  - tema_da_loja, ultimo_post  
  - **destaques** – análise dos highlights (stories em destaque; estáticos ou vídeos curtos)  
  - **unidades** – quantidade de unidades quando detectada (bio/legendas/destaques); vazio se não houver  
  - **link_externo** – URL do link da bio (quando não for iFood)  
  - **link_externo_resumo** – resumo do conteúdo da página do link externo  

---

## Fluxo resumido

1. **scraperFoodDefinitivo.js** recebe a região (ex.: SP).  
2. Chama **scrapeIfoodLeads.js** (endereço padrão da região ou informado) → gera `ifoodLeads_SP.csv`.  
3. Chama **unificaIfoodInstagram.js** com esse CSV.  
4. Para cada linha do CSV, **unificaIfoodInstagram.js**:  
   - Busca o Instagram (DuckDuckGo: nome + bairro + cidade).  
   - Chama **scrapeInstagram.js** (`runFullInstagramAnalysis`), que:  
     - Abre o perfil (bio, link, destaques, lista de posts).  
     - **Destaques:** abre cada highlight e extrai texto/alt (vídeo → “[contém vídeo]”).  
     - **Posts:** ignora vídeo; em carrossel avança e analisa cada imagem; usa **instagram_ai.py** quando disponível.  
     - **Link externo:** se o link da bio não for iFood, abre a página e gera resumo.  
     - **Unidades:** detecta padrões como “N unidades/lojas/filiais” em bio, legendas e destaques.  
5. Escreve **ifoodLeads_SP_unificado.csv** com todas as colunas acima.

---

## Opções úteis

- **scraperFoodDefinitivo.js SP --skip-ifood** – Não roda o iFood; só unifica usando `ifoodLeads_SP.csv` já existente.  
- **scraperFoodDefinitivo.js SP --limit 5** – Unifica só os 5 primeiros estabelecimentos (teste).  
- **unificaIfoodInstagram.js ifoodLeads_SP.csv --resume** – Só processa linhas que ainda não têm `instagram_user_id`.  
- **scrapeInstagram.js --login** – Abre o navegador para você logar no Instagram; a sessão fica salva para os scripts usarem.
