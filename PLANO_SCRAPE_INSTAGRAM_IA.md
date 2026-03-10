# Plano: Scrape Instagram + IA (perfil_do_lead, punch_line)

**Implementado:** scrapeInstagram.js (Puppeteer) → extracao.json → instagram_profile_ai.py (Vision + chat) → perfil_do_lead + punch_line. Unificador preenche coluna `perfil_do_lead` e `punch_line`. Login: `node scrapeInstagram.js --login`.

## Objetivo

- **Etapa 1 – Scrape:** Extrair apenas o que for possível do perfil (texto visível, legendas, capturas/descrição de imagens), sem inventar.
- **Etapa 2 – IA:** Processar tudo com OpenAI para gerar:
  - **perfil_do_lead:** resumo único, como um humano que passou pelos posts e formou uma opinião (operação, produtos, eventos, comportamento). Não copiar trechos; sintetizar.
  - **punch_line:** gancho de abordagem ligado ao **último post** (mais recente).

## Prioridades no scrape

1. Abrir e analisar cada **destaque** (highlight) e o conteúdo visível nele.
2. **Stories** (quando acessível na sessão).
3. **Bio** e **número de seguidores**.
4. **5 posts mais recentes:** legendas + conteúdo dos prints (ou descrição via Vision na etapa de IA).

## Saída do scrape (JSON)

- `bio`, `seguidores` (texto/numero se disponível)
- `highlights[]`: { titulo, itens[] (texto visível ou descrição) }
- `posts_recentes[]` (máx 5): { legenda, url_imagem ou base64 para Vision }
- `stories[]` (se houver): texto/descrição
- `extraido_em`, `perfil_url`

## Saída da IA

- `perfil_do_lead`: parágrafo(s) em português, tom de observador humano.
- `punch_line`: 1–2 frases de dica de abordagem a partir do último post.

## Regras (nunca inventar)

- Campos vazios quando não houver dado na fonte.
- IA: usar apenas o conteúdo fornecido; se insuficiente, retornar string vazia.
