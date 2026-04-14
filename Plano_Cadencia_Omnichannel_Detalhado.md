# Plano de Cadência Omnichannel — Fluxo Detalhado por Canal

> **Premissa**: 100% autônomo, zero intervenção humana. Cada decisão, mensagem e transição é executada pelo agente.

---

## 1. Análise Crítica de Limites e Riscos por Canal

### 🟡 WhatsApp (API Não Oficial — UAZAPI)

> [!CAUTION]
> **Risco #1 do projeto.** A UAZAPI usa conexão via WhatsApp Web, que NÃO é oficial. O WhatsApp monitora padrões de comportamento e pode banir a qualquer momento. Toda a estratégia abaixo minimiza esse risco, mas NÃO o elimina.

**Por que UAZAPI**: Já utilizada pela operação atual. Suporta texto, áudio PTT (simulando gravação), imagem, vídeo, documentos, listas, botões interativos e webhooks. Campos nativos de `delay` e `readchat` facilitam a simulação de comportamento humano. Integração com N8N via HTTP Request. Documentação em português.

#### Limites Seguros (pesquisa aprofundada)

| Parâmetro | Limite Seguro | Limite Agressivo (não recomendado) |
|-----------|--------------|-----------------------------------|
| **Novas conversas/dia** (número maduro 40+ dias) | **50** | 80 |
| **Novas conversas/dia** (número em warm-up, semana 1-2) | **10-15** | 20 |
| **Novas conversas/dia** (número em warm-up, semana 3-4) | **25-35** | 50 |
| **Mensagens/dia** (incluindo follow-ups a conversas existentes) | **150** | 250 |
| **Intervalo entre envios** | **15-45s** (randomizado) | 8-10s |
| **Máximo de touchpoints ao MESMO lead** (sem resposta) | **5** em 21 dias | 7 |
| **Tempo mínimo entre msgs ao mesmo lead** (sem resposta) | **72h** | 48h |

#### Protocolo Anti-Ban WhatsApp (12 regras obrigatórias)

1. **Warm-up de número novo** (10 dias antes de operar):
   - D1-3: Adicionar 20-50 contatos reais, trocar msgs com 5-10 deles
   - D4-7: 5-10 novas conversas/dia, conteúdo natural, fotos, stickers
   - D8-10: 15-25 novas conversas/dia, buscar respostas ativamente
   - D11+: Aumentar 20%/dia até atingir 50/dia

2. **NUNCA enviar mensagem idêntica** a 2 leads. Cada msg é unique (o LLM já garante isso)

3. **Randomizar intervalos**: delay de 15-45 segundos entre envios (nunca fixo)

4. **Variar formatos**: alternar texto → áudio → imagem → texto. Nunca 5 textos seguidos

5. **Simular uso humano**: usar campos `readchat` e `readmessages` da UAZAPI para marcar como lido antes de responder

6. **Máximo 1 msg/dia para o mesmo lead** que não respondeu (exceto respostas diretas)

7. **Se taxa de "não entregue" > 10%**: pausar por 4h antes de continuar

8. **Se receber warning do WhatsApp**: parar imediatamente por 48h, depois reiniciar com 30% do volume

9. **Múltiplos números**: operar com 2-3 números em paralelo (ex: 50 leads/dia × 3 números = 150 leads/dia)

10. **Proxy dedicado**: usar proxy do mesmo país/cidade do número

11. **Não enviar links na primeira mensagem** (exceto quando o lead pedir)

12. **Ter "conversas reais" paralelas**: manter 10-20 conversas pessoais ativas para parecer conta real

#### Capacidade por Número WhatsApp

| Período | Capacidade | Leads na cadência simultânea |
|---------|-----------|---------------------------|
| **Semana 1-2** (warm-up) | 10-15 novos/dia | 40-60 |
| **Semana 3-4** (ramp-up) | 25-35 novos/dia | 100-150 |
| **Semana 5+** (operação) | 50 novos/dia | 150-250 |
| **Com 3 números** | 150 novos/dia | 450-750 |

---

### 🔵 LinkedIn (Perfil Pessoal — Sócio & Head de Vendas NOLA)

> **Persona**: O LinkedIn usado é o perfil PESSOAL do sócio do NOLA e Head de Vendas. Isso muda TUDO — não é "alguém da NOLA", é O DONO chegando no lead com credibilidade máxima.

| Parâmetro | Limite Seguro (Premium) |
|-----------|------------------------|
| **Convites de conexão/semana** | 150-200 |
| **Convites/dia** | 25-30 |
| **Mensagens a conexões/semana** | 150 |
| **InMails/mês** | 15 (Premium Business) |
| **Taxa de aceitação mínima** | > 30% (abaixo disso, reduzir volume) |

**Vantagens do LinkedIn Premium já ativo**:
- Badge "Premium" no perfil → credibilidade imediata
- Mais convites/semana (150-200 vs 80-100 free)
- InMails para leads que não são conexão (15/mês)
- Quem visitou o perfil → visibilidade completa → identificar leads que pesquisaram você
- Destaque nos resultados de busca

