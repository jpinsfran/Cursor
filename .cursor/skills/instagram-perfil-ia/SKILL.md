# Instagram: scrape + IA (perfil_do_lead, punch_line)

## Fluxo

1. **scrapeInstagram.js** – Etapa 1: extrai bio, seguidores, highlights (títulos + conteúdo visível), 5 posts recentes (legendas + URLs de imagem). Saída: JSON (`--out extracao.json`).
2. **instagram_profile_ai.py** – Etapa 2: lê o JSON, chama OpenAI e gera **perfil_do_lead** (resumo único, tom humano, sem copiar) e **punch_line** (dica de abordagem ligada ao último post).

## Colunas

- **perfil_do_lead** – Resumo processado pela IA (operação, produtos, eventos, comportamento).
- **punch_line** – Conexão direta com o último post; dica de como abordar o lead.

## Regras

- Nunca inventar: só usar o que veio do scrape/legenda/imagem.
- IA: sintetizar como observador humano; não copiar trechos literais.

## Execução

```bash
node scrapeInstagram.js https://www.instagram.com/usuario/ --out extracao.json
python instagram_profile_ai.py extracao.json
```

Requer: `OPENAI_API_KEY`, `pip install openai`, Puppeteer (já usado no projeto). Login uma vez: `node scrapeInstagram.js --login`. O unificador (`unificaIfoodInstagram.js`) preenche as colunas `perfil_do_lead` e `punch_line` no CSV.
