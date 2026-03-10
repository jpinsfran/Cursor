# Análise da estrutura HubSpot para exportação de deals perdidos

## Objetivo

Exportar duas planilhas (pipeline SDR e pipeline CLOSER) com deals em estágio **Perdido**, usando as propriedades corretas de **deal** e **contact**.

---

## 1. Propriedades consultadas

### 1.1 Deal (objeto `deals`)

| Você indicou | Nome interno no HubSpot | Status | Observação |
|--------------|------------------------|--------|------------|
| Nome do negócio | `dealname` | ✅ Existe | Nome do negócio no deal. |
| Qual feature está indisponível | `qual_feature_esta_indisponivel_` | ✅ Existe | Enumeração (multi-select); label: "Qual feature está indisponível?". |
| Motivo fechamento perdido | **`motivo_de_perda`** | ❌ **Não existe** | A API retorna 404 para `motivo_de_perda`. A propriedade que existe e tem o mesmo significado é **`closed_lost_reason`** (label: "Motivo de fechamento perdido"). **Uso na exportação: `closed_lost_reason`.** |
| Data entrada em perdido SDR | `hs_v2_date_entered_246594929` | ✅ Existe | Label: "Date entered \"Perdido (SDR - Nola)\"". Preenchida apenas para deals do pipeline SDR. |
| Data entrada em perdido CLOSER | `hs_v2_date_entered_closedlost` | ✅ Existe | Label: "Date entered \"Perdido (Closer - Nola)\"". Preenchida apenas para deals do pipeline Closer. |
| Número de lojas | `numero_de_lojas` | ✅ Existe | Tipo number. |
| Observação | `observacao_de_importacao` (e/ou `notes`, `description`) | ✅ Existem | Usei `observacao_de_importacao` como principal. |

**Resumo:** Tudo que você pediu no deal existe e é puxável, **exceto** `motivo_de_perda`. Para motivo de perda usamos **`closed_lost_reason`**.

---

### 1.2 Contact (objeto `contacts`)

| Campo desejado | Propriedade | Status | Observação |
|----------------|-------------|--------|------------|
| Nome do contato no negócio | `firstname` | ✅ Existe | Label: "First Name". |

O contato não vem no objeto deal; é preciso:

1. **Associação deal → contacts:** `hubspot-list-associations` com `objectType: "deals"`, `objectId: <dealId>`, `toObjectType: "contacts"`.
2. **Leitura do contato:** com os IDs retornados, usar `hubspot-batch-read-objects` em `contacts` com `properties: ["firstname"]`.

**Regra quando há mais de um contato no deal:** hoje uso o **primeiro** contato retornado pela API para preencher "Nome do contato no negócio". Não há filtro por “contato principal” na associação deal–contact no MCP usado.

---

## 2. O que não consigo puxar (ou exige ressalva)

1. **`motivo_de_perda`**  
   Não existe como propriedade em deals. Uso **`closed_lost_reason`** em todo o fluxo e nas planilhas.

2. **Fase do funil em que foi perdido**  
   Como combinado, deixado de lado (exigiria mapear estágios por pipeline).

3. **Nome do contato no negócio**  
   É possível puxar (`firstname` do contact associado ao deal), mas:
   - É preciso **1 chamada de associação por deal** (deal → contacts).
   - Depois, **batch-read** dos contacts (até 100 por chamada).
   - Para ~400 deals são centenas de chamadas ao MCP; por isso a exportação em massa pode ser feita em etapas ou por script com token (fora do MCP).

4. **“Contato principal” do deal**  
   A API de associações devolve uma lista de contact IDs; não há no MCP um filtro por “contato principal” do negócio. Por isso, na prática, uso o primeiro contato da lista.

---

## 3. Estrutura das planilhas (colunas finais)

Sem a coluna “fase do funil” e com as propriedades corretas:

