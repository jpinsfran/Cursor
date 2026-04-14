# AGENTE OUTBOUND V2 - CHECKLIST DE PUBLICACAO E VALIDACAO

## 1 configuracao do node AI Agent

Confirmar que o prompt ativo e o arquivo AGENTE_OUTBOUND_V2_PROMPT_FINAL_v3.md
Confirmar que o campo de instrucoes nao contem sobras de versoes anteriores
Confirmar temperatura e parametros de geracao alinhados com respostas curtas

## 2 tools e nomes exatos

Confirmar nome exato das tools
Disponibilidade Closer
Agendamento Closer
Concorrentes
Enviar Radar
Think

Confirmar que nao existe tool duplicada com nome parecido
Confirmar schema de parametros de Agendamento Closer com horario_inicio

## 3 dados de contexto

Validar que estes campos chegam no AI Agent
$json.nome
$json.nome_negocio
$json.rating
$json.cuisine
$json.priceRange
$json.regiao
$json.neighborhood
$json.seguidores
$json.perfil_do_lead
$json.rapport
$json.email
$json.radar_enviado
$json.radar_enviado_em
$json.score_geral
$json.score_reputacao
$json.score_digital
$json.score_competitivo
$json.score_financeiro
$json.classificacao

Validar formatos de $now para data atual

## 4 protecao anti loop no fluxo

Garantir idempotencia no caminho que aciona o AI Agent
Evitar reentrada imediata por retry automatico sem controle
Registrar execucao por message id para bloquear respostas duplicadas
Garantir que envio do WhatsApp execute uma unica vez por turno

## 5 validacao funcional rapida

Executar ao menos estes testes de fumaca
Pergunta de identidade com radar_enviado false
Resposta neutra com radar_enviado false
Recusa explicita
Intencao de agendar sem horario
Horario exato informado
Lead mencionando concorrente

## 6 criterios de go live

Mensagem final sempre limpa, sem metatexto
No maximo uma tool por resposta
Nenhuma duplicidade de envio para mesmo turno
Agendamento concluindo com link retornado pela tool
Taxa de conformidade da suite de mesa maior ou igual a 95 por cento

## 7 rollback

Manter prompt anterior versionado para retorno imediato
Se houver erro em producao, voltar para versao anterior e coletar logs
Revisar falha e corrigir no v3 antes de novo deploy