**Papel do LinkedIn neste fluxo**: Canal de **autoridade e credibilidade pessoal**. Quando o lead recebe uma mensagem do *Sócio e Head de Vendas* de uma empresa que atende 210+ restaurantes, o peso é completamente diferente. LinkedIn converte INDIRETAMENTE — o lead recebe convite → vê o perfil (sócio, conteúdo relevante, badge Premium) → ganha confiança → responde no WhatsApp.

**Automação**: Usar ferramenta cloud-based (Phantombuster, La Growth Machine ou similar) para convites + mensagens automatizadas. O agente N8N orquestra o timing; a ferramenta executa.

---

### 🔵 LinkedIn — Plano de Conteúdo (Community Building)

Além da cadência de outbound, o LinkedIn pessoal deve ter uma **estratégia de conteúdo ativa** que constrói audiência no ICP e esquenta leads ANTES da abordagem direta.

#### Frequência: 3-4 posts/semana

| Dia | Tipo de Post | Tom |
|-----|-------------|-----|
| **Segunda** | 📊 Dado/Insight de mercado | Educativo — "Sabia que..." |
| **Quarta** | 💡 Dica prática para donos de restaurante | Consultor — "3 coisas que..." |
| **Sexta** | 🏆 Case/resultado de cliente (sem citar nome) | Prova social — "Um restaurante que..." |
| **Sábado** (opcional) | 🎯 Reflexão pessoal sobre empreendedorismo/food | Humano — bastidores, aprendizados |

#### Os 4 Pilares de Conteúdo

**Pilar 1 — Inteligência de Mercado (30%)**
- Dados sobre food service no Brasil (crescimento, tendências, desafios)
- Rankings, benchmarks, estudos (pode usar dados do Radar de forma anônima)
- Comparações regionais, insights por cuisine
- *Exemplo*: "67% dos restaurantes não sabem o CMV real. E a diferença média é de 8-15% do faturamento. Fiz um estudo em [cidade] e os números me surpreenderam..."

**Pilar 2 — Dicas Práticas de Gestão (30%)**
- Como calcular CMV, como precificar cardápio, como controlar estoque
- Erros comuns que donos de restaurante cometem
- Frameworks simples que qualquer operação pode aplicar
- *Exemplo*: "3 perguntas que todo dono de restaurante deveria se fazer toda segunda-feira: 1. Qual foi meu CMV real semana passada? 2. Quais pratos mais venderam vs quais mais lucraram? 3. Quanto desperdicei?"

**Pilar 3 — Cases e Resultados (20%)**
- Histórias de restaurantes que resolveram problemas (anonimizadas)
- Antes/depois de implementar controles
- Resultados de clientes NOLA (sem pitch — só resultado)
- *Exemplo*: "Uma hamburgueria em BH controlava tudo em planilha. Em 30 dias com gestão digital, descobriu que perdia R$ 4.800/mês em desperdício que nem sabia. Hoje esse dinheiro vira lucro."

**Pilar 4 — Bastidores e Visão Pessoal (20%)**
- Dia a dia como Head de Vendas no food service
- Reflexões sobre empreendedorismo, vendas, liderança
- Eventos do setor, visitas a restaurantes, aprendizados
- *Exemplo*: "Ontem visitei um restaurante que fatura R$ 200k/mês e não sabe quanto lucra. O dono trabalha 14h/dia. Isso precisa mudar. É por isso que a gente faz o que faz."

#### Formato dos Posts

- **Texto nativo** (sem links no corpo — LinkedIn penaliza posts com link)
- **Máximo 1.300 caracteres** (ideal para mobile)
- **Gancho forte na primeira linha** (aparece antes do "ver mais")
- **Se tiver link**: colocar no primeiro comentário, não no post
- **Engajar nos comentários** dentro de 1h após postar (boost de algoritmo)
- **Usar 3-5 hashtags** relevantes: #FoodService #Restaurantes #GestãoDeRestaurantes #CMV #Gastronomia

#### Sinergia com Cadência Outbound

```
Lead recebe convite LinkedIn (D8 da cadência)
     │
     └─ Lead visita perfil → Vê:
           ├─ Badge Premium ✓
           ├─ "Sócio & Head de Vendas @ NOLA" ✓
           ├─ Posts com dados de mercado interessantes ✓
           ├─ Cases de restaurantes ✓
           └─ 210+ restaurantes atendidos ✓
                │
                └─ RESULTADO: Credibilidade construída ANTES
                   da conversa começar → Taxa de resposta
                   no WhatsApp AUMENTA
```

**Meta**: Alcançar 5.000+ seguidores no LinkedIn em 6 meses com conteúdo focado em food service. Cada novo seguidor é um potencial lead aquecido.

---

### 🟣 Instagram

| Parâmetro | Limite Seguro |
|-----------|--------------|
| **Interações (likes + comments)/dia** | 50-80 |
| **DMs para novos usuários/dia** (conta madura) | 20-30 (manual) |
| **DMs via API (Graph API)** | Só para quem interagiu com você (janela 24h) |
| **Cold DM puro** | ⚠️ ALTO risco de ban — não recomendado em massa |

