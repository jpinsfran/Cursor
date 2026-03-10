# Avaliação de qualidade e estrutura (nível dev sênior)

Avaliação do projeto Nola (leads iFood + Instagram + pipeline + IA), considerando o estado atual do código após as melhorias implementadas (timeouts, validação de saída, regiao, prompts interpretativos, etc.).

---

## Pontos positivos

- **Visão de produto clara**: pipeline end-to-end (iFood → CNPJ → filtro contato → unificação Instagram) com um comando; saída única para prospecção.
- **Regras do projeto respeitadas**: não inventar dados; usar apenas fontes seguras; campos vazios quando não há certeza (regras scraper-dados e honestidade).
- **Portabilidade**: `CHROME_PATH` por plataforma; `path.join(process.cwd(), ...)` e `__dirname`; scripts Node e Python executáveis em Windows/Linux.
- **Persistência**: BOM (`\uFEFF`) e UTF-8 em todos os CSVs; escrita com retry (unifica); checkpoint a cada 50 (atualizaTelefonePorCnpj).
- **Recursos**: browser fechado em `finally`; temp dir do Instagram removido após uso; sem vazamento evidente de handles.
- **Robustez recente**: timeouts em fetch (iFood 15s, CNPJ 12s), em `runPython` (90s + SIGTERM), em chamadas OpenAI (60s configurável); coluna `regiao` no scrape iFood; validação `looksLikeRealAnalysis` e `filterVisionUINoise` para não gravar ruído (username, "Foto do perfil de", colagem de legendas).
- **Modularidade**: `runFullInstagramAnalysis` reutilizado; Python com um ponto de entrada JSON por ação; separação scrape / unificação / pipeline.
- **Configuração**: modelo e timeout da OpenAI por env; DDD e flags por argumento; sufixo de região no iFood.

---

## Pontos a melhorar

1. **Extração iFood (scrapeIfoodLeads.js)** — Uso de `.split("telephone")[1].split(...)` e equivalentes continua frágil; qualquer mudança no HTML/JSON quebra. Sugestão: extrair do `__NEXT_DATA__` (JSON) ou usar regex por campo; falha por campo retorna `""`.
2. **Testes automatizados** — Inexistentes. Sugestão: pelo menos testes unitários para normalização (CNPJ, telefone, `looksLikeRealAnalysis`), e um teste de integração opcional para um fluxo mínimo (ex.: CSV de 2 linhas).
3. **Constantes de tempo no Instagram** — Vários `setTimeout` e timeouts de navegação ainda literais. Sugestão: constantes no topo (`NAVIGATION_TIMEOUT`, `POST_DELAY_MS`, `HIGHLIGHT_SLIDE_DELAY_MS`).
4. **Identificação de linha no unifica** — `findIndex` por `url`+`name` pode colidir em duplicatas. Sugestão: mapear índice de `toRun` para índice em `rows` de forma explícita (ex.: guardar índice ao filtrar).
5. **Pipeline sem --resume** — Unificação sempre reprocessa tudo. Sugestão: flag `--resume` no pipeline que repassa ao unifica para retomar de onde parou.
6. **Log de erros no Python** — Exceções silenciosas (`except Exception`). Sugestão: `if os.environ.get("DEBUG"): sys.stderr.write(...)` ou logging opcional.
7. **Retry em requisições** — fetch (iFood e CNPJ) e runPython têm uma tentativa só. Sugestão: retry 1x com backoff em timeout/erro de rede.
8. **JSDoc / docstrings** — Shape completo de retorno de `runFullInstagramAnalysis` e de algumas funções não documentado. Sugestão: JSDoc com @returns e tipos dos campos.

---

## Alinhamento com a visão

| Módulo | Visão | Alinhamento |
|--------|--------|--------------|
| scrapeIfoodLeads | Leads por região com contato e endereço | ✅ Nome, url, phone, cnpj, endereço, regiao; extração ainda frágil. |
| scrapeInstagram | Perfil do cliente para prospecção (interpretado) | ✅ Perfil, posts, destaques, stories, conclusão, punch-line; validação evita ruído. |
| unificaIfoodInstagram | Uma planilha iFood + Instagram | ✅ Busca por nome/bairro; preenche colunas de análise em tempo real. |
| pipelineLeadsDefinitivo | Um comando para o fluxo completo | ✅ 4 etapas claras; saída única. |
| atualizaTelefonePorCnpj | Enriquecer com telefone/email da Receita | ✅ Brasil API + OpenCNPJ; só celular (ou fixo com flag); não inventa. |
| exportaLeadsComContato | Base “com contato” para outbound | ✅ Filtro celular; DDD por região. |
| concatenaComContato | Planilha unificada multi-região | ✅ Concatena e normaliza colunas. |
| instagram_ai | Resumos interpretativos (não cópia) | ✅ Prompts orientados a conclusão; modelo/timeout configuráveis. |

