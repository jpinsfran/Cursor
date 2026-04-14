# Monitor de execuções n8n → Slack

Fluxo no n8n que monitora as execuções de **todos os outros fluxos** e envia aviso no Slack quando:

1. **Múltiplas execuções em um intervalo curto:** mais de 10 execuções que **iniciaram** nos últimos **3 minutos** (janela de tempo; aviso lista quais são e o tempo total de cada uma).
2. **Execução com tempo total > 3 min:** qualquer execução cuja **duração** (diferença entre data de início e data de fim) for maior que 3 minutos — aviso indica qual e o tempo total. O campo *finished* não define isso; só importa início e fim.

## Workflow criado

- **Nome:** Monitor Execuções n8n → Slack  
- **ID:** `fdS4tsplf9S5od9r`

## Instância n8n

A URL da instância está fixada em **https://n8n.nola.com.br/**. Os links no Slack usam o formato: `https://n8n.nola.com.br/workflow/{id_workflow}/executions/{id_execution}`.

## O que você precisa configurar

### 1. HTTP Request – Listar execuções n8n

O nó chama a API do próprio n8n para listar as execuções. A **URL** já está configurada para:

- `https://n8n.nola.com.br/api/v1/executions?limit=100`

- **Autenticação:**  
  No nó **“Listar execuções n8n”**:
  1. Em **Authentication** escolha **Header Auth** (ou credencial que envia header).
  2. Crie/use uma credencial que envie o header:
     - **Name:** `X-N8N-API-KEY`
     - **Value:** sua [API Key do n8n](https://docs.n8n.io/hosting/configuration/environment-variables/#n8n_api_key) (gerada nas configurações da instância ou variável de ambiente).

Sem essa URL e API key corretas, o nó não conseguirá listar as execuções.

### 2. Slack – Aviso no Slack

No nó **“Aviso no Slack”**:

- **Credential:** use uma credencial do Slack (OAuth2 ou outro método que você já use no n8n).
- **Send Message To:** escolha **Channel** e selecione o **canal** onde devem cair os avisos (ex.: `#alertas-n8n` ou o ID do canal).

O placeholder `C01234567` é só exemplo; troque pelo canal real no nó.

### 3. Ativar o fluxo

- Salve o workflow.
- Ative-o (toggle **Active**).
- O trigger **“A cada 1 min”** roda a cada 1 minuto, então em até 1 minuto a primeira checagem já ocorre.

## Comportamento

- **Tempo de execução:** sempre **diferença entre data de início (start) e data de fim (stop)**. Se a execução ainda não terminou, usa o momento atual como fim.
- **Schedule:** a cada **1 minuto** o fluxo dispara.
- **Regras:**
  - **Pico (intervalo curto):** monta o conjunto de execuções que **iniciaram** nos **últimos 3 minutos**. Se esse conjunto tiver **mais de 10** itens, envia aviso “Múltiplas execuções em um intervalo curto de tempo” e **lista** cada execução com link e **tempo total** (fim − início).
  - **Longa duração:** qualquer execução cuja **duração** (fim − início) for **≥ 3 minutos** entra na lista. O aviso diz quais são e o **tempo total** de cada uma. Não usa o campo *finished*; só início e fim.

As mensagens no Slack trazem **links** no formato `https://n8n.nola.com.br/workflow/{id_workflow}/executions/{id_execution}` e o **tempo total** (ex.: “Execução 123 – tempo total: 5 min 30 s”). Os dois tipos de aviso podem aparecer na mesma mensagem.

## Ajustes opcionais

- **Canal do Slack:** altere no nó “Aviso no Slack” (campo do canal).
- **Janela do pico:** no nó **“Analisar execuções”** (Code), altere `WINDOW_MS` (padrão 3 min) e `MAX_IN_WINDOW` (padrão 10).
- **Limiar de duração longa:** no mesmo nó, altere `LONG_RUNNING_MS` (padrão 3 min = 180000 ms). Qualquer execução com duração (fim − início) ≥ esse valor é listada.
- **Frequência da checagem:** no trigger **“A cada 1 min”**, mude o intervalo (ex.: a cada 2 ou 5 minutos).

## Observação sobre validação

O validador do n8n pode apontar aviso no nó de Code (“Cannot return primitive values directly”). O retorno do nó está no formato esperado (`[{ json: {...}, binary: {} }]`); o fluxo deve rodar normalmente. Se notar algum problema em execução, vale revisar esse nó.