**Estratégia Instagram (trigger-based, não cold)**:

O Instagram NÃO permite cold DM em escala. A estratégia é **criar o trigger antes**:

1. **Seguir + curtir + comentar** no perfil do lead (D1 da cadência)
2. **Se o lead interagir de volta** (seguir, curtir, responder) → janela 24h ativada → DM automatizada
3. **Se NÃO interagir** → Instagram serve apenas como "presença" (o lead viu que a NOLA acompanha)
4. Alternativa: **story engagement** — postar stories com enquetes/perguntas e automatizar DM para quem responde

**Automação**: ManyChat ou Inro.social para DMs trigger-based. Interações manuais (likes/comments) via Phantombuster ou similar.

---

### 📧 Email

| Parâmetro | Limite Seguro |
|-----------|--------------|
| **Emails/dia por inbox** | 20-30 (pós warm-up) |
| **Inboxes por domínio** | Máximo 3 |
| **Domínios separados** | Usar 2-3 variações do domínio principal |
| **Warm-up** | 30 dias (começar com 2-5/dia, aumentar 3-5/semana) |
| **Taxa de bounce máxima** | < 2% |
| **Taxa de spam report máxima** | < 0.1% |
| **Follow-ups na cadência** | Máximo 2 (total 3 emails por lead) |

**Papel do Email**: Canal de **valor formal e documentação**. Onde o Radar é enviado como PDF profissional, dados são apresentados de forma estruturada, e o tom é mais consultivo. Email converte menos que WhatsApp, mas REFORÇA credibilidade.

**Setup obrigatório**:
- Domínio secundário (ex: `estudos.usenola.com.br` ou `pesquisa.nola.com.br`)
- SPF, DKIM e DMARC configurados
- Warm-up de 30 dias antes de operar
- Ferramenta: Resend, Instantly ou Smartlead

---

### 📞 Ligação (ElevenLabs + VOIP)

| Parâmetro | Valor |
|-----------|-------|
| **Custo/minuto (ElevenLabs)** | $0.09-0.10/min (~R$ 0.55/min) |
| **Duração média estimada** | 1.5-2 min (se atender) |
| **Custo por tentativa** | ~R$ 1.00-1.20 |
| **Custo se não atender** | ~R$ 0.10-0.20 (tempo de espera + caixa postal) |
| **Taxa de atendimento estimada** | 15-25% |
| **Ligações/dia (agressivo)** | 50-100 |

> [!WARNING]
> **Ligação é o touchpoint mais caro.** Uma ligação de 2 min custa ~R$1.10. Em 100 leads, se 20% atendem = 20 ligações de 2 min + 80 tentativas curtas = ~R$ 38/dia. Em um mês (~22 dias úteis): ~R$ 836/mês só em ligações.

**Estratégia de custo-eficiência para ligação**:

1. **Usar APENAS para leads Tier A** que não responderam em outros canais
2. **Máximo 1 tentativa por lead** na cadência base (segunda tentativa só se for lead muito quente)
3. **Duração máxima**: 2 minutos na cold call. Se engajar → pode ir até 5 min
4. **Se não atender**: NÃO deixar voicemail (custa tempo). Seguir com WhatsApp texto
5. **Priorizar no timing certo**: 9h-10h30 ou 14h-16h (entre rushes do restaurante)
6. **Voz clonada do SDR**: Tom confiante, natural, como se fosse humano

---

## 2. A Cadência Ótima — 21 Dias, 5 Canais, Fluxo Condicional

### Por que 21 dias (não 14)

A pesquisa mostra que SDRs que estendem para 21 dias capturam 15-20% mais reuniões que cadências de 14 dias, porque:
- Donos de restaurante são **extremamente ocupados** — operação consome 12-14h/dia
- A maioria não rejeita, simplesmente **esquece** ou **não vê** a primeira msg
- O Radar cria curiosidade que pode levar **dias** para ser processada
- Os touchpoints mais tardios (D15-21) capturam leads que "viram" mas ainda não tinham tempo

### Mapa Geral da Cadência (21 dias, 12 touchpoints)

| Dia | Canal | Formato | Intensidade | Objetivo |
|-----|-------|---------|-------------|----------|
| **D1** | WhatsApp | Texto | 🟢 Leve | Gerar curiosidade — "Posso te mandar um estudo?" |
| **D1** | Instagram | Interação | 🟢 Leve | Aquecer — curtir 2-3 posts + 1 comentário |
| **D3** | WhatsApp | Texto curto | 🟡 Média | Follow-up com dado — ranking ou score |
| **D5** | Email | Texto + PDF | 🟡 Média | Radar formal + valor documental |
| **D7** | WhatsApp | Áudio (30-40s) | 🔴 Alta | Humanizar — voz real, tom amigável |
| **D8** | LinkedIn | Convite + nota | 🟢 Leve | Presença profissional / credibilidade |
| **D10** | WhatsApp | Imagem | 🟡 Média | Teaser visual do Radar (Score + R$) |
| **D13** | Ligação | Voz (ElevenLabs) | 🔴 Alta | Contato direto — APENAS Tier A |
| **D14** | WhatsApp | Texto (provocação) | 🟡 Média | Challenger — dado financeiro provocativo |
| **D17** | Email | Texto curto | 🟢 Leve | Follow-up value — novo dado ou case |
| **D19** | WhatsApp | Vídeo curto ou lista | 🟡 Média | Último esforço criativo — formato diferente |
| **D21** | WhatsApp | Texto | 🟢 Leve | **Break-up** — porta aberta, despedida respeitosa |

