# Análise do workflow Agendamento Closer (n8n)

## Resumo do que será feito

O workflow **Agendamento Closer** recebe de outro workflow (agente de IA) os dados para agendar um horário com o closer. Esta análise identifica problemas atuais e sugere mudanças para garantir um fluxo confiável: entrada padronizada do agente, verificação correta de disponibilidade no Google Calendar, criação/reagendamento de eventos e resposta clara de volta para o agente.

---

## Fluxo atual (resumido)

1. **Trigger** “When Executed by Another Workflow” → inputs: `nome`, `horario_inicio`, `email`, `horario_fim`
2. **Normalizar** → mapeia para `horario_inicio`, `horario_fim`, `nome`, `email`
3. **Redis** → busca chave `evento_{{ email }}` (reagendamento?)
4. **Reagendar?** (Switch) → se `evento` não vazio → **Update**; se vazio → **Verificar**
5. **Update** → atualiza evento no calendário (Bruna) com `id_event` + horários do Normalizar
6. **Verificar** → lista eventos no calendário Bruna no intervalo
7. **If** → se `available === true` → **Created** (cria na Bruna); senão → **Verificar1** (Pedro)
8. **Verificar1** → lista eventos no calendário Pedro
9. **If1** → se disponível → **Created1** (cria no Pedro); senão → **Não disponível**
10. **Created** / **Created1** → criam evento no Google Calendar com Meet, participantes etc.
11. **Não disponível** → define `response` para o agente tentar outro horário

---

## Problemas identificados

### 1. Campo `available` inexistente na saída do Google Calendar

Os nós **If** e **If1** usam `$json.available`, mas o node **Google Calendar (List/Get Many)** não retorna `available`. Ele retorna uma lista de eventos (cada evento como um item). Ou seja, a condição nunca está baseada em dados reais.

**Correção:** Inserir um nó após **Verificar** e outro após **Verificar1** que derive `available`:

- Se não houver eventos no intervalo → `available: true`
- Se houver pelo menos um evento → `available: false`

Isso pode ser feito com um **Code** node que recebe os itens e devolve um único item com `available: (items.length === 0)`.

---

### 2. Referência ao node inexistente `Data`

Os nós **Created** e **Created1** usam:

- `$('Data').item.json.nome_lead`
- `$('Data').item.json['e-mail']`
- `$('Data').item.json.resumo`

Não existe node **Data** no workflow. Os dados vêm do trigger (via **Normalizar**).

**Correção:** Trocar para **Normalizar** e, se não houver `resumo` na entrada, deixar vazio ou opcional:

- `nome_lead` → `$('Normalizar').item.json.nome`
- `e-mail` → `$('Normalizar').item.json.email`
- `resumo` → `$('Normalizar').item.json.resumo` (e adicionar `resumo` como input opcional do trigger)

---

### 3. Reagendamento depende de `id_event` que não vem do trigger

O **Update** usa `$json.id_event`, mas o trigger só declara: `nome`, `horario_inicio`, `email`, `horario_fim`. Ou seja, em fluxo de reagendamento o workflow não recebe o ID do evento a atualizar.

**Correção:**

- Incluir **`id_event`** nos inputs do trigger (opcional), para quando o agente já souber o ID (ex.: depois de uma criação anterior), **ou**
- Ao **criar** evento (Created/Created1), gravar no Redis o ID do evento criado (ex.: chave `evento_id_{{ email }}`) e, no fluxo de reagendamento, ler desse Redis e passar para o **Update**.

Assim o agente pode chamar o mesmo workflow com `id_event` quando for reagendar.

---

### 4. Formato de data/hora para o agente de IA

O Google Calendar espera datas em formato ISO (ex.: `2025-03-05T14:00:00` ou com timezone). Se o agente enviar em outro formato, a criação/consulta pode falhar ou dar comportamento inesperado.

**Sugestão:**

- Documentar no workflow (e no outro workflow do agente) que `horario_inicio` e `horario_fim` devem ser **ISO 8601** (ex.: `America/Sao_Paulo` ou UTC).
- Opcional: no **Normalizar**, usar um **Code** ou **Date/Time** para normalizar para ISO, se o agente enviar em formato legado (ex.: “05/03/2025 14:00”).

