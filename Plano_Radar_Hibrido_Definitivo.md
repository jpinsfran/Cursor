# PLANO DEFINITIVO: Radar [Restaurante] — Conceito Híbrido A+C

## O QUE É E POR QUE FUNCIONA

O **Radar** é um documento HTML personalizado que o SDR envia na primeira mensagem de prospecção. Não é um PDF genérico. Não é um pitch. É uma **radiografia da operação do restaurante** gerada automaticamente com dados públicos + benchmarks reais de mercado.

O dono de restaurante abre e vê: um score de 0-100 do próprio negócio, quanto provavelmente está perdendo por mês, como se compara ao bairro dele, e 3 ações concretas que poderia tomar amanhã.

**A dor real que isso ataca:** O dono de restaurante vive no escuro. Ele não sabe o CMV real, não sabe a margem, não sabe se paga caro demais pelo insumo, não sabe se o iFood tá rendendo ou sangrando. Ele sente que trabalha muito e lucra pouco — mas não tem números pra provar. O Radar dá os números. E números geram urgência.

**Por que é matador como primeira mensagem:**
- Valor antes de pedir qualquer coisa (reciprocidade — Cialdini)
- Prova de expertise real, não conversa de vendedor (eleva Dez #2 — certeza em você)
- Dados competitivos ativam instinto visceral do dono ("sou o melhor do bairro?")
- O número financeiro cria desconforto produtivo ("posso estar perdendo R$ 8k/mês?!")
- Transição orgânica: Radar mostra estimativas → reunião mostra os números REAIS
- Diferenciação absoluta: NENHUM concorrente faz isso no mercado brasileiro

**Os 7 gatilhos psicológicos embutidos no Radar:**

| # | Gatilho | Como aparece no Radar | Impacto |
|---|---------|----------------------|---------|
| 1 | **Reciprocidade** (Cialdini) | Valor gratuito antes de pedir qualquer coisa | O dono sente que "deve" uma resposta |
| 2 | **Aversão à Perda** | "R$ X escapando da sua operação por mês" | Dói mais perder do que ganhar — urgência |
| 3 | **Competição Social** | "Você é o Xº de Y no seu bairro" | Instinto primitivo: "quero ser o melhor" |
| 4 | **Curiosidade Aberta** | Radar gera MAIS perguntas que respostas | O dono precisa da reunião pra fechar os gaps |
| 5 | **Prova Social** | "210+ restaurantes já usam o ecossistema NOLA" | Não sou o primeiro — outros já confiaram |
| 6 | **Identidade** | Score alto em algum pilar reforça orgulho | "Sou forte em X — agora quero melhorar Y" |
| 7 | **Escassez Implícita** | "Análise preparada especificamente para [restaurante]" | Não é genérico — foi feito PRA MIM |

---

## PRINCÍPIOS DE CALIBRAÇÃO — O QUE TORNA O RADAR CRÍVEL

**Regra de Ouro: O Radar NUNCA deve parecer manipulativo.**

Para isso, a calibração dos scores precisa respeitar estas regras:

1. **Nem todo score é baixo.** Se o restaurante tem rating 4.7 e 8.000 seguidores, o score de Reputação e Digital DEVE ser alto (85+). Um score artificialmente baixo destrói credibilidade. O "punch" financeiro já faz o trabalho de urgência sozinho.

2. **Sempre reconhecer o que é BOM.** Se o lead tem ponto forte (nota alta, presença digital forte, posição dominante no bairro), o Radar DESTACA isso antes de mostrar as oportunidades. Dono de restaurante orgulhoso responde melhor a "você é forte aqui, mas pode estar perdendo ali" do que a "tudo está ruim".

3. **Estimativas são RANGES.** Nunca um número pontual. Sempre "R$ 2.100 — R$ 6.000/mês". Isso é honesto, soa consultivo e protege contra a objeção "esse número é inventado".

4. **Disclaimer explícito e honesto.** "Esses números são estimativas baseadas em benchmarks do setor e dados públicos. Seus números reais podem ser melhores — ou piores. Só um diagnóstico com dados internos revela a verdade." Isso AUMENTA credibilidade, não diminui.

5. **Perguntas > Respostas.** O Radar deve provocar: "Será que meu CMV é isso mesmo?" em vez de afirmar: "Seu CMV é X." O dono que se pergunta isso JÁ ESTÁ pronto pra reunião.

---

## ANATOMIA DO RADAR — SEÇÃO POR SEÇÃO

O design segue o DNA visual do **Nola Score** (HTML de referência): dark mode, cards com bordas suaves, gauge ring pro score, chips coloridos, progress bars, verde NOLA como accent color, responsivo mobile-first.

### CABEÇALHO

```
┌─────────────────────────────────────────────────┐
│ [Logo NOLA]  Radar [Nome do Restaurante]        │
│              Análise Express da Sua Operação     │
│                                                   │
│  📍 [Bairro], [Cidade] · [Cuisine] · [PriceRange]│
│  Gerado em [Data]                                 │
│                                     [Badge: Confidencial] │
└─────────────────────────────────────────────────┘
```

**Dados usados:** `name`, `neighborhood`, `regiao`, `cuisine`, `priceRange`
**Função psicológica:** O dono vê o NOME do restaurante dele em destaque. Isso não é genérico. Isso é sobre ELE. O badge "Confidencial" cria sensação de exclusividade.

---

### BLOCO 1: SCORE GERAL — O GAUGE QUE HIPNOTIZA

```
┌─────────────────────────────────────────────────┐
│                                                   │
│     ┌───────┐                                     │
│     │       │   Nola Score: [XX]/100              │
│     │  XX   │   Nível: [Classificação]            │
│     │       │   "[Frase de impacto contextual]"   │
│     └───────┘                                     │
│     (gauge ring)                                  │
│                                                   │
│  [chip] Reputação: XX  [chip] Digital: XX         │
│  [chip] Competitivo: XX [chip] Financeiro: XX     │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Como calcular o Score Geral:**

```
Score = (Reputação × 0.25) + (Digital × 0.20) + (Competitivo × 0.20) + (Financeiro × 0.35)
```

Peso maior no Financeiro porque é onde a DOR é maior e onde o NOLA mais resolve.

**Classificações:**
| Score | Nível | Cor | Frase de Impacto |
|-------|-------|-----|------------------|
| 0-35 | Zona de Risco | 🔴 Vermelho | "Sua operação tem vazamentos que provavelmente você não está vendo." |
| 36-55 | Em Desenvolvimento | 🟡 Amarelo | "Há potencial real de ganho sendo desperdiçado — os números mostram onde." |
| 56-75 | Boa Base | 🟢 Verde claro | "Você tem uma base sólida, mas ajustes pontuais podem destravar margem." |
| 76-100 | Alta Performance | 💚 Verde | "Operação acima da média — mas até aqui há oportunidades escondidas." |

**Observação crítica:** O algoritmo NUNCA deve dar score acima de 75 para leads sem dados de seguidores Instagram. Isso garante que sempre haja espaço para "oportunidade de melhoria" — se o score fosse 90, não haveria urgência.

**Calibração intencional:** A maioria dos leads vai cair entre 35-60 (zona amarela/vermelha) porque:
- 80% são priceRange "$" (indica operação mais simples)
- A maioria não tem presença digital forte
- Sem dados internos, o pilar Financeiro puxa pra baixo por default
Isso é DESEJÁVEL. Score baixo = urgência = resposta = agendamento.

---

### BLOCO 2: REPUTAÇÃO — O QUE O iFOOD DIZ SOBRE VOCÊ

```
┌─────────────────────────────────────────────────┐
│ ⭐ Reputação Digital                    XX/100   │
├─────────────────────────────────────────────────┤
│                                                   │
│  Sua nota no iFood: [X.X] ⭐                     │
│  Média do seu segmento ([cuisine]): [X.X]        │
│  Média do seu bairro ([bairro]): [X.X]           │
│                                                   │
│  [Barra comparativa visual]                       │
│                                                   │
│  💡 Insight: "[Frase contextual baseada na nota]" │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Algoritmo do Sub-Score Reputação:**

```
SE rating == 5.0: score = 95  # Excepcional — raríssimo mesmo entre os melhores
SE rating >= 4.8: score = 82  # Excelente — top do mercado
SE rating >= 4.6: score = 68  # Bom — padrão de restaurantes 80k+
SE rating >= 4.3: score = 55  # Mediano para o porte — espaço claro para melhorar
SE rating >= 4.0: score = 40  # Abaixo do esperado para quem fatura bem
SE rating >= 3.5: score = 28  # Preocupante — impacto direto em vendas
SE rating < 3.5:  score = 15  # Zona de risco — prioridade máxima
```

**Contexto da calibração:** No universo de restaurantes que faturam acima de R$ 80k/mês, nota 4.6 no iFood é o **padrão** — a maioria dos clientes está acima desse patamar. Por isso, 4.6 gera score 68 (bom, mas com espaço). Apenas nota perfeita (5.0) atinge 95. Isso garante que a maioria dos leads do ICP caia entre 55-68, gerando a percepção correta de "sou bom, mas posso melhorar".

**Insights contextuais (escolher baseado no score):**
- **Score ≥ 80:** "Nota excepcional — você está entre os melhores do iFood na sua região. Restaurantes nesse patamar que controlam CMV têm margem 30% maior que os que não controlam. Sua nota atrai clientes; o controle financeiro mantém o lucro."
- **Score 55-79:** "Nota boa, mas no padrão de restaurantes do seu porte — para se destacar de verdade, cada 0.1 ponto de rating no iFood pode representar até 8% mais pedidos. Restaurantes que profissionalizam operação e respondem avaliações costumam subir 0.3-0.5 pontos em 90 dias."
- **Score 30-54:** "Nota abaixo do esperado para restaurantes do seu faturamento. Seus concorrentes diretos provavelmente têm nota mais alta, o que impacta diretamente seu volume de pedidos. Padronização operacional + controle de qualidade costumam recuperar a nota em 60-90 dias."
- **Score < 30:** "Nota em zona de risco. Isso está custando pedidos todos os dias. Restaurantes que implementam padrão operacional e gestão de avaliações costumam sair dessa zona em 60 dias."

**Médias de referência por cuisine (benchmark — calibrado para ICP 80k+):**
| Cuisine | Média iFood (mercado geral) | Média iFood (restaurantes 80k+) | Referência "destaque" |
|---------|----------------------------|--------------------------------|----------------------|
| Lanches | 4.1 | 4.5 | 4.8+ |
| Marmita | 3.9 | 4.3 | 4.6+ |
| Pizza | 4.2 | 4.6 | 4.8+ |
| Japonês | 4.3 | 4.7 | 4.9+ |
| Açaí | 4.0 | 4.4 | 4.7+ |
| Doces | 4.2 | 4.6 | 4.8+ |
| Frangos | 4.0 | 4.4 | 4.7+ |
| Italiana | 4.3 | 4.7 | 4.9+ |

---

### BLOCO 3: PRESENÇA DIGITAL — SEU INSTAGRAM FALA POR VOCÊ

```
┌─────────────────────────────────────────────────┐
│ 📱 Presença Digital                     XX/100   │
├─────────────────────────────────────────────────┤
│                                                   │
│  Seguidores: [X.XXX]                              │
│  Classificação: [Nível]                           │
│  Benchmark [cuisine] na sua região: [X.XXX]       │
│                                                   │
│  [Barra de progresso visual]                      │
│                                                   │
│  💡 Insight: "[Frase contextual]"                 │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Algoritmo do Sub-Score Digital:**

```
SE seguidores > 200000: score = 95  # Referência do mercado — influencer-level
SE seguidores > 100000: score = 82  # Presença muito forte
SE seguidores > 50000:  score = 68  # Boa presença — acima da média do ICP
SE seguidores > 20000:  score = 55  # Mediano para restaurantes 80k+
SE seguidores > 10000:  score = 42  # Abaixo do esperado para o porte
SE seguidores > 5000:   score = 32  # Presença fraca para quem fatura bem
SE seguidores > 1000:   score = 22  # Incipiente
SE seguidores <= 1000:  score = 12  # Quase ausente
SE sem dados:           score = 8   (penalidade máxima)
```

**Contexto da calibração:** Restaurantes que faturam 80k+/mês frequentemente têm 10k+ seguidores — muitos passam de 50k e 100k. Por isso, 10k seguidores gera score 42 (abaixo do esperado para o porte). Apenas perfis com 200k+ atingem 95. Isso garante que a maioria dos leads do ICP tenha score entre 32-55, gerando a percepção de "posso melhorar muito minha presença digital".

**Insights contextuais:**
- **Score ≥ 70:** "Presença digital forte — você está acima da média de restaurantes do seu porte. O próximo nível é transformar seguidores em clientes recorrentes — restaurantes com CRM ativo convertem 3-5x mais da base de seguidores."
- **Score 40-69:** "Presença digital no padrão do seu mercado, mas distante dos líderes do segmento. Restaurantes de [cuisine] que se destacam no seu porte têm [X]k+ seguidores. A boa notícia: restaurantes que ativam programa de fidelidade no WhatsApp costumam dobrar o engajamento em 60 dias."
- **Score 20-39:** "Presença digital abaixo do esperado para restaurantes do seu faturamento. Seus concorrentes provavelmente estão captando clientes que poderiam ser seus. Diversificar canais de aquisição é a alavanca mais rápida de crescimento."
- **Score < 20:** "Presença digital quase ausente. Para um restaurante do seu porte, isso significa dependência total de localização física e iFood. O gap para seus concorrentes pode estar custando centenas de clientes por mês."

---

### BLOCO 4: POSICIONAMENTO COMPETITIVO — SEU BAIRRO, SEU JOGO

```
┌─────────────────────────────────────────────────┐
│ 🏘️ Posicionamento Competitivo           XX/100   │
├─────────────────────────────────────────────────┤
│                                                   │
│  Restaurantes de [cuisine] no [bairro]: [X]       │
│  Nível de saturação: [Alto/Médio/Baixo]           │
│  Sua posição por rating: [X] de [Y]               │
│                                                   │
│  Faixa de preço predominante: [$]                 │
│  Sua faixa: [$]                                   │
│                                                   │
│  💡 Insight: "[Frase contextual]"                 │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Algoritmo do Sub-Score Competitivo:**

O score competitivo avalia OPORTUNIDADE, não tamanho. Bairros menos saturados com boa nota = mais oportunidade.

```
density = quantidade de restaurantes do mesmo cuisine no bairro
rating_position = posição do lead no ranking do bairro (por rating)

SE density == 1 (único do segmento):
  base_score = 85  # Pouca concorrência = oportunidade
SE density == 2-3:
  base_score = 70
SE density == 4-6:
  base_score = 55
SE density > 6:
  base_score = 40

# Ajuste por posição no ranking
SE rating_position == 1 (melhor nota): bonus = +10
SE rating_position <= 3: bonus = +5
SENÃO: bonus = 0

# Ajuste por diferenciação de preço
SE priceRange diferente da maioria do bairro: bonus += 8 (nicho)
SE priceRange igual à maioria: bonus += 0

score = min(base_score + bonus, 100)
```

**Insights contextuais:**
- **Único do segmento no bairro:** "Você é o único [cuisine] no [bairro] — sem concorrente direto. Isso é uma vantagem rara. Restaurantes nessa posição que investem em fidelização capturam até 70% do mercado local do segmento."
- **Saturação alta, boa posição:** "O [bairro] tem [X] restaurantes de [cuisine]. Sua nota [X.X] te coloca entre os melhores. Para se diferenciar nesse cenário, controle de custos e experiência do cliente são os diferenciais que separam quem lucra de quem só fatura."
- **Saturação alta, posição média/baixa:** "Mercado competitivo no [bairro] com [X] restaurantes de [cuisine]. Restaurantes que profissionalizam a gestão nesse cenário costumam ganhar 2-3 posições no ranking em 6 meses — e cada posição impacta diretamente o volume de pedidos."

---

### BLOCO 5: ESTIMATIVA FINANCEIRA — O NÚMERO QUE FAZ O DONO PARAR

Este é o bloco que VENDE a reunião. É o "aha moment". O dono lê e pensa: "Será que estou realmente perdendo isso?"

```
┌─────────────────────────────────────────────────┐
│ 💰 Estimativa de Oportunidade Financeira         │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  Estimativa de margem que pode estar      │    │
│  │  escapando da sua operação:               │    │
│  │                                            │    │
│  │     R$ [X.XXX] — R$ [Y.YYY] / mês        │    │
│  │                                            │    │
│  │  Isso equivale a R$ [Z]k — R$ [W]k / ano  │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Como chegamos nesse número:                      │
│                                                   │
│  📊 Faturamento estimado do seu perfil:           │
│     R$ [A]k — R$ [B]k/mês                        │
│     (base: [cuisine] / [priceRange] / [região])   │
│                                                   │
│  📊 CMV típico sem controle no seu segmento:      │
│     [X]% (ideal: [Y]%)                            │
│     Gap estimado: [Z] pontos percentuais          │
│                                                   │
│  📊 Vazamentos comuns em operações sem sistema:    │
│     • Desperdício de insumos: 3-5% do faturamento │
│     • Falta de conciliação (cartão/delivery): 1-3%│
│     • Precificação defasada: 2-4% de margem       │
│                                                   │
│  💡 "Restaurantes do seu perfil que implementam   │
│     controle de CMV e gestão financeira integrada  │
│     costumam recuperar entre [X]% e [Y]% do       │
│     faturamento nos primeiros 90 dias."            │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Algoritmo da Estimativa Financeira:**

```python
# Passo 1: Estimar faturamento
faturamento_range = BENCHMARK_TABLE[cuisine][priceRange]
# Ex: Lanches + $ = R$ 25.000 - R$ 50.000

# Passo 2: Calcular gap de CMV
cmv_sem_controle = BENCHMARK_TABLE[cuisine]["cmv_medio_real"]
cmv_ideal = BENCHMARK_TABLE[cuisine]["cmv_ideal"]
gap_cmv = cmv_sem_controle - cmv_ideal
# Ex: Lanches → 38% - 30% = 8 pontos percentuais

# Passo 3: Estimar vazamento total
vazamento_base = gap_cmv / 100  # CMV acima do ideal
vazamento_extra = 0.04  # Desperdício + conciliação + precificação
vazamento_total = vazamento_base + vazamento_extra
# Ex: 0.08 + 0.04 = 0.12 (12% de vazamento)

# Passo 4: Calcular range de oportunidade
oportunidade_min = faturamento_range[0] * vazamento_total * 0.7  # conservador
oportunidade_max = faturamento_range[1] * vazamento_total * 1.0
# Ex: R$ 25.000 * 0.12 * 0.7 = R$ 2.100 (min)
#     R$ 50.000 * 0.12 * 1.0 = R$ 6.000 (max)

# Passo 5: Score Financeiro (inversamente proporcional à oportunidade)
# Quanto MAIOR a oportunidade perdida, MENOR o score
pct_vazamento = vazamento_total * 100
SE pct_vazamento >= 14:  score = 25
SE pct_vazamento >= 10:  score = 40
SE pct_vazamento >= 7:   score = 55
SE pct_vazamento >= 4:   score = 70
SE pct_vazamento < 4:    score = 85
```

**Tabela de Benchmarks Financeiros (fonte: base de conhecimento NOLA):**

| Cuisine | CMV Ideal | CMV Médio (sem controle) | Gap | Margem Op. Ideal |
|---------|-----------|--------------------------|-----|------------------|
| Lanches | 28-32% | 36-42% | ~8-10pp | 12-18% |
| Marmita | 30-35% | 38-45% | ~8-10pp | 10-15% |
| Pizza | 25-30% | 33-40% | ~8-10pp | 15-20% |
| Japonês | 30-35% | 38-48% | ~8-13pp | 12-18% |
| Açaí | 25-30% | 32-40% | ~7-10pp | 15-22% |
| Doces | 20-28% | 28-38% | ~8-10pp | 18-25% |
| Frangos | 28-33% | 35-42% | ~7-9pp | 12-18% |
| Italiana | 28-33% | 35-43% | ~7-10pp | 12-18% |

| Cuisine + PriceRange | Faturamento Estimado (R$/mês) |
|----------------------|-------------------------------|
| Lanches $ | 25.000 — 50.000 |
| Lanches $$ | 50.000 — 100.000 |
| Marmita $ | 20.000 — 40.000 |
| Marmita $$ | 40.000 — 80.000 |
| Pizza $ | 30.000 — 60.000 |
| Pizza $$ | 60.000 — 120.000 |
| Japonês $$ | 60.000 — 120.000 |
| Japonês $$$ | 120.000 — 250.000 |
| Açaí $ | 20.000 — 45.000 |
| Açaí $$ | 45.000 — 90.000 |
| Doces $ | 15.000 — 35.000 |
| Doces $$ | 35.000 — 70.000 |
| Frangos $ | 30.000 — 60.000 |
| Frangos $$ | 60.000 — 100.000 |
| Italiana $$ | 50.000 — 100.000 |
| Italiana $$$ | 100.000 — 200.000 |

---

### BLOCO 6: RECOMENDAÇÕES PRIORIZADAS — O GANCHO PRO AGENDAMENTO

```
┌─────────────────────────────────────────────────┐
│ 🎯 Top 3 Ações Recomendadas                      │
├─────────────────────────────────────────────────┤
│                                                   │
│  1️⃣ [Título da Ação]                              │
│     [Descrição curta + impacto estimado]           │
│                                                   │
│  2️⃣ [Título da Ação]                              │
│     [Descrição curta + impacto estimado]           │
│                                                   │
│  3️⃣ [Título da Ação]                              │
│     [Descrição curta + impacto estimado]           │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Motor de Recomendações (priorizar por impacto):**

As recomendações são selecionadas automaticamente baseado nos scores mais baixos:

| Condição | Recomendação | Descrição |
|----------|-------------|-----------|
| Score Financeiro < 50 | **Mapear CMV real dos 10 pratos mais vendidos** | "Restaurantes do seu segmento que medem CMV real descobrem gaps de 8-12% entre o que acham que gastam e o que realmente gastam. Isso pode representar R$ [X]/mês." |
| Score Financeiro < 60 | **Implementar DRE mensal e rotina de caixa** | "Sem DRE, você descobre o resultado 45 dias depois. Com DRE integrado à operação, você vê o resultado em tempo real e age antes de perder margem." |
| Score Reputação < 60 | **Padronizar operação para melhorar nota iFood** | "Cada 0.1 ponto de rating = ~8% mais pedidos no delivery. Checklist de qualidade + resposta a avaliações costumam subir a nota em 0.3 pontos em 90 dias." |
| Score Digital < 50 | **Ativar canal de fidelização via WhatsApp** | "Restaurantes com programa de fidelidade ativo via WhatsApp aumentam frequência de visita em 25-40%. Seus [X] seguidores são uma base que ainda não está sendo monetizada." |
| Score Competitivo < 50 (saturação alta) | **Diferenciar pela experiência, não pelo preço** | "Em bairros competitivos como [bairro], a gestão é o que separa quem lucra de quem só fatura. Restaurantes que controlam custos e padronizam operação ganham margem mesmo com preço igual." |
| Score Competitivo > 70 (pouca competição) | **Capitalizar posição dominante no bairro** | "Você tem vantagem competitiva rara: pouca concorrência direta no [bairro]. Investir em fidelização agora consolida uma base que concorrentes futuros terão dificuldade de tomar." |
| Seguidores > 3000 mas Score Financeiro < 60 | **Converter audiência digital em controle financeiro** | "Você já conquistou [X] seguidores — a marca tem tração. O próximo passo é garantir que cada venda gerada por esse público seja lucrativa. Muitos restaurantes com boa audiência descobrem que vendiam muito e lucravam pouco." |

Selecionar as **3 recomendações com maior impacto** (priorizar Score Financeiro se estiver baixo — é onde está o dinheiro).

---

### BLOCO 7: RED FLAGS — O QUE PODE ESTAR PASSANDO DESPERCEBIDO

Este bloco é o "killer punch" do Radar. São alertas ESPECÍFICOS para aquele restaurante, não genéricos.

```
┌─────────────────────────────────────────────────┐
│ ⚠️ Alertas Detectados                            │
├─────────────────────────────────────────────────┤
│                                                   │
│  🔴 [Red Flag 1 — contextual]                    │
│  🟡 [Red Flag 2 — contextual]                    │
│  🟡 [Red Flag 3 — contextual]                    │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Motor de Red Flags (selecionar 2-3 por lead, por relevância):**

| Condição | Red Flag | Cor |
|----------|----------|-----|
| Rating < média do bairro | "Sua nota no iFood está abaixo da média do bairro ([X.X] vs [Y.Y]). Cada 0.1 ponto pode impactar até 8% do volume de pedidos." | 🔴 |
| Rating >= 4.0 mas priceRange "$" | "Nota alta com preço baixo pode indicar margem apertada — você atrai volume mas pode estar lucrando pouco por pedido." | 🟡 |
| Sem Instagram ou < 500 seguidores | "Ausência digital: mais de 70% dos clientes buscam restaurantes no Instagram antes de pedir. Sem presença ativa, você depende 100% de localização e iFood." | 🔴 |
| Saturação alta no bairro (>4 do mesmo cuisine) | "Bairro saturado: [X] restaurantes de [cuisine] no [bairro]. Em mercados competitivos, quem controla custos sobrevive — quem não controla, desaparece." | 🟡 |
| PriceRange "$" com cuisine premium (Japonês/Italiana) | "Posicionamento de preço abaixo do padrão para [cuisine]. Isso pode significar margem insuficiente para cobrir o CMV característico do segmento." | 🔴 |
| Seguidores altos (>3000) mas rating baixo (<4.0) | "Audiência forte mas nota fraca — seus seguidores atraem pedidos que depois geram avaliações ruins. Priorize padronização antes de crescer mais." | 🔴 |
| Seguidores altos (>3000) mas sem Score Financeiro | "Marca forte digitalmente mas sem controle financeiro visível. É o perfil clássico do restaurante que vende muito e lucra pouco." | 🟡 |
| Único do segmento no bairro | "Vantagem competitiva rara — mas sem programa de fidelidade, clientes podem migrar facilmente quando um concorrente aparecer." | 🟡 |

**Princípio:** Cada red flag deve ser VERIFICÁVEL pelo dono e ACIONÁVEL. Nunca genérico, nunca alarmista. O tom é consultivo: "isso pode estar acontecendo" — não "isso está acontecendo".

---

### BLOCO 8: ROADMAP 90 DIAS — O CAMINHO CLARO

Em vez de só listar recomendações soltas, apresentar um **roadmap visual de 90 dias** com ganhos acumulados. Isso transforma crítica em PLANO e mostra que existe caminho.

```
┌─────────────────────────────────────────────────┐
│ 📅 Se Você Fizer Isso nos Próximos 90 Dias       │
├─────────────────────────────────────────────────┤
│                                                   │
│  MÊS 1: Diagnóstico + Controle Básico            │
│  ─────────────────────────────                    │
│  • Mapear CMV real dos 10 pratos mais vendidos    │
│  • Implementar rotina de fechamento de caixa      │
│  • Ganho estimado: R$ [X]/mês em vazamentos       │
│    identificados                                   │
│                                                   │
│  MÊS 2: Otimização + Padrão                      │
│  ─────────────────────────────                    │
│  • Repreccificar itens com margem negativa         │
│  • Padronizar operação com checklists              │
│  • Ganho acumulado: R$ [Y]/mês + melhoria de      │
│    rating estimada                                 │
│                                                   │
│  MÊS 3: Crescimento + Fidelização                │
│  ─────────────────────────────                    │
│  • Ativar CRM + primeira campanha WhatsApp         │
│  • Programa de fidelidade básico                   │
│  • Ganho acumulado: R$ [Z]/mês + base de           │
│    clientes recorrentes                            │
│                                                   │
│  📊 Resultado Projetado em 90 dias:               │
│  R$ [Total] recuperados + base para crescer       │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Cálculo dos ganhos por mês:**
```
mês_1 = oportunidade_financeira × 0.40  # 40% do vazamento cortado
mês_2 = oportunidade_financeira × 0.65  # 65% acumulado
mês_3 = oportunidade_financeira × 0.85  # 85% acumulado + crescimento CRM

total_90_dias = mês_3 × 3  # projeção trimestral
```

**Por que funciona:** O dono não quer só saber que está perdendo — quer saber COMO RECUPERAR. O roadmap transforma ansiedade em ação. E o melhor: mostra que o caminho é rápido (90 dias, não 2 anos).

---

### BLOCO 9: PROVA SOCIAL — NÃO É SÓ TEORIA

```
┌─────────────────────────────────────────────────┐
│ 📈 O Que Restaurantes Semelhantes Conseguiram    │
├─────────────────────────────────────────────────┤
│                                                   │
│  "210+ restaurantes já usam o ecossistema NOLA"   │
│                                                   │
│  • R$ 26,8M processados por mês                   │
│  • Implantação média: 5 dias                      │
│  • Restaurantes com controle de CMV ativo          │
│    reduziram desperdício em 12-18% nos primeiros   │
│    90 dias (média da base NOLA)                    │
│                                                   │
│  [Mini-depoimento se disponível]                  │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Regra:** Usar APENAS números verificáveis da base NOLA (referência: metricas-kpis.md). Nunca inventar cases. Se não houver case específico do segmento/região, usar os números gerais.

---

### BLOCO 10: PERGUNTA PROVOCADORA — O FECHO ANTES DO CTA

Este é o elemento que a maioria dos materiais comerciais NÃO tem e que faz toda a diferença. Uma pergunta direta, impossível de ignorar.

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  💬 "Esse Radar estimou seu CMV em [X]%.          │
│      Se for menor, parabéns — você está melhor    │
│      que a média.                                  │
│      Se for maior... quanto está escapando?"       │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Por que funciona:**
- Reconhece a incerteza (honestidade = credibilidade)
- Cria um loop mental: "Será que é maior? Preciso saber..."
- Transforma o CTA de "quero vender pra você" em "quero te ajudar a descobrir"
- O dono que NÃO sabe o CMV real (maioria) fica INQUIETO

**Variações por pilar mais fraco:**
| Pilar mais fraco | Pergunta provocadora |
|------------------|---------------------|
| Financeiro | "Esse Radar estimou seu CMV em [X]%. Qual é o seu CMV real? Se a resposta é 'não sei'... esse é o primeiro número a descobrir." |
| Reputação | "Sua nota [X.X] está [acima/abaixo] da média. A pergunta é: quando foi a última vez que você respondeu uma avaliação negativa no iFood?" |
| Digital | "Você tem [X] seguidores. Quantos deles voltaram a pedir no último mês? Se não sabe... esse é dinheiro na mesa." |
| Competitivo | "Você é 1 de [X] restaurantes de [cuisine] no [bairro]. O que te diferencia dos outros [X-1] além da comida?" |

---

### BLOCO 11: CTA — O FECHAMENTO DO RADAR

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  📋 Este Radar é uma estimativa baseada em        │
│  dados públicos e benchmarks de mercado.          │
│                                                   │
│  Os números REAIS da sua operação podem ser       │
│  melhores — ou piores. Só um diagnóstico com      │
│  dados internos revela a verdade.                  │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  🟢 Quero ver meus números reais          │    │
│  │     (Diagnóstico gratuito em 20 min)       │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Powered by NOLA · usenola.com.br                 │
│  "Sua paixão é cozinhar. Nossa missão é           │
│   aumentar seu lucro."                             │
│                                                   │
└─────────────────────────────────────────────────┘
```

O botão CTA abre WhatsApp com mensagem pré-preenchida:
```
"Oi! Vi o Radar do [restaurante] e quero fazer o diagnóstico completo. Score: [XX]/100. Quando podemos fazer?"
```

**Tratamento de objeções embutido no CTA:**
O CTA preempta as 3 maiores objeções com micro-copy:
- "15 minutos" → Preempta "não tenho tempo"
- "Sem compromisso" → Preempta "isso é pra vender sistema"
- "Validar seus números reais" → Preempta "essas estimativas são genéricas"

---

## O PROMPT PERFEITO PARA O AGENTE GERAR O RADAR

### Contexto do Prompt

Este prompt vai dentro do fluxo N8N. Ele recebe dados de um lead da planilha e gera o HTML completo do Radar. O prompt precisa:

1. Receber os dados do lead como input estruturado
2. Calcular todos os scores usando os algoritmos definidos
3. Selecionar os insights contextuais corretos
4. Selecionar as 3 melhores recomendações
5. Gerar o HTML completo usando o template Nola Score como base visual
6. Gerar a mensagem WhatsApp de acompanhamento

### Input do Prompt

```json
{
  "lead": {
    "name": "Nome do restaurante",
    "neighborhood": "Bairro",
    "regiao": "Cidade/Região",
    "cuisine": "Tipo de cozinha",
    "priceRange": "$ ou $$ ou $$$",
    "rating": 4.2,
    "seguidores": 1500,
    "perfil_do_lead": "Descrição do perfil",
    "rapport": "Gancho de rapport",
    "instagramUrl": "URL do Instagram"
  },
  "contexto_bairro": {
    "total_restaurantes_bairro": 15,
    "total_mesmo_cuisine_bairro": 4,
    "rating_medio_bairro": 4.1,
    "rating_medio_cuisine": 4.0,
    "posicao_rating_bairro": 2,
    "priceRange_predominante": "$"
  }
}
```

### O Prompt

```
# SISTEMA: Gerador de Radar — Análise Express de Restaurante

Você é um analista de negócios especialista em food service brasileiro. Sua tarefa é gerar um documento HTML chamado "Radar [Restaurante]" — uma análise personalizada da operação de um restaurante baseada em dados públicos e benchmarks de mercado.

## REGRAS ABSOLUTAS

1. O HTML gerado deve ser UM ARQUIVO ÚNICO, autocontido, com CSS inline no <style> do <head>. Zero dependências externas.
2. O design segue o padrão Nola Score: dark mode (#0b0f14 fundo, #111827 cards, #22c55e accent verde, #e5e7eb texto, bordas rgba suaves, border-radius 16px, box-shadow com depth).
3. Responsivo mobile-first — o dono vai abrir no celular pelo WhatsApp.
4. Tom: profissional mas acessível. Fala como consultor que entende de restaurante, não como sistema corporativo. Sem jargão tech.
5. Todos os números financeiros devem ser apresentados como RANGES (nunca um número exato) e sempre com disclaimer de estimativa.
6. O documento deve provocar curiosidade e desconforto produtivo, NUNCA medo ou pressão.

## DADOS DO LEAD
[Inserir JSON do lead aqui]

## CONTEXTO COMPETITIVO DO BAIRRO
[Inserir JSON do contexto aqui]

## BENCHMARKS DE REFERÊNCIA

### CMV e Faturamento por Segmento

| Cuisine | CMV Ideal | CMV Médio (sem controle) | Faturamento $ | Faturamento $$ | Faturamento $$$ |
|---------|-----------|--------------------------|---------------|----------------|-----------------|
| Lanches | 30% | 39% | 25-50k | 50-100k | — |
| Marmita | 32% | 41% | 20-40k | 40-80k | — |
| Pizza | 27% | 36% | 30-60k | 60-120k | — |
| Japonês | 32% | 43% | — | 60-120k | 120-250k |
| Açaí | 27% | 36% | 20-45k | 45-90k | — |
| Doces | 24% | 33% | 15-35k | 35-70k | — |
| Frangos | 30% | 38% | 30-60k | 60-100k | — |
| Italiana | 30% | 39% | — | 50-100k | 100-200k |

### Scoring de Rating iFood (calibrado para ICP 80k+)
| Rating | Score | Contexto |
|--------|-------|----------|
| = 5.0 | 95 | Excepcional — raríssimo |
| >= 4.8 | 82 | Excelente — top do mercado |
| >= 4.6 | 68 | Bom — padrão de restaurantes 80k+ |
| >= 4.3 | 55 | Mediano para o porte |
| >= 4.0 | 40 | Abaixo do esperado |
| >= 3.5 | 28 | Preocupante |
| < 3.5 | 15 | Zona de risco |

### Scoring de Seguidores Instagram (calibrado para ICP 80k+)
| Seguidores | Score | Contexto |
|------------|-------|----------|
| > 200.000 | 95 | Referência do mercado |
| > 100.000 | 82 | Presença muito forte |
| > 50.000 | 68 | Boa presença |
| > 20.000 | 55 | Mediano para o porte |
| > 10.000 | 42 | Abaixo do esperado |
| > 5.000 | 32 | Presença fraca |
| > 1.000 | 22 | Incipiente |
| <= 1.000 | 12 | Quase ausente |
| Sem dados | 8 | Penalidade máxima |

### Scoring Competitivo (por densidade + posição)
| Concorrentes mesmo cuisine no bairro | Base Score |
|---------------------------------------|-----------|
| 1 (único) | 85 |
| 2-3 | 70 |
| 4-6 | 55 |
| > 6 | 40 |

Bônus: +10 se melhor rating do segmento no bairro, +5 se top 3, +8 se priceRange diferente da maioria (nicho).

### Scoring Financeiro (por vazamento estimado)
| Vazamento estimado | Score |
|-------------------|-------|
| >= 14% | 25 |
| >= 10% | 40 |
| >= 7% | 55 |
| >= 4% | 70 |
| < 4% | 85 |

Vazamento = gap_cmv + 4% (desperdício + conciliação + precificação defasada)

## INSTRUÇÕES DE GERAÇÃO

### PASSO 1: Calcular todos os scores
- Score Reputação: tabela de rating iFood
- Score Digital: tabela de seguidores Instagram
- Score Competitivo: algoritmo de densidade + posição + nicho
- Score Financeiro: gap de CMV + vazamentos comuns
- Score Geral: (Reputação × 0.25) + (Digital × 0.20) + (Competitivo × 0.20) + (Financeiro × 0.35)

### PASSO 2: Calcular estimativa financeira
- Faturamento estimado: usar range da tabela [cuisine][priceRange]
- Gap CMV: CMV médio sem controle - CMV ideal
- Vazamento total: gap_cmv + 4%
- Oportunidade mínima: faturamento_min × vazamento × 0.7
- Oportunidade máxima: faturamento_max × vazamento × 1.0
- Oportunidade anual: oportunidade mensal × 12

### PASSO 3: Selecionar insights contextuais
Para cada bloco (Reputação, Digital, Competitivo, Financeiro), selecionar o insight adequado baseado no score.

### PASSO 4: Selecionar top 3 recomendações
Priorizar pelo score mais BAIXO. Financeiro sempre tem prioridade se score < 50.

### PASSO 5: Gerar o HTML

Estrutura do HTML (11 blocos):
1. CABEÇALHO: Logo NOLA (SVG inline do checkmark verde) + "Radar [Nome]" + subtítulo + dados de localização/cuisine/priceRange + badge "Análise Express"
2. GRID de 2 colunas (desktop) / 1 coluna (mobile):
   - COLUNA PRINCIPAL:
     a. Card Score Geral (gauge ring conic-gradient + chips dos 4 sub-scores)
     b. Card Estimativa Financeira (highlight box com range R$ + breakdown)
     c. Card Red Flags (2-3 alertas específicos baseados no perfil do lead)
     d. Card Roadmap 90 Dias (3 meses com ganhos progressivos)
     e. Card Pergunta Provocadora (frase de impacto antes do CTA)
     f. CTA (botão WhatsApp verde + micro-copy preemptando objeções)
   - SIDEBAR:
     a. Card Reputação (rating + barra comparativa + insight)
     b. Card Presença Digital (seguidores + classificação + insight)
     c. Card Posicionamento Competitivo (densidade + posição + insight)
     d. Card Prova Social (210+ restaurantes, R$ 26.8M/mês, redução CMV 12-18%)
     e. Card Top 3 Recomendações (lista estilizada com impacto estimado)
3. FOOTER: "Powered by NOLA" + tagline + disclaimer legal

**Importante para o agente:** A SIDEBAR fica visível o tempo todo em desktop (scroll da coluna principal ao lado). Em mobile, os cards da sidebar aparecem INTERCALADOS com os da coluna principal na ordem: Score → Reputação → Digital → Competitivo → Financeiro → Red Flags → Roadmap → Prova Social → Recomendações → Pergunta → CTA.

### PASSO 6: Gerar mensagem WhatsApp (output separado)

A mensagem WhatsApp é o que o SDR envia ANTES de compartilhar o Radar. Formato:

```
Linha 1: Gancho de rapport (usar campo "rapport" do lead)
Linha 2: Ponte para o entregável ("fiz/montei/preparei uma análise...")
Linha 3-4: Oferta + pergunta ("posso te mandar?" / "quer ver?")
```

Tom: curioso e genuíno, como se tivesse feito a análise por interesse real. NUNCA vendedor. NUNCA corporate. Máximo 4 linhas. Máximo 1 emoji.

## OUTPUT ESPERADO

1. HTML completo do Radar (arquivo único autocontido)
2. Mensagem WhatsApp de abertura (3-4 linhas)
3. Mensagem WhatsApp de follow-up pós-envio do Radar (para quando o lead abrir)
4. Dados para o HubSpot: score geral, 4 sub-scores, oportunidade estimada
```

---

## FLUXO COMPLETO DE USO — DA PLANILHA AO AGENDAMENTO

```
PLANILHA DE LEADS (scraper)
        │
        ▼
[1] MOTOR DE CONTEXTO
    • Calcula dados do bairro (quantos restaurantes,
      rating médio, saturação)
    • Enriquece cada lead com contexto competitivo
        │
        ▼
[2] GERADOR DE RADAR (prompt acima)
    • Para cada lead, gera:
      - HTML do Radar personalizado
      - Mensagem WhatsApp de abertura
      - Mensagem de follow-up
      - Dados pro HubSpot
        │
        ▼
[3] HOSPEDAGEM
    • HTML salvo em URL acessível
    • Ou: convertido em PDF
    • Ou: convertido em imagem (carousel WhatsApp)
        │
        ▼
[4] SDR ENVIA MENSAGEM WhatsApp
    "O ritmo do Temperao no Instagram tá impressionante 🔥
     Montei uma análise rápida da operação de vocês com uns
     dados que talvez te surpreendam. Posso te mandar?"
        │
        ▼
[5] LEAD RESPONDE "SIM" → SDR envia link do Radar
        │
        ▼
[6] FOLLOW-UP (24-48h depois)
    "E aí, viu o Radar? Algum número te chamou atenção?
     Aquilo são estimativas — se quiser ver os números
     reais da operação, em 20 min a gente faz junto.
     Terça ou quinta, qual fica melhor?"
        │
        ▼
[7] LEAD ENGAJA → Entra no Fluxo 2 (co-piloto SDR)
    → Qualificação BANT implícita
    → Condução ao agendamento
    → Se travar: acionar Fake Doors como reforço
```

---

## POR QUE CADA ELEMENTO DO RADAR CONVERSA COM UMA DOR REAL

| Elemento do Radar | Dor Real do Dono | Reação Emocional Esperada |
|-------------------|------------------|--------------------------|
| Score Geral baixo (35-55) | "Trabalho demais e não sei se tá dando certo" | "Putz, meu score tá baixo... o que posso fazer?" |
| Estimativa de R$ perdidos | "Sinto que perco dinheiro mas não sei onde" | "Será que é isso MESMO? Preciso conferir" |
| Comparação com bairro | "Será que sou competitivo?" | "Quero ser o melhor do bairro. O que me falta?" |
| Gap de CMV | "Não sei meu CMV real" | "Talvez eu esteja pagando caro demais nos insumos" |
| Rating vs. média | "Minha nota no iFood importa?" | "Preciso subir essa nota. Como?" |
| Presença digital baixa | "Sei que preciso do Instagram mas..." | "Tô perdendo cliente por não estar ativo online" |
| Recomendações acionáveis | "Não sei por onde começar" | "Isso faz sentido. Quero entender mais" |
| CTA diagnóstico real | "Esses números são verdade?" | "Se a estimativa já é X, imagina o real..." |

**A sequência psicológica é:**
1. **Curiosidade** (mensagem WhatsApp + rapport)
2. **Identificação** ("ele sabe do meu restaurante!")
3. **Desconforto produtivo** (score + números)
4. **Competitividade** (comparação com bairro)
5. **Urgência** (R$ perdidos por mês)
6. **Caminho claro** (3 ações + CTA)
7. **Decisão** ("se a estimativa já mostra isso, quero ver os números reais")

---

## ESPECIFICAÇÕES TÉCNICAS DO HTML

### Design System (baseado no Nola Score):
```css
--bg: #0b0f14          /* Fundo principal */
--card: #111827        /* Fundo dos cards */
--muted: #94a3b8       /* Texto secundário */
--text: #e5e7eb        /* Texto principal */
--line: #1f2937        /* Bordas */
--accent: #22c55e      /* Verde NOLA (accent) */
--warn: #f59e0b        /* Amarelo (warning) */
--bad: #ef4444         /* Vermelho (danger) */
--good: #22c55e        /* Verde (success) */
--shadow: 0 10px 30px rgba(0,0,0,.35)
--radius: 16px
```

### Layout:
- Grid: 1.2fr + 0.8fr (desktop) → 1fr (mobile < 860px)
- Cards: rgba(17,24,39,.72) com borda rgba(148,163,184,.14)
- Gauge ring: conic-gradient com inner circle
- Chips: border-radius 999px, fundo rgba(15,23,42,.55)
- Progress bars: 10px height, gradient verde
- Font: system-ui stack (-apple-system, Segoe UI, Roboto...)

### Responsividade:
- Breakpoint: 860px (grid → single column)
- Touch targets: mínimo 44px
- Font sizes: mínimo 12px para mobile
- CTA button: full-width em mobile

### Performance:
- Zero JavaScript (documento estático — não é quiz, é relatório)
- Zero dependências externas
- Tamanho alvo: < 15KB
- Carregamento instantâneo em 3G

---

## CHECKLIST DE QUALIDADE DO RADAR

Antes de enviar qualquer Radar, verificar:

- [ ] Nome do restaurante está correto e em destaque
- [ ] Bairro e cidade corretos
- [ ] Cuisine identificada corretamente
- [ ] Score geral está entre 30-75 (faixa de urgência)
- [ ] Estimativa financeira é um RANGE, nunca número exato
- [ ] Disclaimer de "estimativa baseada em dados públicos" presente
- [ ] Benchmarks de CMV correspondem ao cuisine correto
- [ ] Insights são contextuais (não genéricos)
- [ ] Top 3 recomendações são relevantes pro perfil
- [ ] CTA tem botão WhatsApp funcional
- [ ] Design renderiza corretamente no celular
- [ ] Não menciona o NOLA como produto até o footer
- [ ] Tom é consultivo, nunca vendedor
- [ ] O documento gera mais PERGUNTAS que respostas (isso é intencional — as respostas vêm na reunião)

---

## TRATAMENTO PREEMPTIVO DE OBJEÇÕES — EMBUTIDO NO RADAR

O Radar não pode só gerar curiosidade — precisa DESARMAR as objeções antes mesmo do lead verbalizá-las.

| Objeção Silenciosa | O que o dono pensa | Como o Radar preempta |
|--------------------|--------------------|----------------------|
| "Esse número é inventado" | "De onde tiraram esses dados?" | Disclaimer honesto + range (não número exato) + "Seus números reais podem ser melhores — ou piores" |
| "Isso é pra vender sistema" | "Tá querendo me empurrar produto" | NOLA só aparece no footer. Tom 100% consultivo. CTA diz "diagnóstico gratuito, sem compromisso" |
| "Eu já controlo meu CMV" | "Esse cara não sabe nada da minha operação" | Pergunta provocadora: "Se você sabe seu CMV, parabéns — mas qual a margem líquida real?" (sempre há próximo nível) |
| "Não tenho tempo" | "Mais um querendo marcar reunião" | CTA: "15 minutos. Só pra validar 3 números. Se não valer, você sai com 3 ações pra fazer sozinho." |
| "Meu bairro é diferente" | "Esse benchmark genérico não vale aqui" | Insight local: "Esses dados são para [cuisine] em [região]" + "A reunião valida pra sua realidade específica" |
| "Meu concorrente não ganha mais que eu" | "Se fosse tão fácil, todo mundo já faria" | Frase do Radar: "Faturar mais ≠ lucrar mais. Restaurantes com controle de CMV lucram em média 30% mais que os que não controlam — com o MESMO faturamento." |

---

## ESTRATÉGIA ANTI-COMMODITY — COMO EVITAR QUE O RADAR VIRE GENÉRICO

O maior risco do Radar é parecer um template. Se o dono perceber que é documento de massa, perde toda a força. Estratégias para evitar:

1. **Personalização de 3 camadas:**
   - Camada 1: Dados do restaurante (nome, bairro, rating) — obrigatória
   - Camada 2: Contexto competitivo (quantos concorrentes, posição no ranking) — diferenciadora
   - Camada 3: Red Flags específicas (combinação única de condições) — matadora

2. **Variação de linguagem:** O agente deve VARIAR frases, insights e recomendações entre leads. Nunca gerar dois Radares com as mesmas frases. O prompt instrui: "Varie os insights. Use sinônimos. Mude a estrutura das frases entre Radares."

3. **Dado "surpresa":** Cada Radar deve ter pelo menos 1 insight que o dono NÃO esperava. Exemplos: "Seu bairro tem mais restaurantes de [cuisine] que qualquer outro bairro de [cidade]" ou "Sua nota é a segunda melhor do segmento no bairro — mas a diferença pro primeiro é só 0.1 ponto."

4. **Timing personalizado:** O Radar mostra a DATA de geração ("Análise gerada em [hoje]"). Isso sinaliza: foi feito agora, pra você, não é estoque.

---

## MÉTRICAS DE SUCESSO

| Métrica | Alvo | Como medir |
|---------|------|------------|
| Taxa de resposta ao WhatsApp | > 40% | Leads que respondem "sim, manda" / total abordados |
| Taxa de abertura do Radar | > 70% | Leads que clicam no link / leads que receberam |
| Taxa de engajamento pós-Radar | > 30% | Leads que comentam sobre o Radar / leads que abriram |
| Taxa de agendamento | > 15% | Reuniões agendadas / total abordados |
| Tempo médio para primeira resposta | < 4h | Timestamp da resposta - timestamp do envio |

Comparativo: SDR outbound tradicional (só mensagem texto) tem taxa de resposta de 5-15%. Com o Radar, o alvo é 3-4x esse número.