**Total**: 12 touchpoints em 21 dias, 5 canais, 6 formatos diferentes

---

## 3. Fluxo Condicional Detalhado — Dia a Dia

### Legenda de Status

```
🟩 CONECTOU = Lead respondeu (qualquer canal)
🟨 SILÊNCIO = Lead não respondeu
🟥 OBJEÇÃO = Lead respondeu negativamente
⛔ OPT-OUT = Lead pediu para parar
📅 AGENDOU = Reunião marcada
❌ PERDIDO = Esgotou cadência sem sucesso
```

---

### D1 — ABERTURA (Objetivo: Gerar Curiosidade)

```
09:00-11:00 │ WhatsApp Texto
             │ Ângulo: escolhido da biblioteca (1 dos 8)
             │ Tom: pesquisador curioso
             │ Regra: NUNCA mencionar NOLA/sistema/produto
             │ CTA: "Posso te mandar?"
             │
             ├─ 🟩 Respondeu "sim/manda/quero ver"
             │    └─ ENVIAR RADAR IMEDIATAMENTE
             │       └─ Ir para MODO CONVERSA (seção 4)
             │
             ├─ 🟩 Respondeu com pergunta ("o que é isso?")
             │    └─ Responder com contexto do estudo (Conversation Engine)
             │       └─ Ir para MODO CONVERSA
             │
             ├─ 🟥 Respondeu "não preciso" / "não tenho interesse"
             │    └─ Tratamento de objeção leve (1 tentativa)
             │       ├─ Se engajou → MODO CONVERSA
             │       └─ Se ignorou → Continuar cadência
             │
             ├─ ⛔ "Para de mandar" / denunciou
             │    └─ PARAR IMEDIATAMENTE. Marcar opt-out. FIM.
             │
             └─ 🟨 Silêncio → Continuar cadência

14:00-16:00 │ Instagram Interação (paralelo)
             │ Curtir 2-3 posts recentes do lead
             │ Comentar genuinamente em 1 post
             │ NÃO enviar DM ainda
             │ Objetivo: lead vê notificação → percebe "NOLA" → predisposição
```

---

### D3 — FOLLOW-UP COM DADO (Objetivo: Criar Urgência)

```
CONDIÇÃO: Só execute se NÃO respondeu no D1

09:00-11:00 │ WhatsApp Texto curto (2-3 linhas)
             │ Template: "[nome], o estudo do [restaurante] ficou pronto.
             │            Vocês ficaram em [ranking] no ranking de [cuisine]
             │            em [bairro]. Só preciso de um ok que te mando 👍"
             │
             ├─ 🟩 Respondeu → Enviar Radar → MODO CONVERSA
             ├─ 🟥 Objeção → Tratar → se falhar, continuar
             ├─ ⛔ Opt-out → FIM
             └─ 🟨 Silêncio → Continuar cadência
```

---

### D5 — EMAIL FORMAL (Objetivo: Valor Documental + Canal Diferente)

```
CONDIÇÃO: Só execute se NÃO respondeu em D1 e D3

07:00-09:00 │ Email (canal novo — mudar a perspectiva)
             │ Assunto: "Estudo [restaurante] — Score [XX]/100" (máx 6 palavras)
             │ Corpo: 5 linhas + Radar em PDF anexo
             │ Formato: texto puro (sem HTML pesado)
             │ CTA: "Se algum número chamar atenção, me conta"
             │ Incluir link para WhatsApp no footer
             │
             ├─ 🟩 Respondeu por email → Responder + redirecionar pra WhatsApp
             ├─ 🟩 Respondeu por WhatsApp (viu o email e mandou msg) → MODO CONVERSA
             └─ 🟨 Silêncio → Continuar cadência
```

---

### D7 — ÁUDIO HUMANIZADO (Objetivo: Quebrar a Barreira de "Bot")

```
CONDIÇÃO: Só execute se NÃO respondeu em nenhum canal até agora

09:00-11:00 │ WhatsApp Áudio (30-40s)
             │ Gerado por ElevenLabs com voz clonada do SDR
             │ Roteiro: "Fala [nome], tudo bem? Aqui é o [SDR] do time
             │           de pesquisa da NOLA. Te mandei um estudo do
             │           [restaurante] que a gente mapeou e queria insistir
             │           porque o ranking de vocês em [bairro] realmente
             │           chamou atenção. Se tiver 2 min pra olhar, acho
             │           que vale. Me dá um toque!"
             │ Tom: natural, pode ter pausas, como se tivesse gravando
             │
             ├─ 🟩 Respondeu (texto ou áudio) → MODO CONVERSA
             └─ 🟨 Silêncio → Continuar cadência

NOTA: Áudio é o formato com MAIOR taxa de resposta em WhatsApp
outbound (2-3x mais que texto puro). Vale o investimento em
ElevenLabs para gerar os áudios (~R$ 0.10-0.20 por áudio de 40s).
```

