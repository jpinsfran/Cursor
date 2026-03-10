# Revisão de código (nível sênior)

Avaliação dos módulos principais do projeto Nola (leads iFood + Instagram + pipeline), com foco em manutenibilidade, robustez e alinhamento à visão do produto.

---

## 1. scrapeIfoodLeads.js

### Pontos positivos

- Clareza do objetivo: extrair leads por endereço e persistir em CSV.
- Múltiplos seletores para o modal de endereço (mitiga mudanças de layout do iFood).
- Fallback para extrair URLs do estado Next.js quando os links do DOM não bastam.
- Paginação (“Ver mais”) até um limite razoável.
- Deduplicação em relação a um CSV existente (incremental).
- Export do módulo e execução condicional; **BOM no CSV** (`\uFEFF`) para Excel.
- **Browser fechado no `finally`** (evita processos órfãos).

### Pontos a melhorar

1. **Extração de dados (robustez)** — Uso de `.split("telephone")[1].split(...)` é frágil: qualquer mudança no HTML/JSON do iFood quebra. **Sugestão (longo prazo):** regex ou parser do `__NEXT_DATA__`; falha por campo retorna `""`.
2. **Requisições** — `fetch(url)` sem timeout pode travar; sem retry/backoff. **Sugestão:** `AbortController` + timeout (ex.: 15s); retry com backoff opcional.
3. **Coluna regiao** — O CSV não inclui `regiao`; o pipeline usa o sufixo (SP, RJ) indiretamente. **Sugestão:** preencher `regiao` em cada linha a partir do `suffix` para consistência com planilhas unificadas.
4. **Controle de fluxo** — Flags `--headless` e `--slow` para produção vs. desenvolvimento.

---

## 2. scrapeInstagram.js

### Pontos positivos

- Separação clara: parsing, perfil, posts, destaques, stories, IA.
- `runFullInstagramAnalysis` reutilizável; assinatura estável.
- Regra explícita de não inventar dados; validação `looksLikeRealAnalysis`.
- Perfil Chrome persistente; liberação de lock no `--login`.
- Temp dir removido em `finally`; sanitização de legendas para a IA.
- Portabilidade de `CHROME_PATH` e paths com `process.cwd()`.

### Pontos a melhorar

1. **runPython sem timeout** — Se o Python travar, o Node fica bloqueado. **Sugestão:** timeout (ex.: 90s) com `AbortController` ou `Promise.race` + kill do processo.
2. **Constantes de tempo** — Vários `setTimeout` fixos; **sugestão:** constantes no topo (ex.: `NAVIGATION_TIMEOUT`, `POST_DELAY_MS`).
3. **JSDoc** — Atualizar shape completo do retorno de `runFullInstagramAnalysis`.

---

## 3. unificaIfoodInstagram.js

### Pontos positivos

- Escrita em tempo real (checkpoint a cada lead); retry de rename (WRITE_RETRIES).
- BOM e UTF-8; colunas de texto sanitizadas.
- Uso de `runFullInstagramAnalysis`; contexto iFood passado para a IA.
- Browser fechado no `finally`.

### Pontos a melhorar

1. **Identificação de linha** — `findIndex` por `url`+`name` (ou `domain`) pode colidir em duplicatas. **Sugestão:** usar índice direto quando `toRun` for slice de `rows` (evitar ambiguidade).
2. **Delay entre leads** — Fixo 2s; pode ser constante configurável para ajuste fino.

---

## 4. pipelineLeadsDefinitivo.js

### Pontos positivos

- Um comando para o fluxo completo; etapas bem nomeadas.
- Validação de arquivo existente em `--skip-ifood` / `--from-todos`.
- Uso de `path.join(__dirname, script)` para portabilidade.

### Pontos a melhorar

1. **Unificação com --resume** — Para CSVs grandes, não passa `--resume` ao unifica; toda execução reprocessa. **Sugestão:** opção `--resume` no pipeline que repassa ao unifica.
2. **Tratamento de falha** — Exit 1 em qualquer etapa; poderia permitir continuar em modo “best effort” com flag (baixa prioridade).

---

## 5. atualizaTelefonePorCnpj.js

### Pontos positivos

- Brasil API + fallback OpenCNPJ; apenas dados da fonte (não inventa).
- Normalização de CNPJ e telefone; filtro celular; checkpoint a cada 50.
- BOM no CSV; delay entre requisições.

