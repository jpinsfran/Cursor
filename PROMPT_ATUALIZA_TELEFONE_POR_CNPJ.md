# Prompt otimizado: Atualizar telefone por CNPJ e sincronizar Supabase

## 1. Avaliação do prompt (skill evaluate-prompt-optimize)

### Intenção
- Consultar APIs (OpenCNPJ primeiro, depois Brasil API) para obter os números de telefone vinculados a cada CNPJ.
- Coletar **todos** os números retornados, analisar cada um (celular vs fixo) com a regra já existente no projeto.
- Aplicar as 4 regras de decisão para atualizar ou manter o telefone da planilha.
- Ao final, sincronizar as alterações com o Supabase.

### Entidades
| Entidade | Especificação |
|----------|----------------|
| **Fontes de dados** | OpenCNPJ (`https://api.opencnpj.org/{cnpj}`), Brasil API (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`) |
| **Entrada** | CSV de leads (ex.: `ifoodLeads.csv`) com colunas `cnpj`, `phone` (e demais do pipeline) |
| **Saída** | Mesmo CSV com coluna `phone` atualizada conforme regras; sync em Supabase (tabelas usadas por `lib/supabaseLeads.js`) |
| **Credenciais** | Nenhuma obrigatória para OpenCNPJ/Brasil API; Supabase: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env` |

### Contexto inferido
- **Script existente:** `atualizaTelefonePorCnpj.js` já implementa OpenCNPJ → Brasil API, prioriza celular, mantém fixo sem sobrescrever, sync Supabase.
- **Definição de celular:** 11 dígitos com 3º dígito = 7, 8 ou 9 (DDD + 9 dígitos; bandas móveis). Função `ehCelular()` no próprio script e em `exportaLeadsComContato.js`.
- **Definição de fixo:** 10 dígitos (DDD + 8) ou 11 dígitos com 3º dígito = 2, 3, 4, 5 ou 6.
- **Formato dos números nas APIs:** assumir que vêm no padrão em que os dois primeiros dígitos são o DDD (ou já normalizados para só dígitos); normalizar com `phoneFromApi()` (só dígitos, ≥10).
- **Plano e documentos:** `PLANO_ALTERNATIVO_TELEFONE.md`, `AVALIACAO_QUALIDADE_ESTRUTURA.md` descrevem a ordem e as regras.

### Lacunas preenchidas
- **Qual planilha:** CSV de leads (ex.: `ifoodLeads.csv`); arquivo passado como argumento ou padrão no script.
- **Onde configurar Supabase:** variáveis no `.env`; não pedir token no chat.
- **“0 ou mais números”:** ambas as APIs podem retornar 0, 1 ou vários (OpenCNPJ em um campo com “/” ou em vários campos; Brasil API em `ddd_telefone_1` e `ddd_telefone_2`). Coletar todos, normalizar, depois aplicar regras.

---

## 2. Prompt otimizado (versão final)

**Objetivo:** Atualizar a coluna de telefone do CSV de leads usando os números vinculados ao CNPJ nas APIs, aplicando regras claras celular/fixo e, ao final, sincronizar com o Supabase.

**Passos:**

1. **Consultar as APIs (ordem)**  
   - Para cada CNPJ da planilha: consultar **primeiro** a OpenCNPJ; **depois** a Brasil API (usar como complemento ou fallback).
   - Em ambas as APIs podem ser retornados **0 ou mais** números no(s) campo(s) de telefone.

2. **Coletar e normalizar**  
   - Extrair **todos** os números dos campos de telefone das duas respostas (OpenCNPJ: ex.: `data.telefone`, `data.telefone_2`, etc., incluindo split por “/”, “,” quando vier mais de um no mesmo campo; Brasil API: `ddd_telefone_1`, `ddd_telefone_2`).
   - Normalizar cada valor para só dígitos (mín. 10); considerar que, por padrão, os **dois primeiros dígitos são o DDD**.

3. **Classificar cada número**  
   - Usar a mesma regra já existente no projeto (ex.: função `ehCelular` do script):  
     - **Celular:** 11 dígitos com 3º dígito = 7, 8 ou 9.  
     - **Fixo:** 10 dígitos ou 11 dígitos com 3º dígito diferente de 7, 8, 9.

4. **Regras de decisão (o que gravar na planilha)**  
   - Se **não houver nenhum número** das APIs → **manter** o telefone que já está no CSV.  
   - Se houver **apenas um número** e for **fixo** → **manter** o da planilha (não alterar).  
   - Se houver **um número** e for **celular** → **substituir** o da planilha por esse número.  
   - Se houver **mais de um número** → avaliar **todos** individualmente; se existir **ao menos um celular**, usar um deles (ex.: o primeiro celular encontrado); se **nenhum for celular**, **manter** o da planilha.

5. **Persistência e sync**  
   - Atualizar o CSV com os valores definidos acima.  
   - **Sincronizar** o resultado com o Supabase (mesma lógica já usada no script: estabelecimentos, qualificados, perfil), a menos que seja desativado (ex.: flag `--no-sync`).

**Premissas:**  
- Não inventar dados; só usar números retornados pelas APIs ou já presentes no CSV.  
- Timeout e delays entre requisições conforme já definido no script (evitar rate limit).  
- Credenciais Supabase apenas em `.env`; não expor no código.

---

## 3. Resumo para execução

- **O que será feito:** script (ou ajuste do `atualizaTelefonePorCnpj.js`) que, para cada linha com CNPJ, consulta OpenCNPJ e Brasil API, junta todos os números, classifica com `ehCelular`, aplica as 4 regras e atualiza o CSV; em seguida roda o sync Supabase.
- **Assumido:** entrada = CSV de leads com `cnpj` e `phone`; saída = mesmo arquivo atualizado + Supabase; definições de celular/fixo e DDD já existem no projeto.
- **Chance de sucesso:** alta (~85–90%), desde que as APIs estejam disponíveis e o Supabase configurado no `.env`.