---

### D8 — LINKEDIN (Objetivo: Autoridade Pessoal do Sócio)

```
CONDIÇÃO: Só execute se o lead tem perfil LinkedIn identificado

08:00-10:00 │ LinkedIn Convite de Conexão (do perfil pessoal — Sócio NOLA)
             │ Nota (máx 300 chars): "[nome], sou sócio do NOLA e Head
             │   de Vendas. A gente atende 210+ restaurantes e o
             │   [restaurante] chamou atenção no nosso mapeamento de
             │   [bairro]. Preparei uma análise que acho relevante."
             │
             ├─ 🟩 Aceitou conexão → Enviar mensagem de follow-up em D10
             ├─ 🟩 Aceitou + respondeu → Redirecionar pra WhatsApp
             └─ 🟨 Não aceitou → Sem ação adicional no LinkedIn

NOTA: O peso do convite vindo de um SÓCIO com perfil Premium e
conteúdo ativo sobre food service é muito maior do que vindo de um
SDR anônimo. O lead pesquisa "quem é essa pessoa?" → vê sócio do
NOLA, posts com dados do setor, badge Premium → credibilidade máxima.
```

---

### D10 — IMAGEM PROVOCATIVA (Objetivo: Estímulo Visual)

```
CONDIÇÃO: Só execute se NÃO respondeu até D7

14:00-15:30 │ WhatsApp Imagem
             │ Card visual com: Score [XX]/100 + Ranking [Xº de Y]
             │                  + "Oportunidade estimada: R$ X-Y/mês"
             │ Texto de acompanhamento (2 linhas):
             │   "[nome], fiz esse resumo do estudo de vocês.
             │    O material completo tem muito mais detalhe. Quer ver? 👇"
             │
             ├─ 🟩 Respondeu → Enviar Radar → MODO CONVERSA
             └─ 🟨 Silêncio → Continuar cadência

SE aceitou conexão LinkedIn em D8:
  │ Enviar mensagem LinkedIn (paralelamente):
  │ "Obrigado por conectar, [nome]! Minha equipe mapeou [cuisine] em
  │  [bairro] e o [restaurante] ficou em [ranking]. Preparei um material
  │  completo. Posso enviar pelo WhatsApp pra ficar mais prático?"
```

---

### D13 — LIGAÇÃO (Objetivo: Breakthrough — Contato Direto)

```
CONDIÇÃO: APENAS para leads TIER A que NÃO responderam em nenhum canal
          Para Tier B: PULAR este touchpoint (economia de custo)

09:00-10:30 │ Ligação via VOIP + ElevenLabs
ou          │ Abrir com: "Te peguei numa hora ruim?" (Ross)
14:00-16:00 │ Se SIM → "Sem problema! Quando seria bom?"
             │ Se NÃO → Pitch de 30s do estudo + oferecer Radar
             │ Se NÃO ATENDEU → NÃO deixar voicemail
             │
             ├─ 🟩 Atendeu + engajou → SPIN Discovery → MODO CONVERSA
             │    └─ Se sinal de compra forte → AGENDAR na ligação
             │
             ├─ 🟩 Atendeu + "me manda por WhatsApp" → Enviar Radar
             │    └─ MODO CONVERSA no WhatsApp
             │
             ├─ 🟥 Atendeu + objeção → Tratar na ligação (máx 1 tentativa)
             │
             ├─ ⛔ "Não me ligue mais" → Opt-out. FIM.
             │
             └─ 🟨 Não atendeu → WhatsApp texto:
                  "Tentei te ligar pra falar sobre o estudo do
                   [restaurante]. Posso mandar por aqui mesmo?"

CUSTO ESTIMADO: ~R$ 1.10 se atendeu (2 min) / ~R$ 0.15 se não atendeu
```

---

### D14 — PROVOCAÇÃO CHALLENGER (Objetivo: Desconforto Produtivo)

```
CONDIÇÃO: Só execute se NÃO respondeu até D13 (ou D10 se Tier B)

09:00-11:00 │ WhatsApp Texto (provocação)
             │ Template: "[nome], te faço uma pergunta...
             │            se eu pedisse agora o CMV exato do mês passado,
             │            quanto tempo levaria pra me responder?
             │            O estudo estimou que restaurantes do perfil
             │            de vocês podem ter um gap de R$ [min] a R$ [max]
             │            por mês. Se quiser investigar junto, me fala"
             │
             ├─ 🟩 Respondeu → MODO CONVERSA
             ├─ 🟥 "Já controlo meu CMV" → Tratar objeção:
             │    "Que bom! Mas o estudo vai além do CMV... tem ranking
             │     no bairro, comparação digital e 3 ações que restaurantes
             │     com perfil parecido fizeram. Dou uma olhada contigo?"
             └─ 🟨 Silêncio → Continuar cadência
```