### Pontos a melhorar

1. **Timeout em fetch** — Requisições à Brasil API e OpenCNPJ sem timeout. **Sugestão:** `AbortController` + 10–15s.
2. **Retry em falha de rede** — Uma tentativa; **sugestão:** retry 1x com backoff em erro de rede/timeout.

---

## 6. exportaLeadsComContato.js

### Pontos positivos

- Filtro celular/fixo claro; inferência de DDD por região (`ddd-brasil.js`).
- BOM no CSV; uso de `json2csv`.

### Pontos a melhorar

1. **Tratamento de arquivo inexistente** — Ler input com `fs.readFile` e tratar ENOENT com mensagem clara (já usa try/catch em torno de fromString).

---

## 7. concatenaComContato.js

### Pontos positivos

- Lista explícita de arquivos; normalização de colunas (`regiao`, `instagramUrl`).
- Arquivo inexistente = aviso e pula; BOM no CSV.

### Pontos a melhorar

1. **Lista de arquivos fixa** — Novas regiões exigem edição. **Sugestão (baixa):** opção de glob ou lista via argumento.

---

## 8. instagram_ai.py

### Pontos positivos

- Um ponto de entrada JSON (stdin/stdout); ações por `action`.
- Modelo configurável por env (`OPENAI_MODEL`); prompts interpretativos.
- Tratamento de exceção por função; fallbacks sem inventar.
- Uso de `path` e leitura de imagens em base64 para Vision.

### Pontos a melhorar

1. **Timeout em chamadas OpenAI** — Sem timeout explícito; **sugestão:** `timeout=60` (ou configurável) nas chamadas à API.
2. **Log de erros** — Exceções silenciosas (`except Exception`); **sugestão:** log opcional (stderr ou env `DEBUG=1`) para diagnóstico.
3. **Validação de payload** — `paths` e outros podem ser inválidos; validar tipos/tamanho antes de usar.

---

## Alinhamento com a visão

| Módulo | Visão | Alinhamento |
|--------|--------|-------------|
| scrapeIfoodLeads | Oportunidades de leads por região | ✅ Entrega nome, url, contato, endereço; falta regiao explícita. |
| scrapeInstagram | Entender perfil do cliente para prospecção | ✅ Perfil, posts, destaques, stories, conclusão, punch-line. |
| unificaIfoodInstagram | Unir iFood + Instagram em uma planilha | ✅ Busca perfil por nome/bairro e preenche colunas de análise. |
| pipelineLeadsDefinitivo | Um comando para fluxo completo | ✅ iFood → CNPJ → filtro contato → unificação Instagram. |
| atualizaTelefonePorCnpj | Enriquecer com telefone/email da Receita | ✅ Só celular (ou fixo com flag); não inventa. |
| exportaLeadsComContato | Base “com contato” para outbound | ✅ Filtra por celular e DDD. |
| concatenaComContato | Uma planilha unificada de várias regiões | ✅ Concatena e normaliza colunas. |
| instagram_ai | Resumos interpretativos (não cópia) | ✅ Prompts orientados a conclusão; sem username/legenda literal. |

---

## Prioridade de melhorias

| Prioridade | Onde | O quê | Status |
|------------|------|--------|--------|
| Alta | scrapeIfoodLeads | Timeout no fetch; coluna regiao | ✅ Feito |
| Alta | scrapeInstagram | Timeout em runPython | ✅ Feito |
| Média | atualizaTelefonePorCnpj | Timeout em fetch | ✅ Feito |
| Média | instagram_ai.py | Timeout nas chamadas OpenAI | ✅ Feito |
| **Alta** | scrapeIfoodLeads | Extração com regex/parser em vez de só `.split()`. | Pendente |
| **Média** | instagram_ai.py | Log de erros opcional (DEBUG). | Pendente |
| **Média** | Projeto | Testes unitários (normalização, validação). | Pendente |
| **Baixa** | pipelineLeadsDefinitivo | Opção `--resume` repassada ao unifica. | Pendente |
| **Baixa** | scrapeInstagram | Constantes de timeout/delay no topo. | Pendente |
| **Baixa** | concatenaComContato | Lista de arquivos configurável. | Pendente |

---

Para **nota de qualidade (0–100)**, **pontos fracos** e **sugestões detalhadas**, ver **AVALIACAO_QUALIDADE_ESTRUTURA.md**.
