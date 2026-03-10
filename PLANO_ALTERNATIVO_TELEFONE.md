# Plano alternativo: obter telefone por CNPJ ou nome + localização

Quando a **Brasil API (Receita)** não retorna telefone ou retorna só fixo, estas são alternativas viáveis para enriquecer a coluna `phone` dos leads.

---

## 1. Por CNPJ (fontes alternativas à Brasil API)

### 1.1 OpenCNPJ (gratuito)
- **URL:** `https://kitana.opencnpj.com/cnpj/{cnpj}` (14 dígitos)
- **Campo na resposta:** `data.telefone` (string, ex.: "(11) 98765-4321")
- **Limite:** 100 req/min
- **Fonte:** dados públicos (mesma base Receita em muitos casos; pode haver diferenças de formato ou atualização)
- **Uso:** usar como **segunda tentativa** após Brasil API: se Brasil API retornar vazio ou só fixo, chamar OpenCNPJ e, se vier celular, preencher.

### 1.2 CNPJ.ws (grátis limitado / pago)
- **URL:** API pública em `publica.cnpj.ws` – a documentação indica que a **API pública** pode não incluir telefone; a API comercial (paga) tem mais campos.
- **Uso:** avaliar se o plano pago compensa para o volume desejado; documentação em https://docs.cnpj.ws

### 1.3 Outras APIs (Sintegra, etc.)
- APIs como Sintegra WS / Sintegra API costumam exigir **token e créditos** (modelo pago).
- Incluir no plano apenas se houver orçamento e necessidade de alto volume.

**Recomendação:** implementar **Brasil API → OpenCNPJ** em sequência no mesmo script (Brasil API primeiro; se phone vazio ou só fixo e quiser celular, tentar OpenCNPJ).

---

## 2. Por nome e localização da empresa

### 2.1 Google Places API (Text Search + Place Details)
- **Como funciona:** busca por texto (nome + cidade/endereço) → obtém `place_id` → Place Details retorna `formatted_phone_number` / `international_phone_number`.
- **Requisitos:** conta Google Cloud, ativar Places API (New), **chave de API** (cobrança após créditos gratuitos).
- **Campos úteis:** `Place Details` com máscara que inclua `formattedPhoneNumber` ou equivalente.
- **Limitações:** custo por requisição; rate limits; nem todo estabelecimento tem ficha no Google com telefone.

**Passos técnicos:**
1. Text Search: `GET` com `query="Nome do Estabelecimento Cidade Estado"` (ex.: "Big Moqueca Salvador BA").
2. Pegar o primeiro `place_id` do resultado.
3. Place Details com esse `place_id` e campo de telefone.
4. Normalizar número (só dígitos, DDD) e classificar celular vs fixo com a mesma regra do projeto (11 dígitos, 3º = 7, 8 ou 9).

### 2.2 Busca web (scraping)
- **Ideia:** buscar no Google (ou Bing) `"nome empresa" "cidade" telefone` e extrair número da página de resultados ou de um resultado (ex.: site do estabelecimento, lista).
- **Problemas:** fragilidade (layout do Google muda), possível violação de ToS, necessidade de parsing complexo e tratamento de muitos formatos.
- **Recomendação:** usar só como último recurso e com cuidado legal; preferir Places API se for automatizar.

### 2.3 Google Maps (scraping)
- Abrir URL do tipo `https://www.google.com/maps/search/nome+empresa+cidade` e extrair telefone da ficha do lugar.
- **Problemas:** mesmo que Places (ToS, mudanças de layout, bloqueios). Só considerar em cenário controlado e com responsabilidade do usuário.

**Recomendação:** priorizar **Google Places API** (nome + localização) se você tiver chave e orçamento; tratar como camada opcional após as fontes por CNPJ.

---

## 3. Ordem sugerida no pipeline

Ordem recomendada para preencher `phone` (sem inventar dado; só gravar o que vier da fonte):

| Ordem | Fonte              | Entrada              | Observação                          |
|-------|--------------------|----------------------|-------------------------------------|
| 1     | iFood (já no CSV) | —                    | Manter; muitas vezes já é celular.  |
| 2     | Brasil API         | CNPJ                 | Atual (só celular ou + fixo com flag). |
| 3     | OpenCNPJ           | CNPJ                 | Fallback se 2 retornar vazio/fixo.  |
| 4     | Google Places      | Nome + cidade/UF     | Opcional; requer API key.           |

Regras do projeto: não preencher com texto genérico; se não houver número válido da fonte, deixar vazio.

---

## 4. O que implementar no projeto

### Já existente
- Brasil API em `atualizaTelefonePorCnpj.js` (só celular por padrão; `--incluir-fixo` para fixo).
- Normalização e DDD por cidade/UF em `exportaLeadsComContato.js` + `ddd-brasil.js`.

### Recomendado em seguida
1. **OpenCNPJ como fallback no mesmo script**
   - Após `fetchDadosCnpj` (Brasil API), se `phone` vazio ou (quando não usar `--incluir-fixo`) só fixo, chamar OpenCNPJ com o mesmo CNPJ.
   - Parsear `data.telefone` (remover formatação, 10–11 dígitos), aplicar mesma regra celular/fixo e só então atualizar `row.phone` se for celular (ou fixo se `--incluir-fixo`).

2. **Módulo opcional “Google Places”**
   - Novo script ou função: entrada = nome + cidade (e opcional UF/endereço); saída = telefone formatado ou vazio.
   - Chamar só para linhas em que, após Brasil API + OpenCNPJ, `phone` ainda estiver vazio; usar variável de ambiente para a chave (ex.: `GOOGLE_PLACES_API_KEY`).

3. **Logs e métricas**
   - Contadores: “preenchido por Brasil API”, “preenchido por OpenCNPJ”, “preenchido por Places”, “mantido do iFood”, “permanece vazio”.
   - Ajuda a medir se o plano alternativo está trazendo ganho real.

---

## 5. Resumo

- **Por CNPJ:** manter Brasil API como principal; adicionar **OpenCNPJ** como segunda tentativa; outras APIs (CNPJ.ws pago, Sintegra) só se justificarem custo/volume.
- **Por nome e localização:** **Google Places API** é a opção mais estável e “oficial”; scraping em Google/Maps é possível mas mais frágil e sensível a ToS.
- **Ordem no pipeline:** iFood → Brasil API → OpenCNPJ → (opcional) Google Places; em cada etapa, só gravar quando a fonte retornar número válido e respeitando a regra celular/fixo do projeto.