---

### D17 — EMAIL FOLLOW-UP (Objetivo: Segundo Valor por Email)

```
CONDIÇÃO: Só execute se NÃO respondeu ao email D5 e continua na cadência

08:00-10:00 │ Email (follow-up ao primeiro)
             │ Assunto: "Dado sobre [cuisine] em [bairro]"
             │ Corpo: 3-4 linhas, novo dado ou mini case
             │ "Oi [nome]! Saiu um dado que me fez pensar no [restaurante]:
             │  restaurantes de [cuisine] que controlam CMV digitalmente
             │  têm margem 12% maior que os que não controlam. Na região
             │  de [bairro], estimamos que isso pode significar R$ [X]-[Y]/mês.
             │  Se quiser trocar uma ideia (20 min, sem compromisso), me avisa."
             │ Link WhatsApp no footer
             │
             └─ 🟨/🟩 mesma lógica anterior
```

---

### D19 — ÚLTIMO ESFORÇO CRIATIVO (Objetivo: Formato Diferente)

```
CONDIÇÃO: Só execute se NÃO respondeu em nenhum canal

14:00-15:30 │ WhatsApp — ESCOLHER o formato mais eficaz do momento
             │
             │ OPÇÃO A (lista): "3 coisas que descobri sobre [restaurante]:"
             │   1. Vocês ficaram em [ranking] no bairro de [bairro]
             │   2. O gap estimado de CMV no segmento é de [X] pontos
             │   3. A oportunidade pode ser de R$ [min]-[max]/mês
             │   "Se quiser ver o estudo completo, me fala"
             │
             │ OPÇÃO B (vídeo curto 30-45s):
             │   SDR falando direto na câmera (pré-gravado genérico
             │   OU gerado por IA com HeyGen/Synthesia):
             │   "Mandei uma análise do [restaurante] e queria compartilhar
             │    o que encontrei. Em 20 min te mostro os números reais..."
             │
             │ OPÇÃO C (nota de voz 15s):
             │   Mais casual, como se lembrasse na hora:
             │   "Ei [nome], lembrei de vocês porque vi o Radar de novo
             │    e tem um dado que vale 2 min do seu tempo..."
             │
             │ DECISÃO: usar o formato que está performando MELHOR
             │          no copy testing engine neste momento
```

---

### D21 — BREAK-UP (Objetivo: Criar Urgência por Escassez + Porta Aberta)

```
CONDIÇÃO: Lead NÃO respondeu em NENHUM canal nos 21 dias

09:00-11:00 │ WhatsApp Texto (despedida respeitosa)
             │ "[nome], como não consegui retorno, vou encerrar o contato
             │  por aqui. O estudo do [restaurante] fica disponível por
             │  mais alguns dias. De qualquer forma, sucesso com a operação!
             │  Se precisar no futuro, me chama 🤝"
             │
             ├─ 🟩 Respondeu (efeito break-up — acontece em 5-15% dos casos)
             │    └─ MODO CONVERSA (com energia renovada)
             │
             ├─ 🟨 Silêncio definitivo
             │    └─ ❌ MARCAR COMO PERDIDO
             │       Status HubSpot: "Sem Resposta — Cadência Esgotada"
             │       Reativar em 90 dias com novo ângulo/Radar atualizado
             │
             └─ ⛔ "Obrigado, não preciso"
                  └─ Aceitar com elegância. FIM.
```

---

## 4. Modo Conversa — Quando o Lead Responde

Quando o lead responde em **qualquer canal**, a cadência automática **PAUSA** e o Conversation Engine assume:

```
LEAD RESPONDEU
     │
     ├─ "Sim, manda" / "Quero ver"
     │    └─ Enviar Radar IMEDIATAMENTE (link WhatsApp + email se tiver)
     │       └─ Esperar 24-48h
     │          └─ Follow-up: "E aí, viu? Algum número chamou atenção?"
     │
     ├─ Respondeu com interesse ("legal", "achei interessante", "de onde vem?")
     │    └─ Pergunta SPIN baseada no score mais BAIXO do Radar
     │       └─ BANT implícito → quando 3/4 → AGENDAR
     │
     ├─ Respondeu morno ("beleza", "ok", "pode ser")
     │    └─ Provocação Challenger (dado financeiro do Radar)
     │       └─ Se engajou → SPIN → BANT → AGENDAR
     │       └─ Se silenciou → RETOMAR cadência do próximo touchpoint
     │
     ├─ Respondeu com objeção
     │    └─ Identificar qual dos Três Dez está baixo
     │       └─ Tratar com técnica adequada (ver árvore conversacional)
     │       └─ Se 2 tentativas falharam → oferecer FAKE DOOR
     │
     ├─ Perguntou "o que é a NOLA?"
     │    └─ Posicionar como ecossistema food service (NUNCA como "sistema")
     │       └─ Transição natural pro agendamento
     │
     ├─ Perguntou preço
     │    └─ Contextualizar com valor: "Depende do que faz sentido, mas
     │       o mais importante é o diagnóstico. R$ 550 é a base, mas a
     │       maioria recupera isso em semanas no CMV"
     │       └─ Redirecionar pra reunião
     │
     └─ "Me liga" / "Prefiro por telefone"
          └─ "Posso ligar [dia] de manhã ou [dia] à tarde?"
             └─ Agendar ligação específica

REGRA DE REATIVAÇÃO DA CADÊNCIA:
Se lead parar de responder por 48h+ após iniciar conversa:
  → Retomar cadência do PRÓXIMO touchpoint não executado
```

