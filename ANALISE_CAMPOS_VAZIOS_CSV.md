# Análise profunda: por que os campos estão vazios no CSV unificado

## Origem do CSV

O arquivo `ifoodLeads_com_contato_unificado_unificado.csv` é produzido por:

1. **Concatenação** (`concatenaComContato.js`): junta vários `*_com_contato.csv` → `ifoodLeads_com_contato_unificado.csv`. As colunas vêm dos CSVs de entrada (iFood + atualização por CNPJ). São adicionadas `regiao` e `instagramUrl` se não existirem (vazias).
2. **Unificação com Instagram** (`unificaIfoodInstagram.js`): lê o CSV unificado, para cada linha **busca o perfil no Instagram** via DuckDuckGo (nome + bairro + cidade), abre o perfil, roda análise (scrape + IA) e **sobrescreve/adiciona**: `instagram_profile_url`, `instagram_user_id`, `seguidores`, `conclusao`, `punch_line`, `destaques_visao_geral`, `stories_ativos_visao_geral`.

Ou seja: **instagramUrl** vem do passo 1 (quase sempre vazio, pois os CSVs de entrada não preenchem). **instagram_profile_url** e o restante vêm do passo 2.

---

## Campo a campo: causa do vazio e correção

### 1. `instagramUrl` vazio

- **Causa:** A concatenação só garante que a coluna existe; o valor vem dos CSVs de entrada, que em geral não têm Instagram. O unifica preenche apenas `instagram_profile_url` quando encontra perfil.
- **Correção:** No `unificaIfoodInstagram.js`, quando um perfil é encontrado e preenchido, definir também `row.instagramUrl = row.instagram_profile_url` (ou o mesmo valor), para que não fique vazio.

---

### 2. `instagram_profile_url` / `instagram_user_id` vazios (ex.: Dom Lugão, linha 10)

- **Causa:** A **busca** (DuckDuckGo com "nome + bairro + cidade + instagram") não retornou link de perfil, ou a **análise** (`runFullInstagramAnalysis`) falhou (timeout, login exigido, perfil privado, rede, etc.). Quando a busca falha, o unifica deixa todos os campos de Instagram vazios; quando a análise falha, grava a URL encontrada mas deixa `userId`, `seguidores`, conclusão etc. vazios.
- **Correção:**  
  - Melhorar a query de busca (ex.: incluir "site:instagram.com" ou variantes do nome).  
  - Se já existir `instagramUrl` no CSV de entrada (ex.: de outro script como findInstagramByCnpj), usar essa URL em vez de buscar de novo.  
  - Tratar melhor erros (retry, mensagem clara no log).

---

### 3. `seguidores` vazio ou inconsistente

- **Causa:** No `scrapeInstagram.js` os seguidores vêm de um **regex no texto da página**:  
  `/([\d.,]+(?:K|M|mil)?)\s*(?:seguidores|followers)/i`.  
  Se o Instagram mudar o layout, ou o texto estiver em outro formato (ex.: "1,2 mil seguidores", "1.2K", ou número em outro elemento), o regex não encontra e o campo fica vazio.
- **Correção:**  
  - Vários fallbacks na extração: além do regex no `body.innerText`, tentar seletores específicos (ex.: spans que contenham "seguidores"/"followers") e formatos como "1.2 mil", "1,481", "1.2K", "2M".  
  - Normalizar o valor antes de gravar (ex.: converter "1.481" em número quando for conveniente para exibição).

---

### 4. `conclusao` e `punch_line` vazios na maioria das linhas

- **Causas (combinadas):**  
  - **Validação (`looksLikeRealAnalysis`)**: o texto devolvido pela IA é rejeitado por parecer “colagem de legenda” ou ruído (ex.: username, "Foto do perfil de X"). Ajustes já feitos relaxaram um pouco, mas ainda pode haver rejeição em respostas curtas ou com formato inesperado.  
  - **IA não retorna nada útil:** timeout, erro de API, ou o modelo devolve string vazia / texto que não atende ao prompt.  
  - **Entrada pobre:** perfis com poucos posts ou só imagens sem legenda geram pouco contexto; a IA pode devolver vazio ou algo que a validação descarta.

- **Correção:**  
  - **Validação:** Aceitar respostas um pouco mais curtas (ex.: ≥4 palavras, sem ruído óbvio) para conclusão/punch line, e registrar em log quando for rejeitado (para ajuste fino).  
  - **Fallback:** Se a IA falhar ou o texto for rejeitado, usar um fallback **apenas com dados da fonte**: ex.: uma linha com “Resumo: [primeiras 80 caracteres das legendas agregadas]” ou “Perfil: [bio]”, sem inventar. Assim o campo não fica vazio e continua rastreável.  
  - **Temp file:** O fluxo que grava `dados_perfil.json` permite reprocessar só a interpretação; rodar de novo com prompts/validação ajustados pode preencher mais campos sem novo scrape.

