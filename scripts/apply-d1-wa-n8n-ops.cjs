/**
 * One-off: prints JSON args for n8n MCP.
 * Usage: node scripts/apply-d1-wa-n8n-ops.cjs > n8n-d1-payload.json
 */
const fs = require('fs');
const path = require('path');

const jsCode = fs.readFileSync(
  path.join(__dirname, '../workflows/sdr-outbound-d1-wa-variacao.js'),
  'utf8'
);

const findD1 = `D1_WA (Abertura)
Se apresente(Evite o uso do 'olá', muito raro em conversas humanas, tente um 'oi, tudo bem?' ou 'bom dia/boa tarde' dependendo do horário do dia ) e confirme se está falando com o representante do estabelecimento correto. Na sequencia informe que o estabelecimento chamou atenção durante um estudo de mercado na região e que por isso desenvolvemos estamos oferecendo um produto grátis para ele. Se tiver rapport, use como gancho. Crie exclusividade. NUNCA cite valor financeiro. Termine com pergunta de baixa fricção.
Importante se manter breve, queremos apenas gerar curiosidades, a mensagem deve ser o mais chamativa e curta possivel

D3_WA (Follow-up dado)`;

const replaceD1 = `{{ $('D1 WA variacao').item.json.d1_wa_copy_block }}

D3_WA (Follow-up dado)`;

const agregarFixed = `const outbound = $('Eventos Outbound Hoje').all();
const inbound = $('Eventos Inbound Hoje').all();
const agendados = $('Agendados Hoje').all();
const periodo = $('Calcular Periodo').item.json;
const byCanal = {};
const d1Var = { 1: 0, 2: 0, 3: 0, other: 0 };
for (const evt of outbound) {
  const c = evt.json.canal || 'desconhecido';
  if (!byCanal[c]) byCanal[c] = { enviados: 0, respostas: 0, agendamentos: 0 };
  byCanal[c].enviados++;
  if (evt.json.touchpoint_id === 'D1_WA' && evt.json.direcao === 'outbound') {
    const n = Number(evt.json.abertura_variacao);
    if (n === 1 || n === 2 || n === 3) d1Var[n]++;
    else d1Var.other++;
  }
}
const sessionsContacted = new Set(outbound.map(e => e.json.session_id));
for (const evt of inbound) {
  if (sessionsContacted.has(evt.json.session_id)) {
    const c = evt.json.canal || 'whatsapp';
    if (!byCanal[c]) byCanal[c] = { enviados: 0, respostas: 0, agendamentos: 0 };
    byCanal[c].respostas++;
  }
}
for (const s of agendados) {
  if (!byCanal['whatsapp']) byCanal['whatsapp'] = { enviados: 0, respostas: 0, agendamentos: 0 };
  byCanal['whatsapp'].agendamentos++;
}
const rows = Object.entries(byCanal).map(([canal, m]) => ({ bucket_inicio: periodo.week_start, bucket_fim: periodo.week_end, canal, enviados: m.enviados, respostas: m.respostas, agendamentos: m.agendamentos }));
const totalEnviados = outbound.length;
const totalRespostas = inbound.filter(e => sessionsContacted.has(e.json.session_id)).length;
const totalAgendados = agendados.length;
const taxaResp = totalEnviados > 0 ? ((totalRespostas / totalEnviados) * 100).toFixed(1) : '0';
const taxaAg = totalEnviados > 0 ? ((totalAgendados / totalEnviados) * 100).toFixed(1) : '0';
const d1Total = d1Var[1] + d1Var[2] + d1Var[3] + d1Var.other;
return {
  rows,
  summary: {
    data: periodo.today,
    enviados: totalEnviados,
    respostas: totalRespostas,
    agendamentos: totalAgendados,
    taxa_resposta: taxaResp + '%',
    taxa_agendamento: taxaAg + '%',
    d1_wa_variacoes: { v1: d1Var[1], v2: d1Var[2], v3: d1Var[3], sem_variacao: d1Var.other, total_d1: d1Total },
  },
};`;