---

## 5. Fluxo Anti-No-Show (Pós-Agendamento)

```
📅 REUNIÃO AGENDADA
     │
     ├─ IMEDIATAMENTE: WhatsApp confirmação
     │   "Fechado! [Dia] às [Hora] 🤝 Link: [Google Meet]
     │    Na reunião a gente cruza o Radar com dados reais e
     │    te mostra como restaurantes parecidos resolveram.
     │    Se precisar remarcar, me avisa!"
     │
     ├─ D-2 (2 dias antes): Email confirmação formal
     │   "Oi [nome]! Confirmo nosso diagnóstico do [restaurante]
     │    [dia] às [hora]. Link: [meet]. Qualquer mudança, é só avisar."
     │
     ├─ D-1 (manhã do dia anterior): WhatsApp lembrete
     │   "Oi [nome]! Amanhã às [hora] tem nosso diagnóstico do
     │    [restaurante]. Tô preparando a análise — vai ser completo! 🤝"
     │
     │   ├─ 🟩 Respondeu confirmando → "Perfeito, até amanhã!"
     │   ├─ 🟩 Pediu pra remarcar → Oferecer novos horários
     │   └─ 🟨 Silêncio → Seguir em frente (enviar lembrete D0)
     │
     ├─ D0 -30min (dia da reunião): WhatsApp
     │   "Te espero em 30 min! Segue o link: [meet]
     │    Tenho uns dados novos sobre [cuisine] em [bairro]
     │    que acho que vão te surpreender"
     │
     └─ D0 +10min (se NÃO apareceu): WhatsApp
         "Oi [nome]! Tô te esperando no link. Tá conseguindo entrar?"
         │
         ├─ 🟩 "Tô chegando" → Esperar mais 5 min
         ├─ 🟩 "Esqueci / não consigo" → Reagendar na hora
         └─ 🟨 Silêncio (no-show confirmado):
              └─ Esperar 2h → WhatsApp:
                  "Oi [nome]! Imagino que o restaurante te consumiu hoje.
                   Sem problema! Quer remarcar pra outro dia? Tenho
                   [dia] ou [dia] disponível"
                  │
                  ├─ 🟩 Reagendou → Voltar ao fluxo de confirmação
                  └─ 🟨 Silêncio → Mais 1 tentativa em 48h
                       └─ Se silêncio novamente → LEAD PERDIDO
                            "Sem compromisso — não funcionou"
```

---

## 6. Critérios de Lead Perdido

| Situação | Ação | Status HubSpot | Reativação? |
|----------|------|---------------|-------------|
| Esgotou cadência 21 dias sem resposta | Break-up D21 | Sem Resposta — Cadência | Sim, em 90 dias |
| Opt-out em qualquer canal | Parar imediatamente | Opt-Out | Nunca |
| Denunciou/bloqueou WhatsApp | Parar imediatamente | Bloqueado | Nunca |
| No-show 2x (agendou e faltou) | Follow-up 1x depois | No-Show Duplo | Sim, em 60 dias |
| "Não tenho interesse" + objeção tratada sem sucesso | Aceitar com elegância | Sem Interesse | Sim, em 120 dias |
| Lead não é decisor + recusou incluir decisor | Marcar no CRM | Sem Acesso Decisor | Sim, em 60 dias |
| Budget incompatível (microoperação < R$15k) | Não insistir | Fora do ICP | Não |

---

## 7. Capacidade Operacional e Escalonamento

### Por Número WhatsApp (maduro, 40+ dias)

| Leads NOVOS entrando/dia | Leads em cadência simultânea | Mensagens totais/dia |
|--------------------------|-------|----------|
| 50 | ~250 (50 × 5 dias ativos em média) | ~100-150 |

### Com 3 Números

| Leads NOVOS/dia | Leads simultâneos | Custo mensal estimado |
|----------------|-------------------|----------------------|
| 150 | ~750 | Agente IA: ~R$ 800/mês total |

### Projeção de Resultados (150 leads novos/dia, 3 números)

| Métrica | Conservador | Otimista |
|---------|------------|---------|
| Leads abordados/mês | 3.300 | 3.300 |
| Taxa de resposta | 25% (825) | 40% (1.320) |
| Taxa de agendamento | 10% (330) | 18% (594) |
| **Reuniões/mês** | **330** | **594** |
| Custo/reunião | ~R$ 2.40 | ~R$ 1.35 |
| No-show estimado (20%) | 264 realizadas | 475 realizadas |

