# Pesquisa: Base de Dados para Telefone de Donos de Restaurantes (Prospecção Nola)

## Pontos críticos

### 1. Telefone do estabelecimento vs telefone do dono

| Tipo | Fonte oficial? | Onde encontrar |
|------|----------------|----------------|
| **Telefone do estabelecimento** | Sim | Receita Federal (dados abertos CNPJ). Consta no cadastro do estabelecimento. |
| **Telefone do dono/sócio** | Não | A Receita **não** divulga telefone pessoal de sócios. Só nome, qualificação e participação. Qualquer base que ofereça “telefone do dono” usa **enriquecimento** de terceiros. |

Ou seja: **não existe base “oficial” com telefone do dono**. Toda oferta de “telefone do sócio/dono” vem de enriquecimento cadastral, com níveis diferentes de confiabilidade.

---

## Bases mais confiáveis para contato (estabelecimento + dono)

Ordenadas pelo que mais se aproxima do que você precisa: **telefone útil para falar com o dono** (incluindo celular/WhatsApp).

### Tier 1 – Foco em telefone validado / certificado

| Base | O que oferece | Confiabilidade (telefone) | Observação |
|------|----------------|---------------------------|------------|
| **Think Data** | Localização e **certificação** de telefones (fixo e móvel); prioriza celular/WhatsApp; enriquecimento em massa. | Alta para telefone em uso | Bureau de dados; não vende “lista de donos”, mas **enriquece sua lista** (ex.: a partir do seu CSV com CNPJ). Você já tem os restaurantes; eles entregam telefones atualizados/certificados. |
| **Omnidados** | +60 mi empresas; telefones e **WhatsApp** “validados”; dados de sócios; segmentação por CNAE/local. | Alta (telefones validados) | LGPD; segmentação por MEI, ME, etc. Boa para comprar lista de restaurantes **com** telefone. Confirmar no comercial se o telefone é do estabelecimento ou se há opção “contato do sócio”. |
| **Econodata** | ~402 mil restaurantes (CNAE 5611-2/01); “Decisores” e “Contatos”; plano **premium** com e-mails e **telefones validados**. | Alta no plano premium | Foco B2B; filtros por faturamento, decisores, tecnologias. Contatos/telefones validados aparecem no produto premium. |

### Tier 2 – Boa cobertura, confiabilidade a confirmar

| Base | O que oferece | Confiabilidade (telefone) | Observação |
|------|----------------|---------------------------|------------|
| **Cadastro Nacional** | +44 mi empresas; **dados dos sócios**; telefones e e-mails; atualização trimestral; segmentação por ramo e local. | Média–alta | Afirma incluir telefone nos registros; não explicita se é do estabelecimento ou do sócio. Vale pedir amostra e política de atualização. |
| **BaseCNPJ** | +61 mi empresas; ~4,8 mi de restaurantes; filtro por CNAE/local; pagamento por uso. | Média | Telefone costuma ser o do CNPJ (estabelecimento). Verificar se há “append” de telefone de sócio. |
| **CNPJTA** | CNPJ, e-mail, **telefones**, WhatsApp, sócios, CNAE, porte; atualização mensal; garantia de 7 dias. | Média | Inclui telefone e WhatsApp; típico ser do estabelecimento. Perguntar se há opção de contato do responsável/sócio. |
| **Prospectando B2B** | +68 mi empresas; filtros por CNAE, porte, etc.; export Excel/SQLite. | Média | Base grande; detalhes de “telefone do dono” e validação devem ser confirmados no comercial. |

### Tier 3 – Foco internacional (referência)

| Base | O que oferece | Confiabilidade | Observação |
|------|----------------|----------------|------------|
| **InfoGlobalData** | Listas de donos de restaurantes; e-mail e **telefone** “100% verificados”; NCOA; GDPR/CCPA. | Alta (nos EUA) | Mercado principalmente EUA. Não substitui uma base Brasil, mas mostra o padrão “verificado” que vale buscar aqui. |
| **RestaurantsListsHQ** | 100k+ contatos; telefone, e-mail, site; **98%+ precisão** declarada; atualização diária. | Alta (declarada) | Também foco internacional. Útil como referência de nível de qualidade a exigir de fornecedores no Brasil. |

---

## Estratégia recomendada para o Nola

Você já tem uma base forte: **ifoodLeads_SP.csv** com nome, URL, **telefone**, CNPJ, endereço, rating, etc. (453 linhas).

### Opção A – Usar sua base + enriquecimento (recomendada)

1. **Manter sua lista do iFood** como base de restaurantes (já tem telefone do estabelecimento).
2. **Enriquecer com Think Data** (ou similar): enviar a lista com CNPJ/nome e pedir **localização e certificação de telefones** (priorizando celular/WhatsApp). Eles não “inventam” dono; entregam telefones que têm maior chance de ser de decisor/uso atual.
3. **Complementar** com uma base que ofereça “decisor/sócio” (Econodata premium ou Omnidados) para um subconjunto que queira priorizar (ex.: por faturamento ou região).

Assim você maximiza **confiabilidade do número** (certificação) e ainda pode testar ofertas que incluam “contato do dono” onde disponível.

### Opção B – Comprar lista nova de restaurantes

1. Escolher **uma** base do Tier 1 (ex.: **Omnidados** ou **Econodata**).
2. Filtrar por CNAE de restaurantes (ex. 5611-2/01) e por local (ex. SP).
3. Pedir **amostra** com telefone e (se possível) indicação de “decisor/sócio” e política de validação/atualização.
4. Comparar taxa de assertividade (ligou e era o dono/decisor?) com a da sua base do iFood.

### Opção C – Dados gratuitos (só estabelecimento)

- **Receita Federal**: dados abertos CNPJ têm **telefone do estabelecimento**, não do dono.  
- **Econodata**: consulta básica gratuita; contatos/telefones validados só no plano pago.

---

## Checklist na hora de fechar com um fornecedor

- [ ] O telefone é do **estabelecimento** ou do **sócio/responsável**?
- [ ] Há **validação/certificação** (ex.: celular ativo, WhatsApp)?
- [ ] Qual a **política de atualização** (mensal, trimestral)?
- [ ] Oferecem **garantia ou reembolso** (ex.: 7 dias)?
- [ ] **Amostra** antes de comprar em volume?
- [ ] Conformidade **LGPD** e uso permitido para prospecção?

---

## Resumo

- **Maior confiabilidade para “telefone que funciona” (incluindo dono/decisor):** **Think Data** (enriquecimento + certificação) na **sua** lista; ou listas com telefone **validado** da **Omnidados** ou **Econodata (premium)**.
- **Não existe base oficial com telefone do dono;** todas usam enriquecimento. Priorize quem declara **validação/certificação** e aceite pedir **amostra** antes de comprar em massa.

Se quiser, posso sugerir um texto pronto para enviar ao comercial da Think Data ou da Omnidados pedindo proposta para “telefone de dono/responsável de restaurante para prospecção”.
