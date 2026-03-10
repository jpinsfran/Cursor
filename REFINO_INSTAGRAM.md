# O que integrar para informação refinada (Instagram + iFood)

Use este guia para me passar as decisões e dados que faltam. Com isso ajusto prompts, formato e uso de contexto no pipeline.

---

## 1. Objetivo do rapport (quem lê?)

- [ ] SDR / vendas (abertura de conversa, punch line)
- [ ] Atendimento (contexto da loja antes do contato)
- [ ] Gestor (visão geral para priorização)
- Outro: _______________

**Por quê:** Define tom (mais direto vs. mais completo) e o que destacar em cada coluna.

---

## 2. Contexto iFood na IA (hoje não usamos)

O script **não** envia para o Python:
- Nome do restaurante (ex.: "Karabã Asian Street Food")
- Cozinha/tipo (ex.: "Comida Asiática")
- Bairro/cidade (ex.: "Saco Grande, Florianópolis")
- Faixa de preço

**O que você quer?**
- [ ] Enviar nome + cuisine + região para o Python em **todas** as chamadas de IA (conclusão, punch line, destaques, stories), para a IA escrever já sabendo “quem” é o lead.
- [ ] Só em conclusão e punch line.
- [ ] Não usar (manter só o que vem do Instagram).

Se sim: o `unificaIfoodInstagram.js` já tem `row.name`, `row.cuisine`, `row.regiao`, etc.; é só eu passar isso para o `runFullInstagramAnalysis` e o Python.

---

## 3. Formato desejado

**Conclusão**
- Limite de caracteres? (ex.: máx. 300, 500)
- Formato: um parágrafo contínuo (como hoje) ou tópicos (ex.: • Tipo: ... • Foco: ... • Objetivo nas redes: ...)?
- Algo que **nunca** deve aparecer? (ex.: hashtags, “@”)

**Punch line**
- Sempre 1 frase ou pode ser 2?
- Limite de caracteres? (ex.: máx. 120, 150)
- Exemplo de frase que você considera “perfeita”: _______________

**Destaques (visão geral)**
- Mais foco em: cardápio, horários, promoções, ambiente, ou tudo por igual?
- Limite de caracteres?

**Stories ativos**
- Mesmo formato da conclusão ou mais curto (ex.: 1–2 frases)?

---

## 4. Exemplos de “ideal” (copie e cole)

Mande **1 exemplo real** (ou fictício) de cada, do jeito que você quer que saia no CSV:

**Conclusão ideal (exemplo):**
```
(colar aqui)
```

**Punch line ideal (exemplo):**
```
(colar aqui)
```

**Destaques visão geral ideal (exemplo):**
```
(colar aqui)
```

Com isso ajusto os system prompts do `instagram_ai.py` para chegar nesse padrão.

---

## 5. Encoding e planilha

- O CSV já é gravado com BOM UTF-8. Se ao abrir no Excel aparecer **** (ã, ç, etc. quebrados), ao abrir: Dados → “De texto/CSV” → escolher o arquivo → Origem do arquivo: **65001: Unicode (UTF-8)**.
- Quer que eu force **separador** diferente (ex.: `;` em vez de `,`) ou **formato de data** em alguma coluna? Diga qual.

---

## 6. O que NÃO é possível (lembrete)

- **Stories ativos:** Só preenche se houver story no momento do scrape; senão a coluna fica vazia (não inventamos).
- **Destaques:** Se o perfil não tiver highlights, a coluna fica vazia.
- Dados que não existirem na página ou na IA ficam em branco (regra de não inventar).

---

## Resumo do que me enviar

1. Quem usa o rapport (SDR / atendimento / gestor).
2. Se quer contexto iFood (nome, cuisine, região) na IA e em quais colunas.
3. Limites de tamanho e formato (conclusão, punch line, destaques, stories).
4. **Um exemplo de texto ideal** para: conclusão, punch line e (se quiser) destaques.
5. (Opcional) Problema de encoding no Excel ou preferência de separador.

Com isso integro e deixo a informação refinada de forma consistente.
