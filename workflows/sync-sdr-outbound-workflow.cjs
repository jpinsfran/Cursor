/**
 * Sincroniza workflows/sdr-outbound-workflow.json a partir dos .js de referência
 * e aplica ajustes estruturais (Cron 15min, claim lease, UAZAPI via env, saudação SP).
 *
 * Uso: node workflows/sync-sdr-outbound-workflow.cjs
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const wfPath = path.join(dir, 'sdr-outbound-workflow.json');
const w = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const filtrar = fs.readFileSync(path.join(dir, 'sdr-outbound-filtrar-vencidos.js'), 'utf8');
const prep = fs.readFileSync(path.join(dir, 'sdr-outbound-prepare-touchpoint.js'), 'utf8');
const claim = fs.readFileSync(path.join(dir, 'sdr-outbound-claim-dispatch-lease.js'), 'utf8');

for (const n of w.nodes) {
  if (n.name === 'Filtrar vencidos') n.parameters.jsCode = filtrar;
  if (n.name === 'Preparar touchpoint') n.parameters.jsCode = prep;
  if (n.name === 'Gerar Msg' && n.parameters?.options?.systemMessage) {
    const sm = n.parameters.options.systemMessage;
    if (!sm.includes('## Saudação (fuso)')) {
      n.parameters.options.systemMessage = sm.replace(
        '## DATA ATUAL',
        '## Saudação (fuso)\nUse bom dia, boa tarde ou boa noite **somente** conforme a hora local em **America/Sao_Paulo** (mesma referência de ## DATA ATUAL abaixo). Se já for noite em SP, **não** use "bom dia".\n\n## DATA ATUAL'
      );
    }
  }
  if (n.name === 'UAZAPI — enviar texto' && n.parameters?.headerParameters?.parameters) {
    for (const p of n.parameters.headerParameters.parameters) {
      if (p.name === 'token') {
        p.value = '={{ $env.UAZAPI_TOKEN }}';
      }
    }
  }
}

if (w.connections['Cron cadência 45min']) {
  w.connections['Cron cadência 15min'] = w.connections['Cron cadência 45min'];
  delete w.connections['Cron cadência 45min'];
}
if (w.staticData && w.staticData['node:Cron cadência 45min'] !== undefined) {
  w.staticData['node:Cron cadência 15min'] = w.staticData['node:Cron cadência 45min'];
  delete w.staticData['node:Cron cadência 45min'];
}

const hasClaim = w.nodes.some((n) => n.name === 'Claim dispatch lease');
if (!hasClaim) {
  w.nodes.push({
    parameters: { jsCode: claim },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [190, 32],
    id: 'code-claim-dispatch-001',
    name: 'Claim dispatch lease',
  });
  w.nodes.push({
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'claimOk',
            leftValue: '={{ $json._dispatch_claimed }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [300, 32],
    id: 'if-claim-dispatch-001',
    name: 'Dispatch claim OK?',
  });
}

w.connections['Um lead por vez'] = {
  main: [[], [{ node: 'Claim dispatch lease', type: 'main', index: 0 }]],
};

w.connections['Claim dispatch lease'] = {
  main: [[{ node: 'Dispatch claim OK?', type: 'main', index: 0 }]],
};

w.connections['Dispatch claim OK?'] = {
  main: [
    [{ node: 'Preparar touchpoint', type: 'main', index: 0 }],
    [{ node: 'Um lead por vez', type: 'main', index: 0 }],
  ],
};

function addLeaseClearFields(node) {
  if (!node?.parameters?.fieldsUi?.fieldValues) return;
  const fv = node.parameters.fieldsUi.fieldValues;
  if (fv.some((f) => f.fieldId === 'outbound_dispatch_lease_until')) return;
  fv.push(
    { fieldId: 'outbound_dispatch_lease_until', fieldValue: '={{ null }}' },
    { fieldId: 'outbound_dispatch_lease_execution_id', fieldValue: '={{ null }}' }
  );
}

for (const n of w.nodes) {
  if (
    ['Supabase — atualizar sessão', 'Supabase — reagendar skip', 'Supabase — reagendar após falha'].includes(
      n.name
    )
  ) {
    addLeaseClearFields(n);
  }
}

for (const n of w.nodes) {
  if (n.name === 'Skip — payload') {
    n.parameters.jsCode =
      "const claim = $('Claim dispatch lease').first().json || {};\n" +
      'const d = new Date();\n' +
      'd.setHours(d.getHours() + 24);\n' +
      'return [{ json: { session_id: $json.session_id, proximo_envio_at: d.toISOString(), touchpoint_id: $json.touchpoint_id, skipReason: $json.skipReason, _dispatch_execution_id: claim._dispatch_execution_id || \'\' } }];\n';
  }
}

if (w.meta) {
  w.meta.notes =
    'Cron 15 min. Migration 015 (dispatch lease). Filtrar vencidos: inbound após outbound pausa orquestrador. Variável de ambiente UAZAPI_TOKEN para envio.';
}

fs.writeFileSync(wfPath, JSON.stringify(w, null, 2) + '\n', 'utf8');
console.log('OK:', wfPath);
