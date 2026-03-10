# Reestruturação do scrapeInstagram

## Objetivo

Extrair dados do perfil e dos posts de forma mais estável, e garantir que as **descrições interpretadas** (conclusão, punch line, destaques) sejam produzidas e retornadas pela IA com base nesses dados.

---

## 1. Fluxo em fases (documentado no código)

| Fase | O que faz |
|------|-----------|
| **1. Extrair perfil** | Abre o perfil, espera carregar, faz scroll para carregar mais posts, coleta bio, seguidores, links dos posts e (se existir) JSON embutido. |
| **2. Extrair posts** | Uma única aba: para cada link de post, navega, extrai legenda com várias estratégias no DOM e tira screenshot das imagens (incluindo carrossel). |
| **3. Descrever imagens** | Envia os screenshots ao Python (Vision): descrições objetivas (pratos, produtos, textos visíveis, ambiente) para uso na interpretação. |
| **4. Interpretar** | Monta `dados_perfil` (legendas + descrições), grava em temp, chama o Python para conclusão, último post, punch line e destaques (GPT em modo interpretativo). |

---

## 2. Ajustes de extração

### Perfil
- **Espera:** `domcontentloaded` + delay configurável (`PROFILE_LOAD_WAIT_MS`).
- **Scroll:** loop com reconsulta dos links após cada scroll; para quando atinge `maxPosts` ou não aparecem novos links por 2 rodadas; constantes `PROFILE_SCROLL_WAIT_MS` e `PROFILE_MAX_SCROLLS`.
- **Links:** normalização da URL (sem query) e uso de `Map` para evitar duplicados por shortcode.

### Legendas dos posts
- **Várias estratégias no browser** (função injetada no `page.evaluate`):
  1. **Containers:** `article`, `[role='dialog'] section/div`, `main section` → coleta textos de `span/div/p` com tamanho 20–3500 caracteres e que não sejam ruído (seguir, curtir, comentar, etc.).
  2. **Ordenação:** candidatos ordenados por tamanho; fica a maior string que pareça legenda.
  3. **Fallback:** todos os `span` em article/dialog.
  4. **Último recurso:** blocos de `body.innerText` separados por linha dupla; fica o maior bloco entre 30 e 2500 caracteres.

### Páginas de post
- **Timeouts e delays** em constantes: `POST_PAGE_TIMEOUT_MS`, `POST_PAGE_LOAD_MS`, `POST_CAROUSEL_NEXT_MS`, `POST_DELAY_BETWEEN_MS`.
- **Navegação:** uma única página; `goto` em cada post e delay entre posts para reduzir risco de bloqueio.
- **Carrossel:** botão “Next”/“Próximo”/“Go to next slide” para avançar e capturar mais imagens.

---

## 3. Interpretação (descrições interpretadas)

- **Vision (imagens):** prompt em `instagram_ai.py` ajustado para descrever “para análise de negócio” (pratos, produtos, textos visíveis, ambiente) e informar que a descrição será usada para concluir o tipo de estabelecimento.
- **Conclusão / último post / punch line:** respostas do GPT continuam validadas com `looksLikeRealAnalysis`; foi adicionado **fallback de aceite** quando o texto não passa na validação forte mas:
  - tem tamanho e número de palavras mínimos,
  - não é ruído de UI (“Foto do perfil de”, “Photo by”),
  - não é colagem óbvia de legenda (ex.: username solto).
- Assim, mais respostas **interpretadas** da IA são aceitas e retornadas, sem abrir espaço para texto que não seja análise.

---

## 4. Constantes de configuração (no topo do script)

```text
PROFILE_LOAD_WAIT_MS    espera após abrir o perfil
PROFILE_SCROLL_WAIT_MS  espera entre scrolls
PROFILE_MAX_SCROLLS     máximo de scrolls no perfil
POST_PAGE_LOAD_MS       espera após abrir cada post
POST_CAROUSEL_NEXT_MS   espera entre slides do carrossel
POST_DELAY_BETWEEN_MS   espera entre um post e outro
POST_PAGE_TIMEOUT_MS    timeout de carregamento da página do post
```

Em ambiente lento ou com muitas restrições, vale aumentar os delays e o timeout.

---

## 5. Como testar

1. **Um perfil:**  
   `node scrapeInstagram.js USERNAME` ou `node scrapeInstagram.js "https://www.instagram.com/USERNAME/"`

2. **Poucos posts (teste rápido):**  
   `node scrapeInstagram.js USERNAME --posts 5`

3. **Só interpretação (sem novo scrape):**  
   `node scrapeInstagram.js --from-temp instagram_temp/ultimo_dados_USERNAME.json`

4. Conferir saída em CSV (ou JSON com `--from-temp --output saida.json`): colunas `conclusao`, `punch_line`, `destaques_visao_geral` devem vir preenchidas com **texto interpretado** pela IA quando houver dados suficientes no perfil.

---

## 6. Limitações conhecidas

- **Instagram e DOM:** seletores e estrutura da página podem mudar; as várias estratégias de extração de legenda ajudam a manter resiliência.
- **Login:** perfis que exigem login continuam retornando `login_required`; usar `node scrapeInstagram.js --login` uma vez para salvar sessão.
- **Stories:** `stories_ativos_visao_geral` só é preenchido quando há story ativo no momento do scrape (24h).
