/**
 * Code node "D1 WA variacao" — SDR Outbound (n8n).
 * Coloque APÓS "Pode enviar WA?" (ramo true) e ANTES de "Gerar Msg".
 * Depende de: Supabase migration 008 (rpc/next_d1_wa_variacao).
 */

return await (async function () {
  const V1 = `D1_WA (Abertura) — VARIAÇÃO 1
Se apresente (evite "olá"; prefira "oi, tudo bem?" ou bom dia/boa tarde conforme o horário) e confirme se fala com quem decide pelo estabelecimento. Diga que o restaurante chamou atenção num estudo de mercado da região e que por isso estamos oferecendo algo gratuito para ele. Se tiver rapport, use como gancho. Crie exclusividade. NUNCA cite valor financeiro. Termine com pergunta de baixa fricção.
Mantenha curto e chamativo; o objetivo é só despertar curiosidade.`;

  const V2 = `D1_WA (Abertura) — VARIAÇÃO 2
Abra com tom leve (oi/tudo bem ou bom dia/boa tarde) e confirme o contato certo. Diga que estamos fechando um recorte de desempenho dos negócios do bairro/região e que o restaurante entrou no radar por um motivo específico (use rating, perfil ou dado do radar com cuidado, sem inventar). Ofereça um material gratuito ligado a esse recorte, sem citar sistema ou produto. Crie exclusividade. NUNCA cite valor financeiro. Feche com pergunta simples.
Máximo 3 linhas; uma ideia por mensagem.`;

  const V3 = `D1_WA (Abertura) — VARIAÇÃO 3
Comece naturalmente (evite "olá") e valide se está falando com quem manda no salão. Mencione que fazemos um mapeamento rápido de operações na região e que o nome do restaurante apareceu como caso interessante para acompanhar (use apenas dados que já estão no contexto). Convide a receber um resumo gratuito desse recorte, sem mencionar software ou marca de ferramenta. NUNCA cite valor financeiro. Uma pergunta curta no fim.
Seja direto; curiosidade antes de qualquer detalhe.`;

  const BLOQUES = { 1: V1, 2: V2, 3: V3 };

  const prep = $('Preparar touchpoint').first().json;
  const tp = prep.touchpoint_id;

  if (tp !== 'D1_WA') {
    return [
      {
        json: {
          d1_wa_variacao: null,
          d1_wa_copy_block: '',
          abertura_variacao: null,
        },
      },
    ];
  }

  let v = 1;
  try {
    const cred = await this.getCredentials('supabaseApi');
    const host = String(cred.host || '').replace(/\/$/, '');
    const key = cred.serviceRole;
    const raw = await this.helpers.httpRequest({
      method: 'POST',
      url: `${host}/rest/v1/rpc/next_d1_wa_variacao`,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      json: true,
    });
    if (typeof raw === 'number') v = raw;
    else if (raw && raw.next_d1_wa_variacao != null) v = raw.next_d1_wa_variacao;
    else v = parseInt(raw, 10) || 1;
    v = Math.max(1, Math.min(3, parseInt(v, 10) || 1));
  } catch (e) {
    v = (Date.now() % 3) + 1;
  }

  return [
    {
      json: {
        d1_wa_variacao: v,
        d1_wa_copy_block: BLOQUES[v] || BLOQUES[1],
        abertura_variacao: v,
      },
    },
  ];
}).call(this);
