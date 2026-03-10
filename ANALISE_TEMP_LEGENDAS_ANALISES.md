# Vantagem de salvar legendas e análises em arquivo temporário

## Situação atual

- **Temp hoje:** só imagens (screenshots de posts, destaques, stories) em `instagram_temp/unify_<user>_<ts>/`.
- **Em memória:** legendas, descrições das imagens (Vision), dados montados para conclusão/punch line. Tudo é passado ao Python via stdin (JSON) e o resultado é usado direto; nada disso é persistido em arquivo.

## Vantagens de salvar em temp e depois analisar

### 1. **Retomada sem repetir scrape e Vision**
- Se o fluxo quebrar **depois** de ter legendas + análises de fotos (ex.: timeout no `summarize_store_conclusion`, erro de rede na API), hoje você perde tudo e precisa rodar de novo desde o início (scrape + Vision).
- Com um arquivo temp (ex.: `perfil_<username>_dados.json`) contendo legendas + descrições das imagens, dá para ter um modo **“só interpretação”**: ler esse JSON e rodar apenas as chamadas de resumo/conclusão/punch line, sem novo scrape e sem novas chamadas Vision.
- **Economia:** tempo e custo de API (Vision é caro); menos risco de bloqueio por muitas requisições.

### 2. **Debug e auditoria**
- Fica explícito **o que** foi enviado para cada etapa de IA (conclusão, último post, punch line).
- Para um lead que “não analisou nada” ou “veio errado”, você abre o JSON do perfil e vê exatamente: legendas, descrições das imagens, contexto iFood. Facilita ajustar prompts, regras de validação e reprocessar só a interpretação.

### 3. **Separação de fases (coleta vs interpretação)**
- **Fase 1 – Coleta:** scrape + Vision → gravar em temp (legendas + análises das fotos).
- **Fase 2 – Interpretação:** ler temp → chamar só GPT (conclusão, último post, punch line, destaques, stories).
- Permite:
  - Trocar modelo/prompt da Fase 2 sem refazer Fase 1.
  - Testar A/B de prompts usando o mesmo arquivo temp.
  - Rodar Fase 2 em outro ambiente (ex.: máquina com mais recurso ou outra conta de API).

### 4. **Controle de custo e reprocessamento**
- Uma vez gerado o temp para um perfil, você pode:
  - Re-rodar apenas a interpretação (ex.: após mudar `looksLikeRealAnalysis` ou prompts no Python).
  - Reprocessar em lote só a Fase 2 para N perfis cujo temp já existe, sem consumir Vision de novo.

### 5. **Batch e paralelização**
- Coleta pode rodar em um processo (ou em fila) e gerar N arquivos temp (um por perfil).
- Outro script ou workers podem só ler esses arquivos e rodar a interpretação (até em paralelo), sem depender de browser/Puppeteer na hora da análise.

### 6. **Alinhamento com a regra “não inventar”**
- O temp vira a **fonte segura** do que foi efetivamente coletado. Qualquer conclusão pode ser rastreada até “legendas + análises das fotos” desse arquivo, sem inferir dados que não existam no temp.

---

## Desvantagens / cuidados

| Ponto | Mitigação |
|-------|-----------|
| Uso de disco | Temp por execução, em `instagram_temp/`; apagar após uso ou após X dias. |
| Dados sensíveis | Evitar commitar temp; manter em pasta já ignorada (ex.: `instagram_temp/` no `.gitignore`). |
| Dado desatualizado | Temp deve ser “por run” (ex.: `unify_<user>_<timestamp>`) ou ter TTL; não reutilizar como cache longo sem critério. |
| Um passo a mais no fluxo | Escrever JSON após Vision e, na mesma execução, ler desse JSON para as etapas de resumo mantém o fluxo linear e ainda habilita o modo “só interpretação” para retries. |

---

## Formato sugerido do temp (exemplo)

Salvar em `instagram_temp/unify_<username>_<timestamp>/dados_perfil.json` (ou equivalente):

```json
{
  "username": "temperaochoppbar",
  "profileUrl": "https://www.instagram.com/temperaochoppbar/",
  "userId": "1967039468",
  "followers": "...",
  "collectedAt": "2025-03-04T...",
  "ifoodContext": { "name": "...", "cuisine": "...", "regiao": "..." },
  "posts": [
    {
      "shortcode": "...",
      "caption": "...",
      "captionSanitized": "...",
      "imageDescription": "...",
      "imagePath": "post_1_xxx.png"
    }
  ],
  "highlights": [
    { "title": "...", "slideDescriptions": ["..."] }
  ],
  "lastPost": { "caption": "...", "imageDescriptions": ["..."] }
}
```

- **Legendas e análises das fotos** ficam em `posts[].caption`, `captionSanitized`, `imageDescription` e em `lastPost`. Destaques em `highlights`.
- A **interpretação** (conclusão, punch line, etc.) pode ser feita lendo só esse JSON e chamando o Python com esses campos, sem precisar de screenshots ou Vision de novo.

---

## Conclusão

**Vantagem principal:** poder **reanalisar** (e debugar) sem repetir scrape e Vision, além de separar **coleta** de **interpretação** e reduzir custo e tempo em retentativas e testes de prompt. Salvar todas as legendas e análises das fotos em um temp e depois analisar/trabalhar em cima desse temp é uma melhoria clara de robustez e controle do pipeline.

Implementar seria: após obter `postsData` + `descriptions` (e opcionalmente dados de destaques/stories já processados), escrever `dados_perfil.json` no `tempDir` e, em seguida, tanto o fluxo normal quanto um modo “só interpretação” passariam a ler desse arquivo para as chamadas de resumo/conclusão/punch line.
