---
name: scrape-ifood-leads-by-region
description: Uses scrapeIfoodLeads.js to fetch a list of iFood leads for a given region. Use when the user wants to search for leads by region, get restaurante/dono de restaurante leads, or run the iFood scraper for a specific city or area.
---

# Buscar leads iFood por região

## Quando usar

- O usuário menciona **região**, **cidade**, **estado** ou **endereço** para buscar leads.
- Pedidos como "buscar leads em São Paulo", "leads na região X", "rodar o scraper para RJ".

## Como o script funciona

O arquivo `scrapeIfoodLeads.js` (na raiz do projeto Nola) aceita **dois argumentos** na linha de comando:

1. **Endereço** (argv[0]): endereço usado no iFood para definir a área de busca (ex.: "Av Paulista 1000, São Paulo").
2. **Sufixo** (argv[1]): identificador da região usado no nome do CSV de saída (ex.: "SP", "RJ"). O arquivo gerado será `ifoodLeads_<sufixo>.csv`.

## Instruções

1. **Identificar a região** que o usuário quer (cidade, estado ou endereço).
2. **Definir parâmetros**:
   - **Endereço**: usar um endereço representativo da região (ex.: centro da cidade ou endereço que o usuário informar). Se o usuário só disser "São Paulo", usar algo como "Av Paulista 1000, São Paulo".
   - **Sufixo**: sigla do estado (SP, RJ, MG, etc.) ou abreviação curta da região (máx. ~5 caracteres) para o nome do CSV.
3. **Executar** a partir da raiz do projeto:
   ```bash
   node scrapeIfoodLeads.js "<endereço>" "<sufixo>"
   ```
   Exemplo:
   ```bash
   node scrapeIfoodLeads.js "Av Paulista 1000, São Paulo" SP
   ```
4. **Resultado**: o script abre o Chrome, busca restaurantes na região no iFood, extrai dados (nome, telefone, CNPJ, endereço, etc.) e grava/atualiza `ifoodLeads_<sufixo>.csv` no diretório configurado no script (ex.: `c:\Users\jpins\Documents\Nola`).

## Regiões comuns (sugestão)

| Região        | Endereço exemplo                    | Sufixo |
|---------------|-------------------------------------|--------|
| São Paulo (SP)| Av Paulista 1000, São Paulo         | SP     |
| Rio (RJ)      | Avenida Engenheiro Gastão Rangel 393| RJ     |
| Belo Horizonte| Av Afonso Pena 1000, Belo Horizonte | MG     |
| Outras        | Perguntar endereço ou usar centro   | Sigla UF |

Se o usuário der um endereço exato, usar esse endereço e um sufixo coerente (estado ou nome curto da área).

## Observações

- O script usa Puppeteer com Chrome (não headless); a janela do navegador será aberta.
- O CSV é acumulativo: novos leads são adicionados sem duplicar por `url`.
- Dependências: `puppeteer`, `csvtojson`, `json-2-csv`. Rodar na pasta do projeto onde está o `package.json` com essas dependências.
