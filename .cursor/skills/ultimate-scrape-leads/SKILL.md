---
name: ultimate-scrape-leads
description: Runs the full leads pipeline: iFood scrape → update phones by CNPJ (Brasil API, only celular) → filter to leads with celular only → normalize DDD by city/region → Instagram scrape/unify → single definitive spreadsheet. Use when the user wants the complete refined leads workflow, "pipeline completo de leads", "planilha definitiva", "um comando", or "scrape completo com telefone e Instagram".
---

# Ultimate Scrape – Pipeline completo de leads

Orquestra o fluxo completo de captura e refinamento de leads: iFood → atualização de telefone por CNPJ (só celular) → filtro **apenas celular** → normalização de DDD por cidade/região → scrape/análise Instagram → **uma única planilha definitiva** pronta para uso. Não é necessário criar ou entregar planilhas intermediárias; só interessa o arquivo final refinado.

## Quando usar

- Usuário pede o **pipeline completo** de leads, **planilha definitiva**, ou **scrape completo** incluindo telefone e Instagram.
- Pedidos como "rodar o scrape do ifood, atualizar telefones, e gerar a planilha final com Instagram".
- Não usar para apenas uma etapa (ex.: só iFood → use a skill `scrape-ifood-leads-by-region`).

## Pré-requisitos

- **Instagram:** uma vez, rodar `node scrapeInstagram.js --login` e fazer login; a sessão fica salva.
- **Brasil API:** `atualizaTelefonePorCnpj.js` usa a API pública (sem chave); há delay entre requisições.
- **Opcional:** Python + `OPENAI_API_KEY` para análise com IA no Instagram (melhora tema/último post).

## Fluxo (ordem obrigatória)

1. **Scrape iFood** – gera a base de leads por região.
2. **Atualizar telefones por CNPJ** – enriquece phone/email via Brasil API; **grava na coluna phone só quando for celular** (11 dígitos com 3º=7, 8 ou 9). Fixo da API não sobrescreve (use `--incluir-fixo` no script se quiser).
3. **Filtrar só celular e normalizar DDD** – mantém apenas linhas com telefone **celular** (11 dígitos 3º=7,8,9 ou 9 dígitos começando com 7,8,9). **Todos os números saem com 11 dígitos (DDD + número):** o DDD é inferido automaticamente por cidade/região (coluna `regiao`, URL `delivery/cidade-uf/` ou trecho no `name`) usando o mapeamento em `ddd-brasil.js` / `ddd-cidades.json`. Opcional: `--ddd N` como fallback quando a inferência não achar cidade/UF.
4. **Unificar com Instagram** – sobre esse CSV (só celulares, phones já com DDD), roda busca de perfil + análise completa (destaques, posts, link externo, unidades). A saída desta etapa é a **planilha definitiva**.

Nenhuma planilha intermediária precisa ser aberta ou entregue; o resultado final é o CSV unificado da etapa 4.

## Um único comando (recomendado)

O script **`pipelineLeadsDefinitivo.js`** executa as 4 etapas em sequência. O usuário pode rodar só isso:

```bash
node pipelineLeadsDefinitivo.js SP
```

Ou com endereço, ou pulando iFood, ou usando a base "todos":

```bash
node pipelineLeadsDefinitivo.js "Av Paulista 1000" SP
node pipelineLeadsDefinitivo.js SP --skip-ifood
node pipelineLeadsDefinitivo.js --from-todos
node pipelineLeadsDefinitivo.js SP --limit 5
node pipelineLeadsDefinitivo.js "São José dos Campos" SP --ddd 12
```

- **DDD:** inferido por cidade/região (URL ou coluna `regiao`). Use `--ddd N` só como fallback quando a cidade não estiver no mapa.
- Saída final: `ifoodLeads_<sufixo>_com_contato_unificado.csv` (ou `ifoodLeads_todos_com_contato_unificado.csv` com `--from-todos`). Todos os telefones na planilha estão em 11 dígitos (DDD + número).

## Instruções para o agente (se não usar o comando único)

1. **Definir região e arquivos**
   - **Região:** sigla (ex.: SP, RJ) ou endereço + sufixo. Endereço padrão por região (ex.: SP → "Av Paulista 1000", RJ → "Avenida Engenheiro Gastão Rangel 393") está em `scraperFoodDefinitivo.js` ou na skill `scrape-ifood-leads-by-region`.
   - **CSV da etapa 1:** `ifoodLeads_<sufixo>.csv` (ex.: `ifoodLeads_SP.csv`).
   - **CSV filtrado (etapa 3):** `ifoodLeads_<sufixo>_com_contato.csv`.
   - **Planilha definitiva (etapa 4):** `ifoodLeads_<sufixo>_com_contato_unificado.csv` — este é o único arquivo final a considerar.

2. **Executar na raiz do projeto** (onde estão `scrapeIfoodLeads.js`, `atualizaTelefonePorCnpj.js`, etc.):

   **Etapa 1 – Scrape iFood**
   ```bash
   node scrapeIfoodLeads.js "<endereço>" "<sufixo>"
   ```
   Ex.: `node scrapeIfoodLeads.js "Av Paulista 1000, São Paulo" SP`

   **Etapa 2 – Atualizar telefones por CNPJ**
   ```bash
   node atualizaTelefonePorCnpj.js ifoodLeads_<sufixo>.csv
   ```
   (Atualiza o mesmo CSV in-place.)

   **Etapa 3 – Filtrar só celular e normalizar DDD**
   ```bash
   node exportaLeadsComContato.js ifoodLeads_<sufixo>.csv ifoodLeads_<sufixo>_com_contato.csv
   ```
   (DDD inferido por cidade/UF. Opcional: `--ddd 12` no fim se quiser fallback.)

   **Etapa 4 – Unificar com Instagram (planilha definitiva)**
   ```bash
   node unificaIfoodInstagram.js ifoodLeads_<sufixo>_com_contato.csv
   ```
   Saída: `ifoodLeads_<sufixo>_com_contato_unificado.csv`.