---

### 5. Resposta de sucesso para o agente de IA

Hoje só o ramo **Não disponível** define um `response` claro para o agente. Nos ramos de sucesso (**Created**, **Created1**, **Reagendamento**) não há um payload único e estável que o workflow que chama possa usar (link do Meet, horário confirmado, etc.).

**Sugestão:** Adicionar um **Set** (ou **Code**) em cada ramo de sucesso que defina algo como:

- `agendado: true`
- `horario_inicio` / `horario_fim` (confirmados)
- `link_meet` (do evento criado/atualizado, se disponível na resposta do Google Calendar)
- `calendar_owner` (ex.: Bruna ou Pedro) para o agente informar o lead
- `response`: mensagem curta para o agente usar na resposta ao usuário (ex.: “Reunião agendada para … com link …”).

Assim o workflow que chama (agente de IA) sempre recebe um objeto padronizado em caso de sucesso ou de “não disponível”.

---

### 6. Timezone em Verificar1

O **Verificar** usa `timezone: America/Sao_Paulo`; o **Verificar1** não define timezone. Para consistência e evitar erros de janela de horário, vale configurar o mesmo timezone no **Verificar1**.

---

## Contrato recomendado com o workflow do agente de IA

O outro workflow deve enviar no **Execute Workflow** um JSON no formato:

```json
{
  "nome": "Nome do lead",
  "email": "email@lead.com",
  "horario_inicio": "2025-03-10T14:00:00-03:00",
  "horario_fim": "2025-03-10T14:30:00-03:00",
  "resumo": "Opcional: contexto ou resumo da conversa",
  "id_event": "Opcional: ID do evento no Google (apenas para reagendamento)"
}
```

- **Sempre:** `nome`, `email`, `horario_inicio`, `horario_fim` (ISO).
- **Opcional:** `resumo`, `id_event` (para reagendar).

---

## Checklist de mudanças sugeridas

| # | Ação | Prioridade |
|---|------|------------|
| 1 | Incluir input opcional `resumo` no trigger e usar em Created/Created1 | Alta |
| 2 | Trocar todas as referências `$('Data')` por `$('Normalizar')` e campos corretos (nome, email, resumo) | Alta |
| 3 | Inserir nó “Disponível?” após Verificar: entrada = lista de eventos → saída 1 item com `available: (length === 0)` | Alta |
| 4 | Inserir nó “Disponível? (Pedro)” após Verificar1 com a mesma lógica | Alta |
| 5 | Ajustar If/If1 para usar o output desses nós (ou manter If/If1 mas garantindo que recebam o item que tem `available`) | Alta |
| 6 | Incluir `id_event` (opcional) no trigger; usar no Update quando presente | Média |
| 7 | Ao criar evento (Created/Created1), gravar no Redis `evento_id_{{ email }}` = id do evento; no fluxo de reagendamento, ler desse Redis se `id_event` não vier no trigger | Média |
| 8 | Definir resposta de sucesso padronizada (Set/Code) em Created, Created1 e Reagendamento (agendado, horário, link_meet, response) | Média |
| 9 | Configurar timezone America/Sao_Paulo no Verificar1 | Baixa |
| 10 | Documentar no agente que horários devem ser ISO 8601 | Baixa |

---

## Ordem sugerida de implementação

1. Corrigir referências **Data** → **Normalizar** e adicionar `resumo` no trigger.
2. Implementar nós que calculam `available` após Verificar e Verificar1 e conectar If/If1 a eles.
3. Adicionar `id_event` no trigger e no Update; opcionalmente persistir/recuperar ID no Redis.
4. Padronizar resposta de sucesso (e manter “Não disponível” como já está).
5. Ajustar timezone e documentar contrato para o agente.

Com isso, o fluxo fica alinhado a um “bom fluxo” para agendar com o closer: entrada clara do agente de IA, verificação real de disponibilidade, criação/reagendamento corretos e resposta única para o outro workflow consumir.