---

### 5. `destaques_visao_geral` vazio na maioria

- **Causa:** Só é preenchido quando (1) o perfil tem **destaques** (highlights), (2) o scrape abre e lê os slides, (3) a IA gera um resumo e (4) esse resumo passa na validação `looksLikeRealAnalysis`. Muitos perfis não têm destaques; em outros o resumo é rejeitado ou a IA falha.
- **Correção:** Mesmo raciocínio que conclusão: fallback com trecho do conteúdo real (ex.: títulos dos destaques) quando a visão geral interpretada for rejeitada; relaxar um pouco a validação para resumos curtos mas coerentes.

---

### 6. `stories_ativos_visao_geral` quase sempre vazio

- **Causa:** Stories duram **24 horas**. Só há conteúdo se o perfil tiver **story ativo no momento do scrape**. Na maior parte das execuções não há story, então o campo fica vazio por design.
- **Correção:** Não é bug. Pode ser documentado no cabeçalho do CSV ou no README que esse campo só é preenchido quando há story ativo no momento da coleta.

---

### 7. `email` com valor literal `"false"`

- **Causa:** No **scrape do iFood** (`scrapeIfoodLeads.js`), o email é extraído com algo como  
  `body.split("otpEmail")[1].split(":")[1].split(",")[0]`.  
  Na página, o campo pode vir como `"otpEmail":false` (boolean). O split produz a **string** `"false"`, que é gravada no CSV. O `atualizaTelefonePorCnpj.js` só **substitui** email quando a API retorna um email válido; se não retornar, o `"false"` do iFood permanece.
- **Correção:** No `scrapeIfoodLeads.js`, após obter `email`, normalizar: se for `"false"`, `"null"`, ou não contiver `@`, usar `""`. No unifica (e em qualquer escrita de CSV), ao gravar a coluna email, se o valor for a string `"false"` ou `"null"`, gravar `""`.

---

## Resumo das ações recomendadas

| Prioridade | Campo(s)           | Ação                                                                 |
|------------|--------------------|----------------------------------------------------------------------|
| Alta       | email "false"      | Normalizar no scrape iFood e na escrita do CSV (unifica/outros).    |
| Alta       | instagramUrl       | Preencher com `instagram_profile_url` no unifica quando houver.      |
| Alta       | conclusao/punch_line | Relaxar validação e/ou fallback com resumo curto da fonte (legendas/bio). |
| Média      | seguidores         | Vários fallbacks de extração no scrapeInstagram (regex + DOM).     |
| Média      | destaques_visao_geral | Idem conclusão: fallback com títulos; validação menos rígida.   |
| Baixa      | Instagram não encontrado | Melhorar busca (query); **usar instagramUrl/instagram_profile_url da linha quando já preenchido** (pular DuckDuckGo). |
| Documentar | stories_ativos    | Deixar claro que só preenche se houver story ativo na hora.         |

---

## Implementado nesta correção

- **Email "false"**: normalizado em `scrapeIfoodLeads.js` (não gravar "false"/"null") e em `unificaIfoodInstagram.js` (sanitizeRow limpa email "false"/"null").
- **instagramUrl**: preenchido com `instagram_profile_url` no unifica quando o perfil é encontrado.
- **Seguidores**: múltiplos fallbacks de extração em `scrapeInstagram.js` (regex alternativo + spans do header).
- **conclusao / punch_line**: fallback com trecho da **fonte** (primeira legenda para conclusão, legenda do último post para punch line) quando a IA não retorna ou o texto é rejeitado.

---

## Fluxo de dados (referência)

```
[iFood scrape] → phone, cnpj, email (pode vir "false"), ...
     ↓
[atualizaTelefonePorCnpj] → atualiza phone/email por CNPJ (não remove "false")
     ↓
[concatenaComContato] → regiao, instagramUrl (vazio se não existir na entrada)
     ↓
[unificaIfoodInstagram] → busca Instagram (DuckDuckGo) → scrapeInstagram + IA
     ↓
     → instagram_profile_url, instagram_user_id, seguidores, conclusao, punch_line,
       destaques_visao_geral, stories_ativos_visao_geral
```

Qualquer campo que dependa de “busca + análise” pode ficar vazio se a busca não achar perfil ou se a análise falhar/timeout/rejeitar saída da IA.
