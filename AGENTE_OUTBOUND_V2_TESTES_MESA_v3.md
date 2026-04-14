# AGENTE OUTBOUND V2 - TESTES DE MESA V3

## Como usar

Para cada caso, validar quatro pontos
Mensagem final limpa para WhatsApp
No maximo uma tool chamada
Estado correto da conversa
Proximo passo coerente para agendamento

## Casos criticos

### Caso 01 curiosidade inicial sem radar enviado

Entrada do lead
Quem e voce mesmo

Pre condicao
radar_enviado false

Esperado
Estado opportunity
Chama Enviar Radar uma vez
Primeira frase posiciona Nola
Mensagem curta pedindo opiniao sobre o Radar

### Caso 02 curiosidade inicial com radar ja enviado

Entrada do lead
Interessante esse estudo

Pre condicao
radar_enviado true

Esperado
Estado connection
Nao chama Enviar Radar
Faz pergunta SPIN curta ligada ao score mais fraco

### Caso 03 resposta neutra curta sem recusa

Entrada do lead
Pode ser

Pre condicao
radar_enviado false

Esperado
Estado opportunity
Chama Enviar Radar uma vez
Nao pede permissao extra para enviar

### Caso 04 recusa explicita

Entrada do lead
Nao quero receber nada, para de mandar

Pre condicao
radar_enviado false

Esperado
Estado closed_lost
Nao chama Enviar Radar
Encerra com respeito e sem insistencia

### Caso 05 pergunta de preco primeira vez

Entrada do lead
Quanto custa

Pre condicao
radar_enviado true

Esperado
Estado diagnosis_transition
Nao inventa faixa adicional
Explica modular e convida para reuniao
Somente se insistir forte em nova rodada cita base R$ 550

### Caso 06 ja tenho sistema

Entrada do lead
Ja uso sistema aqui

Pre condicao
radar_enviado true

Esperado
Estado connection
Chama Concorrentes uma vez
Resposta compara com fatos e pergunta curta de contexto

### Caso 07 intencao de agenda sem horario exato

Entrada do lead
Bora marcar sim

Pre condicao
radar_enviado true

Esperado
Estado scheduling_slots
Chama Disponibilidade Closer uma vez
Oferece no maximo 3 horarios
Reforca 40 minutos e sem compromisso

### Caso 08 horario exato informado

Entrada do lead
Pode ser amanha as 17h

Pre condicao
radar_enviado true

Esperado
Estado scheduling_confirm
Chama Agendamento Closer uma vez com horario_inicio convertido
Retorna confirmacao objetiva com link da tool

### Caso 09 multi mensagem no mesmo turno

Entrada do lead
Primeira mensagem
De que empresa voces sao
Segunda mensagem
E esse radar ai como funciona

Pre condicao
radar_enviado false

Esperado
Unifica em um turno
Uma unica resposta
Primeira frase posiciona Nola
Chama Enviar Radar uma vez

### Caso 10 assunto fora do escopo

Entrada do lead
Qual maior time do Brasil

Pre condicao
radar_enviado true

Esperado
Nao responde o tema paralelo
Redireciona para assunto da conversa com educacao
Nenhuma tool chamada

### Caso 11 fallback de falha de tool

Entrada do lead
Pode marcar hoje no fim da tarde

Pre condicao
Falha tecnica em Disponibilidade Closer

Esperado
Uma tentativa de tool apenas
Sem nova chamada no mesmo turno
Mensagem de contorno pedindo janela de horario

### Caso 12 apos agendamento

Entrada do lead
Fechado, obrigado

Pre condicao
Agendamento concluido

Esperado
Estado post_schedule_qualification
Confirma e coleta uma informacao de qualificacao por vez
Sem virar interrogatorio

## Criterio de aprovacao

Conformidade minima 95 por cento em 12 de 12 casos
Zero chamada duplicada de tool no mesmo turno
Zero mensagem com metatexto
Zero regressao para pitch inicial apos agendamento
