const fs = require('fs');
const path = require('path');

const jsCode = fs.readFileSync(
  path.join(__dirname, '../workflows/sdr-outbound-uazapi-falha-payload.js'),
  'utf8'
);

const nodeName = 'UAZAPI — payload falha';

const supaFields = [
  { fieldId: 'session_id', fieldValue: `={{ $('${nodeName}').item.json.session_id }}` },
  { fieldId: 'touchpoint_id', fieldValue: `={{ $('${nodeName}').item.json.touchpoint_id }}` },
  { fieldId: 'canal', fieldValue: `={{ $('${nodeName}').item.json.canal }}` },
  { fieldId: 'formato', fieldValue: `={{ $('${nodeName}').item.json.formato }}` },
  { fieldId: 'direcao', fieldValue: `={{ $('${nodeName}').item.json.direcao }}` },
  { fieldId: 'mensagem_texto', fieldValue: `={{ $('${nodeName}').item.json.mensagem_texto }}` },
  { fieldId: 'resultado', fieldValue: `={{ $('${nodeName}').item.json.resultado }}` },
  { fieldId: 'n8n_execution_id', fieldValue: '={{ $execution.id }}' },
  { fieldId: 'workflow_name', fieldValue: 'SDR Outbound' },
  {
    fieldId: 'abertura_variacao',
    fieldValue: `={{ $('${nodeName}').item.json.abertura_variacao }}`,
  },
  { fieldId: 'metadata', fieldValue: `={{ $('${nodeName}').item.json.metadata }}` },
];

const operations = [
  {
    type: 'addNode',
    node: {
      id: 'code-uazapi-falha-001',
      name: nodeName,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1680, -400],
      parameters: { jsCode },
    },
  },
  {
    type: 'addNode',
    node: {
      id: 'supa-log-falha-001',
      name: 'Supabase — log falha envio',
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [1880, -400],
      credentials: {
        supabaseApi: { id: 'H6LsO5AnjS3MemKE', name: 'Supabase Outbound_Scraper' },
      },
      parameters: {
        tableId: 'outbound_cadencia_eventos',
        fieldsUi: { fieldValues: supaFields },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      id: 'supa-retry-falha-001',
      name: 'Supabase — reagendar após falha',
      type: 'n8n-nodes-base.supabase',
      typeVersion: 1,
      position: [2080, -400],
      credentials: {
        supabaseApi: { id: 'H6LsO5AnjS3MemKE', name: 'Supabase Outbound_Scraper' },
      },
      parameters: {
        operation: 'update',
        tableId: 'outbound_cadencia_sessions',
        filters: {
          conditions: [
            {
              keyName: 'id',
              condition: 'eq',
              keyValue: `={{ $('${nodeName}').item.json.session_id }}`,
            },
          ],
        },
        fieldsUi: {
          fieldValues: [
            {
              fieldId: 'proximo_envio_at',
              fieldValue: `={{ $('${nodeName}').item.json.proximo_envio_at_retry }}`,
            },
            {
              fieldId: 'ultima_outbound_at',
              fieldValue: '={{ $now.toISO() }}',
            },
          ],
        },
      },
    },
  },
  {
    type: 'updateNode',
    nodeId: '4f9896ea-b71a-485f-9de4-d0b53594e354',
    updates: {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 3,
          },
          conditions: [
            {
              id: '9c106177-c7c2-422c-a126-8cfb9ab5b0f2',
              leftValue: '={{ Boolean($json.error) }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
      },
    },
  },
  {
    type: 'addConnection',
    source: 'Error?',
    target: nodeName,
    branch: 'true',
  },
  { type: 'addConnection', source: nodeName, target: 'Supabase — log falha envio' },
  {
    type: 'addConnection',
    source: 'Supabase — log falha envio',
    target: 'Supabase — reagendar após falha',
  },
  {
    type: 'addConnection',
    source: 'Supabase — reagendar após falha',
    target: 'Um lead por vez',
  },
];

const payload = {
  id: 'XolilRXoC0RzMd6E',
  intent: 'UAZAPI erro 500: log falha + reagendar sessão',
  operations,
};

fs.writeFileSync(
  path.join(__dirname, '../_n8n-ops-falha.json'),
  JSON.stringify(payload, null, 2),
  'utf8'
);
console.log('written', path.join(__dirname, '../_n8n-ops-falha.json'));
