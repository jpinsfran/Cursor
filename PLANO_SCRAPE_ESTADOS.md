# Plano de scrape por estado – iFood

## Como o scrape funciona (área de busca)

O iFood **não usa raio em km**. O script informa **um endereço**; o site devolve os **restaurantes que entregam naquele endereço** (zona de entrega daquele ponto).

- **Entrada:** `node scrapeIfoodLeads.js "ENDEREÇO" SUFIXO`
- **Endereço:** logradouro + número + cidade (ex.: "Av Paulista 1000, São Paulo"). O iFood usa esse ponto para definir a região de entrega.
- **Sufixo:** identifica o CSV de saída: `ifoodLeads_SUFIXO.csv` (ex.: SP, RJ, BA).
- **Acúmulo:** se o CSV já existir, o script **adiciona só restaurantes novos** (por URL). Ou seja: você pode rodar vários endereços com o **mesmo sufixo** e o arquivo do estado vai crescendo.

**Conclusão:** para “varrer” um estado inteiro é preciso rodar o scrape com **vários endereços** em **várias cidades e bairros**, sempre com o mesmo sufixo do estado. Cada endereço cobre uma zona de entrega; somando zonas você cobre o estado.

---

## Estratégia por estado

Para cada estado:

1. **Cidades prioritárias:** capital + 1–3 cidades com mais iFood (grandes ou médias).
2. **Endereços por cidade:** 2–5 endereços (centro, bairros diferentes) para cobrir várias zonas.
3. **Comando:** um comando por endereço, mesmo sufixo (ex.: sempre `SP` para São Paulo).

Sugestão de **ordem de execução:** começar pelos estados mais populosos (SP, RJ, MG, BA, RS, PR, SC, etc.) e depois os menores.

---

## Comandos sugeridos por estado

Use o formato:  
`node scrapeIfoodLeads.js "Endereço completo, Cidade" UF`

(Substitua UF pelo sufixo do estado na tabela abaixo.)

### AC – Acre  
**Sufixo:** `AC`  
**Foco:** Rio Branco.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Ceará 1000, Rio Branco |
| 2 | Av. Brasil 500, Rio Branco |
| 3 | Rua Benjamim Constant 200, Rio Branco |

---

### AL – Alagoas  
**Sufixo:** `AL`  
**Foco:** Maceió.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Fernandes Lima 1000, Maceió |
| 2 | Av. Durval de Goés Monteiro 500, Maceió |
| 3 | Praia de Jatiúca, Maceió |

---

### AP – Amapá  
**Sufixo:** `AP`  
**Foco:** Macapá.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. FAB 1000, Macapá |
| 2 | Av. Procópio Rola 500, Macapá |

---

### AM – Amazonas  
**Sufixo:** `AM`  
**Foco:** Manaus.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Constantino Nery 1000, Manaus |
| 2 | Av. Djalma Batista 500, Manaus |
| 3 | Av. Torquato Tapajós 1000, Manaus |
| 4 | Centro, Manaus |

---

### BA – Bahia  
**Sufixo:** `BA`  
**Foco:** Salvador, Feira de Santana, Vitória da Conquista.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Tancredo Neves 1000, Salvador |
| 2 | Barra, Salvador |
| 3 | Pituba, Salvador |
| 4 | Av. Getúlio Vargas 500, Feira de Santana |
| 5 | Centro, Vitória da Conquista |

---

### CE – Ceará  
**Sufixo:** `CE`  
**Foco:** Fortaleza, Juazeiro do Norte.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Beira Mar 1000, Fortaleza |
| 2 | Aldeota, Fortaleza |
| 3 | Meireles, Fortaleza |
| 4 | Av. Padre Cícero 500, Juazeiro do Norte |

---

### DF – Distrito Federal  
**Sufixo:** `DF`  
**Foco:** Brasília (Plano Piloto + cidades satélites).

| # | Endereço sugerido |
|---|-------------------|
| 1 | SQS 116 Bloco A, Brasília |
| 2 | SBS Quadra 1, Brasília |
| 3 | Taguatinga Centro, Brasília |
| 4 | Águas Claras, Brasília |
| 5 | Ceilândia Centro, Brasília |

---

### ES – Espírito Santo  
**Sufixo:** `ES`  
**Foco:** Vitória, Vila Velha, Serra.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Vitória 1000, Vitória |
| 2 | Praia do Canto, Vitória |
| 3 | Av. Saturnino Rangel Mauro 500, Vila Velha |
| 4 | Centro, Serra |