/** Corpo WhatsApp (Notificar Admin): mesmo esquema number/text do draft no n8n. */
const notifyBodyParams = [
  { name: 'number', value: '=5512997312224' },
  {
    name: 'text',
    value: `=Resumo Outbound {{ $json.summary.data }}

Enviados: {{ $json.summary.enviados }}
Respostas: {{ $json.summary.respostas }} ({{ $json.summary.taxa_resposta }})
Agendamentos: {{ $json.summary.agendamentos }} ({{ $json.summary.taxa_agendamento }})

D1_WA por variacao: V1={{ $json.summary.d1_wa_variacoes.v1 }} V2={{ $json.summary.d1_wa_variacoes.v2 }} V3={{ $json.summary.d1_wa_variacoes.v3 }} sem={{ $json.summary.d1_wa_variacoes.sem_variacao }}`,
  },
];

const sdrOps = {
  id: 'XolilRXoC0RzMd6E',
  intent: 'D1_WA rotation: add Code node, wire, patch Gerar Msg, log abertura_variacao',
  operations: [
    {
      type: 'addNode',
      node: {
        id: 'code-d1-wa-var-001',
        name: 'D1 WA variacao',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [880, 32],
        parameters: { jsCode },
      },
    },
    {
      type: 'removeConnection',
      source: 'Pode enviar WA?',
      target: 'Gerar Msg',
      branch: 'true',
      ignoreErrors: true,
    },
    {
      type: 'addConnection',
      source: 'Pode enviar WA?',
      target: 'D1 WA variacao',
      branch: 'true',
    },
    { type: 'addConnection', source: 'D1 WA variacao', target: 'Gerar Msg' },
    {
      type: 'patchNodeField',
      nodeId: 'db20f3fb-5e88-4f56-a951-723786079d0d',
      fieldPath: 'parameters.options.systemMessage',
      patches: [{ find: findD1, replace: replaceD1 }],
    },
    {
      type: 'updateNode',
      nodeId: 'supa-insert-event-001',
      updates: {
        'parameters.fieldsUi.fieldValues': [
          { fieldId: 'session_id', fieldValue: "={{ $('Preparar touchpoint').item.json.session_id }}" },
          { fieldId: 'touchpoint_id', fieldValue: "={{ $('Preparar touchpoint').item.json.touchpoint_id }}" },
          { fieldId: 'canal', fieldValue: "={{ $('Preparar touchpoint').item.json.canal }}" },
          { fieldId: 'formato', fieldValue: 'texto' },
          { fieldId: 'direcao', fieldValue: 'outbound' },
          { fieldId: 'mensagem_texto', fieldValue: "={{ $('Gerar Msg').item.json.output }}" },
          { fieldId: 'resultado', fieldValue: 'enviado' },
          { fieldId: 'n8n_execution_id', fieldValue: '={{ $execution.id }}' },
          { fieldId: 'workflow_name', fieldValue: 'SDR Outbound' },
          {
            fieldId: 'abertura_variacao',
            fieldValue: "={{ $('D1 WA variacao').item.json.abertura_variacao }}",
          },
        ],
      },
    },
  ],
};

const aggOps = {
  id: '95QTb55ZLM0r0AIe',
  intent: 'Agregador: count D1_WA by abertura_variacao in summary',
  operations: [
    {
      type: 'updateNode',
      nodeId: 'ma-agregar',
      updates: { 'parameters.jsCode': agregarFixed },
    },
    {
      type: 'updateNode',
      nodeId: 'ma-notify',
      updates: { 'parameters.bodyParameters.parameters': notifyBodyParams },
    },
  ],
};

const out = { sdrOutbound: sdrOps, agregador: aggOps };
const outPath = path.join(__dirname, '../n8n-d1-payload.json');
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
process.stdout.write(JSON.stringify(out, null, 0));
