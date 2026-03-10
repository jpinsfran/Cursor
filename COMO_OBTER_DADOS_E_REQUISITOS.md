# Como obter os dados e o que você precisa fornecer

Este documento explica **como cada dado é obtido** e **o que você precisa** (permissões, chaves, configuração) para o fluxo iFood + Instagram funcionar de forma otimizada.

**Regra:** Nunca inventar informação. Todos os campos são preenchidos apenas com dados de fonte segura (página, API, imagem). Se não houver dado ou certeza, o campo fica vazio.

---

## 1. Dados que o sistema gera e onde vêm

| Coluna | Origem | Como é obtido |
|--------|--------|----------------|
| **perfil** | Instagram | Nome completo + bio do perfil (extraídos da página com Puppeteer). |
| **seguidores** | Instagram | Número de seguidores (texto da página, ex.: "1,2 mil", "5K"). |
| **seguindo** | Instagram | Número de contas que o perfil segue (mesmo método). |
| **tema_da_loja** | Bio + posts + IA | Resumo em 1 parágrafo do ramo/foco do perfil. Com **OPENAI_API_KEY**: IA resume bio + legendas + descrições das imagens. Sem: usa bio + início das legendas. |
| **ultimo_post** | Último post + IA | Legenda + análise da imagem do último post. Com IA: descrição completa e **o que foi anunciado/divulgado** no post. |
| **destaques** | Highlights | Abre cada destaque, tira screenshot (foto ou frame do vídeo) e, com IA, descreve o conteúdo. Sem IA: usa texto/alt da página. |
| **posts** | Últimos 20 posts | Legendas + uma imagem por post (ou todas do carrossel). Com IA: um parágrafo resumindo temas, produtos, serviços. Vídeos são ignorados; posts “só foto de comida” podem ser omitidos no resumo. |
| **unidades** | Bio + legendas + destaques | Regex em texto: "N unidades", "N lojas", "N filiais", etc. |
| **funcionarios** | Bio + legendas + destaques | Regex: "N funcionários", "N colaboradores", "equipe", etc. |
| **link_externo** | Link da bio | URL do link da bio (se não for ifood.com.br). |
| **link_externo_resumo** | Página do link | Acesso à URL, extrai título + meta + corpo. Com IA: análise completa do site (o que é, ofertas, contato). |
| **contextualizacao_loja** | Prospecção | Um único texto que resume a loja (perfil, tema, destaques, posts, link, unidades) para personalizar o atendimento. Com IA: parágrafo de contexto para o time de prospecção. |
| **punch_line** | Prospecção | Gancho curto (1–2 frases) a partir do último post para abrir a conversa (ex.: "Vi que vocês postaram sobre X..."). |

---

## 2. O que você precisa fornecer

### 2.1 Login no Instagram (obrigatório)

O Instagram exige login para ver perfis completos (bio, seguidores, posts, destaques).

- **Como:** rode uma vez:  
  `node scrapeInstagram.js --login`  
  Faça login na janela que abrir e feche (ou espere 2 min). A sessão fica salva em `instagram_chrome_profile/`.
- **Permissão:** uso da sua conta apenas para o script abrir páginas e ler conteúdo público (não posta nada).

### 2.2 Chave da OpenAI (recomendado para qualidade)

Sem a chave, o sistema usa só texto e alt das imagens (sem análise de imagem nem resumos por IA).

- **Onde obter:** [platform.openai.com](https://platform.openai.com) → API keys → criar chave.
- **Uso:** análise de imagens (Vision) e resumos de texto (Chat). Modelo: `gpt-4o-mini` (mais barato).
- **Configurar:**  
  No Windows (PowerShell):  
  `$env:OPENAI_API_KEY = "sua-chave-aqui"`  
  Ou: Painel do sistema → Variáveis de ambiente → adicionar `OPENAI_API_KEY`.

### 2.3 Chrome instalado

O Puppeteer usa o Chrome para automatizar o navegador. O script procura em:

- Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Linux: `/usr/bin/google-chrome`

Se o Chrome estiver em outro caminho, ajuste a variável `CHROME_PATH` nos scripts.

### 2.4 Python 3 (para IA)

Só é necessário se você for usar a análise com IA (recomendado).

- **Instalar:** [python.org](https://www.python.org/downloads/) (3.8+).
- **Pacote:** `pip install openai`
- **Arquivo de dependências:** `requirements-instagram-ai.txt` no projeto.

---

## 3. Como melhorar os resultados

1. **Sempre configurar OPENAI_API_KEY**  
   Melhora muito: tema_da_loja, ultimo_post (incluindo “o que foi anunciado”), destaques, posts e link_externo_resumo.

2. **Fazer login no Instagram uma vez**  
   Evita bloqueios e permite acessar seguidores, seguindo, bio e posts.

3. **Usar --limit em testes**  
   Ex.: `node unificaIfoodInstagram.js ifoodLeads_SP.csv --limit 3`  
   Assim você valida as colunas e a qualidade antes de rodar a planilha inteira.

4. **Planilha em tempo real**  
   O CSV unificado é gravado após cada lead. Se o script parar no meio, o que já foi processado permanece no arquivo.

---

## 4. Permissões e limites

- **Instagram:** o script só lê dados que um usuário logado veria (perfil, posts, destaques). Não posta, não curte, não segue. O uso deve respeitar os termos do Instagram e boas práticas (evitar muitas requisições seguidas).
- **OpenAI:** as chamadas usam sua própria API key e consomem créditos da sua conta.
- **Links externos:** o script acessa o link da bio (ex.: site do restaurante) só para extrair título e texto e, com IA, gerar o resumo. Não preenche formulários nem interage com o site.

---

## 5. Resumo rápido

| O que | Ação |
|-------|------|
| Ver seguidores/seguindo e bio | Fazer login no Instagram (`node scrapeInstagram.js --login`). |
| Análise de imagem e resumos em texto | Definir `OPENAI_API_KEY` e ter Python + `openai` instalado. |
| Análise completa do link da bio | Mesmo: OPENAI_API_KEY; o script acessa a URL e envia o texto para a IA. |
| Destaques (foto e vídeo) | Screenshot de cada destaque + IA para descrever (ou só texto/alt sem IA). |
| Últimos 20 posts (ignorar vídeo; carrossel = todas as imagens) | Já implementado; com IA gera a coluna **posts** resumida. |

Se algo não estiver funcionando (ex.: coluna vazia, erro de login, “Configure OPENAI”), confira os itens acima e as mensagens de erro no terminal.