---

### GO – Goiás  
**Sufixo:** `GO`  
**Foco:** Goiânia, Aparecida de Goiânia.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Anhanguera 1000, Goiânia |
| 2 | Setor Sul, Goiânia |
| 3 | Setor Marista, Goiânia |
| 4 | Av. Independência 500, Aparecida de Goiânia |

---

### MA – Maranhão  
**Sufixo:** `MA`  
**Foco:** São Luís, Imperatriz.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Litorânea 1000, São Luís |
| 2 | Renascença, São Luís |
| 3 | Av. Dorgival Pinheiro de Sousa 500, Imperatriz |

---

### MT – Mato Grosso  
**Sufixo:** `MT`  
**Foco:** Cuiabá, Várzea Grande.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Isaac Póvoas 1000, Cuiabá |
| 2 | Centro, Cuiabá |
| 3 | Av. Castelo Branco 500, Várzea Grande |

---

### MS – Mato Grosso do Sul  
**Sufixo:** `MS`  
**Foco:** Campo Grande, Dourados.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Afonso Pena 1000, Campo Grande |
| 2 | Centro, Campo Grande |
| 3 | Av. Marcelino Pires 500, Dourados |

---

### MG – Minas Gerais  
**Sufixo:** `MG`  
**Foco:** BH, Uberlândia, Contagem, Juiz de Fora.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Afonso Pena 1000, Belo Horizonte |
| 2 | Savassi, Belo Horizonte |
| 3 | Pampulha, Belo Horizonte |
| 4 | Av. João Naves 1000, Uberlândia |
| 5 | Av. João César de Oliveira 500, Contagem |
| 6 | Centro, Juiz de Fora |

---

### PA – Pará  
**Sufixo:** `PA`  
**Foco:** Belém, Ananindeua.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Presidente Vargas 1000, Belém |
| 2 | Nazaré, Belém |
| 3 | Av. Independência 500, Ananindeua |

---

### PB – Paraíba  
**Sufixo:** `PB`  
**Foco:** João Pessoa, Campina Grande.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Epitácio Pessoa 1000, João Pessoa |
| 2 | Tambaú, João Pessoa |
| 3 | Av. Floriano Peixoto 500, Campina Grande |

---

### PR – Paraná  
**Sufixo:** `PR`  
**Foco:** Curitiba, Londrina, Maringá, Ponta Grossa.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Sete de Setembro 1000, Curitiba |
| 2 | Batel, Curitiba |
| 3 | Av. Madre Leônia 500, Londrina |
| 4 | Av. Herval 500, Maringá |
| 5 | Centro, Ponta Grossa |

---

### PE – Pernambuco  
**Sufixo:** `PE`  
**Foco:** Recife, Olinda, Caruaru.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Boa Viagem 1000, Recife |
| 2 | Boa Viagem, Recife |
| 3 | Centro, Olinda |
| 4 | Av. Agamenon Magalhães 500, Caruaru |

---

### PI – Piauí  
**Sufixo:** `PI`  
**Foco:** Teresina, Parnaíba.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Frei Serafim 1000, Teresina |
| 2 | Centro, Teresina |
| 3 | Av. São Sebastião 500, Parnaíba |

---

### RJ – Rio de Janeiro  
**Sufixo:** `RJ`  
**Foco:** Capital (Zona Sul, Norte, Centro), Niterói, Nova Iguaçu.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. das Américas 1000, Rio de Janeiro |
| 2 | Copacabana, Rio de Janeiro |
| 3 | Tijuca, Rio de Janeiro |
| 4 | Centro, Rio de Janeiro |
| 5 | Av. Visconde do Rio Branco 500, Niterói |
| 6 | Centro, Nova Iguaçu |

---

### RN – Rio Grande do Norte  
**Sufixo:** `RN`  
**Foco:** Natal, Mossoró.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Praia de Ponta Negra 1000, Natal |
| 2 | Capim Macio, Natal |
| 3 | Av. Rio Branco 500, Mossoró |

---

### RS – Rio Grande do Sul  
**Sufixo:** `RS`  
**Foco:** Porto Alegre, Caxias do Sul, Pelotas, Canoas.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Osvaldo Aranha 1000, Porto Alegre |
| 2 | Moinhos de Vento, Porto Alegre |
| 3 | Av. Júlio de Castilhos 500, Caxias do Sul |
| 4 | Centro, Pelotas |
| 5 | Centro, Canoas |

---