3. **Entregar ao usuário**
   - Informar que a **planilha definitiva** está em `ifoodLeads_<sufixo>_com_contato_unificado.csv`.
   - Opcional: sugerir copiar/renomear para algo como `leads_definitivo_<sufixo>.csv` se quiser um nome canônico; o conteúdo relevante é só esse arquivo.

## Variantes

- **Por região (padrão):** informar região/sufixo (ex.: SP, RJ). Roda as 4 etapas; planilha definitiva: `ifoodLeads_<sufixo>_com_contato_unificado.csv`.
- **Só uma região, sem rodar iFood:** se já existir `ifoodLeads_<sufixo>.csv`, começar pela etapa 2 (atualizar telefones) e seguir até a 4.
- **Base “todos”:** quando o usuário quiser usar a base já concatenada (`ifoodLeads_todos.csv`). **Não** rodar etapa 1; executar apenas etapas 2 → 3 → 4:
  - Entrada etapa 2: `ifoodLeads_todos.csv`
  - Saída etapa 3: `ifoodLeads_todos_com_contato.csv`
  - Planilha definitiva: `ifoodLeads_todos_com_contato_unificado.csv`

## Opções úteis

- **Teste rápido:** na etapa 2 use `--limit 10`; na etapa 4 use `--limit 5`: `node unificaIfoodInstagram.js ifoodLeads_<sufixo>_com_contato.csv --limit 5`
- **Retomar Instagram:** se o unificador parar no meio, rodar de novo com `--resume`:  
  `node unificaIfoodInstagram.js ifoodLeads_<sufixo>_com_contato.csv --resume`

## Telefone: só celular e DDD

- **Celular:** 11 dígitos (3º=7, 8 ou 9) ou 9 dígitos começando com 7, 8 ou 9 (Anatel). Fixo (10 dígitos ou 11 com 3º=2–6) é excluído do filtro e não é gravado pela etapa 2 quando vem da API.
- **DDD:** o `exportaLeadsComContato.js` usa `ddd-brasil.js` para inferir o DDD por **cidade** (mapeamento em `ddd-cidades.json`) ou por **UF** (DDD padrão do estado). A cidade/UF é obtida da coluna `regiao`, da URL (`/delivery/cidade-uf/`) ou do `name` (trecho entre `|`). Números de 9 dígitos recebem o DDD e saem com 11 dígitos. Para atualizar o mapa de cidades: `node build-ddd-map.js` (usa `ddd_sp_parse.txt` se existir; ver projeto).

## Observações

- **Scrape Instagram:** o recurso de análise do Instagram (perfil, destaques, posts, link externo) está em evolução; falhas ou mudanças de layout podem exigir ajustes em `scrapeInstagram.js` / `instagram_ai.py`.
- **Regras de dados:** seguir as regras do projeto: não inventar dados; preencher colunas apenas com conteúdo de fonte segura; campos sem dado deixar vazios (ver `.cursor/rules` e `REGRAS_DADOS_SCRAPER.md`).
- **Uma planilha final:** não é necessário criar ou destacar planilhas por etapa; apenas a planilha definitiva (unificado da etapa 4) é o entregável.

## Referência rápida de scripts e dados

| Script / arquivo | Função |
|------------------|--------|
| `scrapeIfoodLeads.js` | Gera CSV de leads iFood por endereço/região |
| `atualizaTelefonePorCnpj.js` | Atualiza phone/email pelo CNPJ; **grava phone só quando for celular** (11 dígitos 3º=7,8,9). Use `--incluir-fixo` para aceitar fixo. |
| `exportaLeadsComContato.js` | Filtra **apenas** linhas com telefone **celular** (11 ou 9 dígitos 7/8/9). Normaliza para 11 dígitos: **DDD inferido por cidade/UF** via `ddd-brasil.js`. Opcional: `--ddd N` como fallback. Use `--incluir-fixo` para aceitar fixo. |
| `ddd-brasil.js` | Lookup DDD por cidade (normalizada) e por UF; extrai cidade/UF do row (regiao, URL, name). Depende de `ddd-cidades.json`. |
| `ddd-cidades.json` | Mapeamento cidade → DDD (ex.: SP) e UF → DDD padrão. Gerado por `build-ddd-map.js`. |
| `build-ddd-map.js` | Regenera `ddd-cidades.json` (usa `ddd_sp_parse.txt` se existir para SP). |
| `unificaIfoodInstagram.js` | Busca Instagram + análise completa; gera CSV *_unificado.csv |
| `pipelineLeadsDefinitivo.js` | **Orquestrador:** um comando para as 4 etapas → planilha definitiva (só celulares, phones com DDD). |

Documentação detalhada: `ARQUIVOS_SCRAPER_FOOD.md`, `VISAO_FERRAMENTA_SCRAPE.md`.