---

## Prioridade das melhorias restantes

| Prioridade | Onde | O quê |
|------------|------|--------|
| **Alta** | scrapeIfoodLeads | Extração com JSON/regex em vez de `.split()` (reduz quebra ante mudança do iFood). |
| **Média** | Projeto | Testes unitários para normalização e validação (`looksLikeRealAnalysis`, CNPJ, phone). |
| **Média** | scrapeInstagram | Constantes de timeout/delay no topo. |
| **Média** | instagram_ai.py | Log de erros opcional (DEBUG). |
| **Baixa** | unificaIfoodInstagram | Identificação de linha por índice explícito. |
| **Baixa** | pipelineLeadsDefinitivo | Opção `--resume` repassada ao unifica. |
| **Baixa** | fetch/runPython | Retry 1x com backoff em timeout/rede. |

---

## Pontos fracos

1. **Extração iFood dependente de layout** — Qualquer mudança no HTML/JSON do iFood pode quebrar a coleta; não há parser robusto nem fallback por campo.
2. **Ausência de testes** — Regressões (ex.: validação de saída da IA, normalização de telefone) dependem de execução manual.
3. **Heurísticas de “análise real”** — `looksLikeRealAnalysis` e filtros de UI são baseados em padrões (regex, contagem de segmentos); edge cases podem rejeitar análise válida ou aceitar colagem.
4. **Duplicatas na unificação** — Identificação por `url`+`name` (ou `domain`) pode atualizar a linha errada em CSVs com duplicatas.
5. **Sem observabilidade** — Não há métricas, logs estruturados ou rastreio de quantos leads foram processados com sucesso vs. falha por etapa.
6. **Python sem tipo estático** — `instagram_ai.py` não usa type hints de forma consistente; payload e retornos poderiam ser mais claros para manutenção.

---

## Sugestões de melhoria

- **Curto prazo**: Extrair constantes de tempo no scrapeInstagram; adicionar `DEBUG` no Python para log em stderr; documentar o shape de retorno de `runFullInstagramAnalysis` em JSDoc.
- **Médio prazo**: Testes unitários para `normalizeCnpj`, `ehCelular`, `looksLikeRealAnalysis`, `sanitizeCaptionForAI`; refatorar extração do iFood para usar `__NEXT_DATA__` ou regex por campo.
- **Longo prazo**: Opção `--resume` no pipeline; retry com backoff em fetch e runPython; logging estruturado (ex.: JSON) para análise de falhas; type hints completos no Python.

---

## Nota: qualidade e estrutura

### **72/100**

| Critério | Peso | Nota (0–10) | Comentário |
|----------|------|--------------|-------------|
| **Estrutura e organização** | 20% | 8 | Pipeline claro; módulos com responsabilidade definida; documentação no código e REVISAO/AVALIACAO. |
| **Robustez** | 25% | 6,5 | Timeouts e validação de saída implementados; extração iFood frágil; sem retry. |
| **Portabilidade** | 10% | 8 | Paths e CHROME_PATH por plataforma; uso consistente de path/process.cwd. |
| **Regras e alinhamento ao produto** | 20% | 9 | Não inventar dados; fontes seguras; saída orientada a prospecção. |
| **Manutenibilidade** | 15% | 7 | REVISAO e prioridades documentadas; alguns magic numbers e constantes espalhadas. |
| **Testes e confiabilidade** | 10% | 3 | Sem testes automatizados; confiabilidade baseada em execução manual. |

**Cálculo:** (8×0,20 + 6,5×0,25 + 8×0,10 + 9×0,20 + 7×0,15 + 3×0,10) ≈ **7,28** → **72/100**.

**Justificativa**: O projeto entrega bem a visão (leads + contato + Instagram interpretado), segue as regras de dados e tem estrutura e portabilidade boas. A nota é limitada pela **extração frágil no iFood**, pela **ausência de testes** e por **heurísticas de validação** que podem precisar de ajuste fino. Com extração robusta e testes básicos, a nota tende a subir para a faixa 78–82.

---

*Documento gerado com base na skill code-review-senior e no estado atual do repositório.*