- **Nome do negócio** → `dealname`
- **Nome do contato no negócio** → `firstname` do (primeiro) contact associado ao deal
- **Qual feature está indisponível** → `qual_feature_esta_indisponivel_`
- **Motivo fechamento perdido** → `closed_lost_reason` (no HubSpot não existe `motivo_de_perda`)
- **Data entrada em perdido SDR** → `hs_v2_date_entered_246594929` (relevante no CSV SDR)
- **Data entrada em perdido CLOSER** → `hs_v2_date_entered_closedlost` (relevante no CSV CLOSER)
- **Número de lojas** → `numero_de_lojas`
- **Observação** → `observacao_de_importacao` (e fallback para `notes`/`description` se quiser)
- **Observações de atividades** → concatenação do conteúdo das **Notas** (objeto `notes`) associadas ao negócio. Não fica no deal; vem das atividades (timeline). Ver secção abaixo.

### Onde ficam as "observações de atividades"

As observações que foram feitas **nas atividades** do negócio estão nas **Notas** (objeto `notes`) associadas ao deal no HubSpot.

| O quê | Onde |
|-------|------|
| Objeto | `notes` (CRM object) |
| Associação | deal → notes (via `hubspot-list-associations` com `toObjectType: "notes"`) |
| Conteúdo da observação | Propriedade **`hs_note_body`** (texto em HTML) |
| Ordem / data | `hs_timestamp` ou `hs_createdate` para ordenar ao concatenar |

**Fluxo para preencher a coluna:** para cada deal, listar IDs das notas associadas (`list-associations` deal → notes), depois fazer `batch-read` em `notes` com `properties: ["hs_note_body", "hs_timestamp"]`, extrair texto do HTML de `hs_note_body` e concatenar (ex.: por ordem de data, separando com " | " ou quebra de linha).

**Como preencher a coluna em massa:** para cada deal é preciso (1) `hubspot-list-associations` (deal → notes) para obter os IDs das notas; (2) `hubspot-batch-read-objects` (objectType: notes, properties: hs_note_body, hs_timestamp) para ler o conteúdo; (3) remover HTML de `hs_note_body` e concatenar (ex.: por data, separando com " | "). O script de exportação v3 lê um arquivo **`scripts/deal_notes_observations_map.json`** no formato `{ "dealId": "texto concatenado", ... }`. Esse mapa pode ser gerado rodando o fluxo acima para todos os deal IDs (ex.: via MCP em lotes ou script Node com token HubSpot). O repositório inclui um mapa de exemplo com 3 deals; para os 400 deals são necessárias centenas de chamadas (1 list-associations por deal + batch-read das notas).

**Limitação:** outras atividades (reuniões, chamadas, e-mails) podem ter descrição/observação em objetos `meetings`, `calls`, etc. O MCP atual foi testado com **notes**; associações deal → meetings/calls podem ser consultadas da mesma forma se precisar incluir mais tipos depois.

---

## 4. Pipelines e estágios usados na exportação

- **Pipeline CLOSER (Nola):** `pipeline: "default"`, estágio perdido: `dealstage: "closedlost"`.
- **Pipeline SDR (Nola):** `pipeline: "145028430"`, estágio perdido: `dealstage: "246594929"`.

Arquivos gerados:

- `hubspot_perdidos_pipeline_CLOSER.csv` → deals com `pipeline: "default"` e `dealstage: "closedlost"`.
- `hubspot_perdidos_pipeline_SDR.csv` → deals com `pipeline: "145028430"` e `dealstage: "246594929"`.

---

## 5. Resultado da exportação (v2)

Os CSVs foram regenerados com as colunas: Nome do negócio, Nome do contato no negócio, Qual feature está indisponível, Motivo fechamento perdido (usando `closed_lost_reason`), Data entrada perdido SDR (`hs_v2_date_entered_246594929`), Data entrada perdido CLOSER (`hs_v2_date_entered_closedlost`), Número de lojas, Observação. Nome do contato fica em branco nesta exportação. Arquivos: `hubspot_perdidos_pipeline_CLOSER.csv` e `hubspot_perdidos_pipeline_SDR.csv`. Script: `scripts/export-hubspot-perdidos-v2.cjs`.

---

## 6. Próximos passos possíveis

1. **Preencher "Nome do contato no negócio"**: rodar associações deal→contact (1 chamada por deal) e batch-read de contacts. São centenas de chamadas MCP; pode ser feito em etapas ou por script com token da API.
2. Se existir propriedade **custom** `motivo_de_perda` no portal, avisar para ajustar; até lá usa-se **`closed_lost_reason`**.