> [!IMPORTANT]
> Esses números assumem operação madura (mês 3+). No mês 1, espere 30-50% desses volumes enquanto calibra e aquece os canais.

---

## 8. Calendário Semanal Operacional (por lead)

```
         SEG        TER        QUA        QUI        SEX
         ───        ───        ───        ───        ───
Sem 1    D1 📱+📸   •          D3 📱      •          D5 📧
Sem 2    •          D7 🎙️      D8 🔗     •          D10 🖼️
Sem 3    •          •          D13 📞    D14 📱      •
Sem 4    D17 📧     •          D19 🎬    •           D21 👋

📱 WhatsApp texto    🎙️ WhatsApp áudio    🖼️ WhatsApp imagem
📸 Instagram         🔗 LinkedIn          📧 Email
📞 Ligação           🎬 Vídeo/Lista       👋 Break-up
```

### Temperatura de Esforço por Dia

| Dia | Temperatura | Canais | Custo relativo |
|-----|------------|--------|---------------|
| D1 | 🟢 Leve | WhatsApp + Instagram | Baixo (~R$ 0.03) |
| D3 | 🟢 Leve | WhatsApp | Baixo (~R$ 0.02) |
| D5 | 🟡 Média | Email | Baixo (~R$ 0.01) |
| D7 | 🔴 Alta | WhatsApp Áudio | Médio (~R$ 0.15) |
| D8 | 🟢 Leve | LinkedIn | Baixo (~R$ 0.01) |
| D10 | 🟡 Média | WhatsApp Imagem (+ LinkedIn msg) | Baixo (~R$ 0.03) |
| D13 | 🔴🔴 Muito Alta | **Ligação** (só Tier A) | **ALTO (~R$ 1.10)** |
| D14 | 🟡 Média | WhatsApp Texto | Baixo (~R$ 0.02) |
| D17 | 🟢 Leve | Email | Baixo (~R$ 0.01) |
| D19 | 🟡 Média | WhatsApp Vídeo/Lista | Médio (~R$ 0.10) |
| D21 | 🟢 Leve | WhatsApp Break-up | Baixo (~R$ 0.02) |

**Custo total por lead na cadência completa**: ~R$ 1.50-1.70 (sem ligação) ou ~R$ 2.60-2.80 (com ligação Tier A)

---

## 9. Plano Específico por Canal — O Que Cada Canal FAZ

### WhatsApp — Canal de CONVERSÃO

- **Papel**: Onde a conversa acontece, onde o agendamento fecha
- **Touchpoints**: 7 de 12 (D1, D3, D7, D10, D14, D19, D21)
- **Formatos**: Texto, Áudio, Imagem, Vídeo, Lista
- **Meta**: Taxa resposta > 30%, taxa agendamento > 12%
- **Regra**: Nunca 2 textos seguidos. Cada touchpoint = formato diferente

### Email — Canal de CREDIBILIDADE

- **Papel**: Valor formal, envio do Radar como PDF profissional, documentação
- **Touchpoints**: 2 de 12 (D5, D17)
- **Formato**: Texto puro, curto, profissional. Radar em PDF
- **Meta**: Taxa abertura > 40%, taxa resposta > 5%
- **Regra**: Assunto máx 6 palavras. Corpo máx 5 linhas. Sem HTML pesado na primeira

### Instagram — Canal de AQUECIMENTO

- **Papel**: Criar familiaridade ANTES da abordagem
- **Touchpoints**: 1 de 12 (D1 — interação, não DM)
- **Formato**: Curtidas, comentários, engajamento orgânico
- **Meta**: Lead nota a NOLA → ganha familiaridade → responde WhatsApp
- **Regra**: NUNCA fazer cold DM em massa. Só interação orgânica. DM só se o lead responder

### LinkedIn — Canal de AUTORIDADE (Perfil Pessoal — Sócio NOLA)

- **Papel**: Credibilidade pessoal do sócio + community building com ICP
- **Touchpoints cadência**: 1-2 de 12 (D8 convite, D10 msg se aceitou)
- **Conteúdo**: 3-4 posts/semana (dados, dicas, cases, bastidores)
- **Formato**: Convite com nota personalizada como Sócio + conteúdo orgânico
- **Meta**: Taxa de aceitação > 40% (Premium + perfil de sócio > SDR anônimo), 5.000 seguidores em 6 meses
- **Regra**: Convite sempre como "sócio que faz mapeamento", nunca como vendedor. Posts sem links no corpo

### Ligação — Canal de BREAKTHROUGH

- **Papel**: Contato direto quando todos os outros falharam. Gera 3x mais conversão que texto
- **Touchpoints**: 1 de 12 (D13 — APENAS Tier A)
- **Formato**: Voz sintética (ElevenLabs) ou alerta para SDR humano
- **Meta**: Taxa atendimento > 20%, conversão para conversa > 50% dos atendidos
- **Regra**: Máx 2 min cold call. Se não atender, follow-up WhatsApp. NUNCA voicemail