### RO – Rondônia  
**Sufixo:** `RO`  
**Foco:** Porto Velho, Ji-Paraná.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Presidente Dutra 1000, Porto Velho |
| 2 | Av. Ji-Paraná 500, Ji-Paraná |

---

### RR – Roraima  
**Sufixo:** `RR`  
**Foco:** Boa Vista.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Capitão Ene Garcez 1000, Boa Vista |
| 2 | Centro, Boa Vista |

---

### SC – Santa Catarina  
**Sufixo:** `SC`  
**Foco:** Florianópolis, Joinville, Blumenau, Itajaí.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Beira Mar Norte 1000, Florianópolis |
| 2 | Centro, Florianópolis |
| 3 | Av. Getúlio Vargas 500, Joinville |
| 4 | Centro, Blumenau |
| 5 | Centro, Itajaí |

---

### SP – São Paulo  
**Sufixo:** `SP`  
**Foco:** Capital (várias zonas), Campinas, Santos, Ribeirão Preto, São José dos Campos, ABC.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Paulista 1000, São Paulo |
| 2 | Pinheiros, São Paulo |
| 3 | Vila Madalena, São Paulo |
| 4 | Moema, São Paulo |
| 5 | Centro, São Paulo |
| 6 | Av. Brasil 500, Campinas |
| 7 | Av. Ana Costa 500, Santos |
| 8 | Av. Nove de Julho 500, Ribeirão Preto |
| 9 | Av. São José 500, São José dos Campos |
| 10 | Rua da Consolação 500, Santo André |

---

### SE – Sergipe  
**Sufixo:** `SE`  
**Foco:** Aracaju.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Beira Mar 1000, Aracaju |
| 2 | Atalaia, Aracaju |
| 3 | Centro, Aracaju |

---

### TO – Tocantins  
**Sufixo:** `TO`  
**Foco:** Palmas.

| # | Endereço sugerido |
|---|-------------------|
| 1 | Av. Teotônio Segurado 1000, Palmas |
| 2 | Quadra 103 Sul, Palmas |
| 3 | Centro, Palmas |

---

## Resumo de execução

- **Um comando por linha da tabela**, com o sufixo do estado.
- Exemplo SP, primeiro endereço:  
  `node scrapeIfoodLeads.js "Av. Paulista 1000, São Paulo" SP`
- Depois, segundo endereço (mesmo arquivo):  
  `node scrapeIfoodLeads.js "Pinheiros, São Paulo" SP`
- Repita para todos os endereços do estado; o `ifoodLeads_SP.csv` vai acumular sem duplicar por URL.

**Ordem sugerida (por volume esperado):**  
SP → RJ → MG → BA → RS → PR → SC → PE → CE → DF → GO → ... → demais estados.

---

## Script auxiliar

O script **`run-scrapes-estado.js`** dispara todos os endereços de um estado em sequência (mesmo sufixo = mesmo CSV).

```bash
node run-scrapes-estado.js SP
node run-scrapes-estado.js RJ
node run-scrapes-estado.js SP --limit 3
```

- **UF:** sigla do estado (AC, AL, ..., TO).
- **--limit N:** roda só os N primeiros endereços (útil para teste).
- Cada endereço roda um `scrapeIfoodLeads.js` completo; o CSV `ifoodLeads_UF.csv` acumula sem duplicar por URL.

---

## Endereços no Supabase (relevant_addresses)

O plano de endereços por estado pode ser persistido no Supabase para ser a **fonte única de verdade** do orquestrador.

- **Tabela:** `relevant_addresses` (campos: `address`, `uf`, `city`, `label`, `execution_order`, `is_active`, `source`).
- **Migrations:** `supabase/migrations/002_relevant_addresses.sql` (cria a tabela), `003_seed_relevant_addresses.sql` (insere os endereços deste plano).
- **Comportamento do `run-scrapes-estado.js`:** se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estiverem no `.env`, o script consulta `relevant_addresses` por UF e usa essa lista; caso contrário (ou tabela vazia), usa a lista estática embutida no código.

**Como aplicar as migrations:**

1. **Pelo dashboard Supabase:** em SQL Editor, execute na ordem o conteúdo de `002_relevant_addresses.sql` e depois `003_seed_relevant_addresses.sql`.
2. **Pelo CLI (projeto linkado):** `npx supabase link` (uma vez) e depois `npx supabase db push`.

Para adicionar ou editar endereços: inserir/atualizar na tabela `relevant_addresses` (por exemplo via dashboard ou script); o orquestrador passa a usar os dados na próxima execução.
