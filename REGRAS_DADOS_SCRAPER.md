# Regras de dados – Scraper iFood + Instagram

Estas regras valem para todo o fluxo de scraping, análise e planilha unificada. Devem ser seguidas em código e em qualquer alteração futura.

---

## 1. Nunca inventar informação

- **Sob nenhuma hipótese** preencher campos com dados que não tenham vindo de uma **fonte segura**.
- Se não houver certeza ou dado disponível, **deixar o campo vazio** (string vazia).
- Não usar texto genérico inventado (ex.: "Perfil Instagram", "N/A", "Sem descrição") para preencher colunas da planilha quando na verdade não há dado.

---

## 2. O que é fonte segura

| Fonte | Uso |
|-------|-----|
| Página acessada (HTML, texto, atributos) | Extrair só o que está na página. |
| Resposta de API (ex.: OpenAI) | Só quando o input foi **apenas** o que foi extraído (legenda, imagem, texto). A IA não pode inventar além do que recebeu. |
| CSV de entrada (iFood, etc.) | Repassar ou derivar apenas desses campos. |
| Arquivo lido (imagem, config) | Usar apenas o conteúdo do arquivo. |

**Não é fonte segura:** inferência sem base explícita, suposição, valor padrão inventado para “ficar bonito” na planilha.

---

## 3. Comportamento em código

- **Fallbacks:** usar somente dados já extraídos (ex.: legenda + alt da imagem). Não acrescentar frases genéricas inventadas.
- **IA (Python):** os prompts devem dizer para usar **apenas** o conteúdo fornecido e retornar string vazia se não houver informação suficiente. Em erro ou resposta vazia da IA, retornar `""`.
- **Campos vazios:** preferir `""` em vez de placeholders como "[Não disponível]" ou "[Configure API]" nas colunas da planilha. Mensagens de erro técnicas podem ficar em logs, não na exportação final.

---

## 4. Planilha unificada

- Cada coluna deve refletir **somente** o que foi obtido da fonte correspondente.
- Colunas como `perfil`, `tema_da_loja`, `ultimo_post`, `destaques`, `posts`, `link_externo_resumo`: preencher só com conteúdo extraído ou com resumo fiel desse conteúdo; caso contrário, deixar vazio.

---

## 5. Resumo em uma frase

**Só preencher com dados de fonte segura; na dúvida, deixar vazio.**
