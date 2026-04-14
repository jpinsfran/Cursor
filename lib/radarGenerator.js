import { cleanText, parseRating } from "./leadDataUtils.js";

const OVERALL_WEIGHTS = {
  reputacao: 0.25,
  digital: 0.2,
  competitivo: 0.2,
  financeiro: 0.35,
};

const CUISINE_BENCHMARKS = {
  lanches: {
    label: "Lanches",
    cmvIdeal: 30,
    cmvMedio: 39,
    faturamento: {
      $: [25000, 50000],
      $$: [50000, 100000],
    },
    ratingMercado: 4.1,
    ratingIcp: 4.5,
    ratingDestaque: 4.8,
  },
  marmita: {
    label: "Marmita",
    cmvIdeal: 32,
    cmvMedio: 41,
    faturamento: {
      $: [20000, 40000],
      $$: [40000, 80000],
    },
    ratingMercado: 3.9,
    ratingIcp: 4.3,
    ratingDestaque: 4.6,
  },
  pizza: {
    label: "Pizza",
    cmvIdeal: 27,
    cmvMedio: 36,
    faturamento: {
      $: [30000, 60000],
      $$: [60000, 120000],
    },
    ratingMercado: 4.2,
    ratingIcp: 4.6,
    ratingDestaque: 4.8,
  },
  japones: {
    label: "Japonês",
    cmvIdeal: 32,
    cmvMedio: 43,
    faturamento: {
      $$: [60000, 120000],
      $$$: [120000, 250000],
    },
    ratingMercado: 4.3,
    ratingIcp: 4.7,
    ratingDestaque: 4.9,
  },
  acai: {
    label: "Açaí",
    cmvIdeal: 27,
    cmvMedio: 36,
    faturamento: {
      $: [20000, 45000],
      $$: [45000, 90000],
    },
    ratingMercado: 4.0,
    ratingIcp: 4.4,
    ratingDestaque: 4.7,
  },
  doces: {
    label: "Doces",
    cmvIdeal: 24,
    cmvMedio: 33,
    faturamento: {
      $: [15000, 35000],
      $$: [35000, 70000],
    },
    ratingMercado: 4.2,
    ratingIcp: 4.6,
    ratingDestaque: 4.8,
  },
  frangos: {
    label: "Frangos",
    cmvIdeal: 30,
    cmvMedio: 38,
    faturamento: {
      $: [30000, 60000],
      $$: [60000, 100000],
    },
    ratingMercado: 4.0,
    ratingIcp: 4.4,
    ratingDestaque: 4.7,
  },
  italiana: {
    label: "Italiana",
    cmvIdeal: 30,
    cmvMedio: 39,
    faturamento: {
      $$: [50000, 100000],
      $$$: [100000, 200000],
    },
    ratingMercado: 4.3,
    ratingIcp: 4.7,
    ratingDestaque: 4.9,
  },
};

function stripWrappedQuotes(value) {
  return cleanText(value).replace(/^"+|"+$/g, "").replace(/""/g, '"').trim();
}

function titleCase(value) {
  return stripWrappedQuotes(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeKey(value) {
  return stripWrappedQuotes(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return normalizeKey(value).replace(/\s+/g, "-") || "restaurante";
}

function normalizeRestaurantName(value) {
  return stripWrappedQuotes(value)
    .replace(/\s*\|\s*[^|]+?\s*\|\s*iFood\s*$/i, "")
    .replace(/\s*\|\s*iFood\s*$/i, "")
    .trim();
}

function normalizeRapport(value) {
  return stripWrappedQuotes(value).replace(/^gancho:\s*/i, "").trim();
}

function sentenceCase(value) {
  const text = stripWrappedQuotes(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sanitizeLeadRow(row = {}) {
  return {
    ...row,
    name: normalizeRestaurantName(row.name || row.tenant || row.restaurant || ""),
    url: stripWrappedQuotes(row.url || row.ifood_url || ""),
    neighborhood: stripWrappedQuotes(row.neighborhood || row.bairro || ""),
    neighborhoodDisplay: titleCase(row.neighborhood || row.bairro || ""),
    regiao: stripWrappedQuotes(row.regiao || row.city || row.region || ""),
    regiaoDisplay: titleCase(row.regiao || row.city || row.region || ""),
    cuisine: stripWrappedQuotes(row.cuisine || ""),
    priceRange: normalizePriceRange(row.priceRange || ""),
    rating: parseRating(stripWrappedQuotes(row.rating || "")),
    seguidores: parseFollowers(row.seguidores),
    instagramUrl: stripWrappedQuotes(row.instagram_profile_url || row.instagramUrl || ""),
    perfil_do_lead: stripWrappedQuotes(row.perfil_do_lead || ""),
    punch_line: normalizeRapport(row.punch_line || row.rapport || ""),
    phone: stripWrappedQuotes(row.phone || row.telefone || ""),
  };
}

function normalizePriceRange(value) {
  const raw = stripWrappedQuotes(value);
  const match = raw.match(/\$+/);
  return match ? match[0] : "";
}

function normalizeCuisineKey(value) {
  const key = normalizeKey(value);
  if (!key) return "";
  if (key.includes("lanche")) return "lanches";
  if (key.includes("marmita")) return "marmita";
  if (key.includes("pizza")) return "pizza";
  if (key.includes("jap")) return "japones";
  if (key.includes("acai")) return "acai";
  if (key.includes("doce") || key.includes("sobremesa")) return "doces";
  if (key.includes("frango")) return "frangos";
  if (key.includes("ital")) return "italiana";
  return "";
}

function parseFollowers(value) {
  const raw = stripWrappedQuotes(value);
  if (!raw) return null;

  const lowered = raw.toLowerCase().replace(/\s+/g, "");
  const normalized = lowered.replace(/seguidores?/, "");

  if (normalized.includes("mil")) {
    const base = Number.parseFloat(normalized.replace("mil", "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(base) ? Math.round(base * 1000) : null;
  }
  if (normalized.includes("k")) {
    const base = Number.parseFloat(normalized.replace("k", "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(base) ? Math.round(base * 1000) : null;
  }
  if (normalized.includes("m")) {
    const base = Number.parseFloat(normalized.replace("m", "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(base) ? Math.round(base * 1000000) : null;
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/,/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  const parsed = Number.parseFloat(normalized.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function average(values = []) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function median(values = []) {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];
}

function mode(values = []) {
  const counter = new Map();
  values.filter(Boolean).forEach((value) => {
    counter.set(value, (counter.get(value) || 0) + 1);
  });
  const sorted = [...counter.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  return sorted[0]?.[0] || "";
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatInteger(value) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR");
}

function formatFollowers(value) {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR");
}

function formatRating(value) {
  if (!Number.isFinite(value)) return "sem nota";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatMoneyRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "";
  return `${formatMoney(min)} - ${formatMoney(max)}`;
}

function getBenchmarkForCuisine(cuisineKey) {
  return CUISINE_BENCHMARKS[cuisineKey] || null;
}

function getReputationScore(rating) {
  if (!Number.isFinite(rating)) return 35;
  if (rating === 5) return 95;
  if (rating >= 4.8) return 82;
  if (rating >= 4.6) return 68;
  if (rating >= 4.3) return 55;
  if (rating >= 4.0) return 40;
  if (rating >= 3.5) return 28;
  return 15;
}

function getDigitalScore(followers) {
  if (!Number.isFinite(followers)) return 8;
  if (followers > 20000) return 95;
  if (followers > 10000) return 82;
  if (followers > 5000) return 68;
  if (followers > 2000) return 55;
  if (followers > 1000) return 42;
  if (followers > 500) return 32;
  if (followers > 100) return 22;
  return 12;
}

function getDigitalLevel(score) {
  if (score >= 82) return "Presença muito forte";
  if (score >= 55) return "Boa presença";
  if (score >= 32) return "Presença mediana";
  if (score >= 20) return "Presença fraca";
  return "Quase ausente";
}

function getCompetitiveScore(density, ratingPosition, priceRange, priceRangePredominante) {
  let baseScore = 40;
  if (density === 1) baseScore = 85;
  else if (density >= 2 && density <= 3) baseScore = 70;
  else if (density >= 4 && density <= 6) baseScore = 55;

  let bonus = 0;
  if (ratingPosition === 1) bonus += 10;
  else if (Number.isFinite(ratingPosition) && ratingPosition <= 3) bonus += 5;

  if (priceRange && priceRangePredominante && priceRange !== priceRangePredominante) {
    bonus += 8;
  }

  return Math.min(baseScore + bonus, 100);
}

function getFinancialScore(vazamentoPercentual) {
  if (!Number.isFinite(vazamentoPercentual)) return null;
  if (vazamentoPercentual >= 14) return 25;
  if (vazamentoPercentual >= 10) return 40;
  if (vazamentoPercentual >= 7) return 55;
  if (vazamentoPercentual >= 4) return 70;
  return 85;
}

function getOverallClassification(score) {
  if (score < 60) {
    return {
      nivel: "Zona de Risco",
      color: "bad",
      frase: "Sua operação tem vazamentos que provavelmente você não está vendo.",
    };
  }
  if (score <= 85) {
    return {
      nivel: "Em Desenvolvimento",
      color: "warn",
      frase: "Há potencial real de ganho sendo desperdiçado e os números apontam onde olhar.",
    };
  }
  return {
    nivel: "Alta Performance",
    color: "good",
    frase: "Operação acima da média, ainda com oportunidades escondidas para explorar.",
  };
}

function buildCompetitiveContext(lead, allRows) {
  const regionKey = normalizeKey(lead.regiao);
  const neighborhoodKey = normalizeKey(lead.neighborhood);
  const cuisineKey = normalizeCuisineKey(lead.cuisine);

  const normalizedRows = allRows.map(sanitizeLeadRow);
  const sameNeighborhood = normalizedRows.filter(
    (row) => normalizeKey(row.regiao) === regionKey && normalizeKey(row.neighborhood) === neighborhoodKey
  );
  const sameCuisineNeighborhood = sameNeighborhood.filter((row) => normalizeCuisineKey(row.cuisine) === cuisineKey);
  const sameCuisineRegion = normalizedRows.filter(
    (row) => normalizeKey(row.regiao) === regionKey && normalizeCuisineKey(row.cuisine) === cuisineKey
  );

  const sameRegion = normalizedRows.filter((row) => normalizeKey(row.regiao) === regionKey);
  const ratingMedioBairro = average(sameNeighborhood.map((row) => row.rating));
  const ratingMediaRegiao = average(sameRegion.map((row) => row.rating));
  const ratingMedioCuisine = average((sameCuisineRegion.length ? sameCuisineRegion : sameCuisineNeighborhood).map((row) => row.rating));
  const digitalBenchmark = median(sameCuisineRegion.map((row) => row.seguidores));
  const priceRangePredominante = mode(
    (sameCuisineNeighborhood.length ? sameCuisineNeighborhood : sameNeighborhood).map((row) => row.priceRange)
  );

  const rankPool = sameCuisineNeighborhood.length ? sameCuisineNeighborhood : sameNeighborhood;
  const sortedByRating = [...rankPool].sort((a, b) => {
    if (a.rating !== b.rating) return (b.rating ?? Number.NEGATIVE_INFINITY) - (a.rating ?? Number.NEGATIVE_INFINITY);
    const nameCompare = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    if (nameCompare !== 0) return nameCompare;
    return a.url.localeCompare(b.url, "pt-BR", { sensitivity: "base" });
  });

  const posicaoRating = sortedByRating.findIndex(
    (row) =>
      row.url === lead.url ||
      (row.name === lead.name && normalizeKey(row.neighborhood) === neighborhoodKey && normalizeKey(row.regiao) === regionKey)
  );

  return {
    totalRestaurantesBairro: sameNeighborhood.length,
    totalMesmoCuisineBairro: sameCuisineNeighborhood.length,
    totalRegiao: sameRegion.length,
    ratingMedioBairro,
    ratingMediaRegiao,
    ratingMedioCuisine,
    posicaoRatingBairro: posicaoRating >= 0 ? posicaoRating + 1 : null,
    priceRangePredominante,
    digitalBenchmark,
  };
}

function calculateFinancials(lead, cuisineKey) {
  const benchmark = getBenchmarkForCuisine(cuisineKey);
  if (!benchmark) {
    return {
      benchmark: null,
      faturamentoMin: null,
      faturamentoMax: null,
      gapCmv: null,
      vazamentoPercentual: null,
      oportunidadeMin: null,
      oportunidadeMax: null,
      oportunidadeAnualMin: null,
      oportunidadeAnualMax: null,
      score: null,
      warning: "Sem benchmark financeiro configurado para este segmento.",
    };
  }

  const range = benchmark.faturamento[lead.priceRange] || null;
  const gapCmv = benchmark.cmvMedio - benchmark.cmvIdeal;
  const vazamentoPercentual = gapCmv + 4;
  const score = getFinancialScore(vazamentoPercentual);

  if (!range) {
    return {
      benchmark,
      faturamentoMin: null,
      faturamentoMax: null,
      gapCmv,
      vazamentoPercentual,
      oportunidadeMin: null,
      oportunidadeMax: null,
      oportunidadeAnualMin: null,
      oportunidadeAnualMax: null,
      score,
      warning: "Sem faixa de faturamento configurada para o segmento e priceRange deste lead.",
    };
  }

  const [faturamentoMin, faturamentoMax] = range;
  const vazamentoDecimal = vazamentoPercentual / 100;
  const oportunidadeMin = faturamentoMin * vazamentoDecimal * 0.7;
  const oportunidadeMax = faturamentoMax * vazamentoDecimal;

  return {
    benchmark,
    faturamentoMin,
    faturamentoMax,
    gapCmv,
    vazamentoPercentual,
    oportunidadeMin,
    oportunidadeMax,
    oportunidadeAnualMin: oportunidadeMin * 12,
    oportunidadeAnualMax: oportunidadeMax * 12,
    score,
    warning: "",
  };
}

function calculateOverallScore(scores, hasFollowers) {
  const entries = Object.entries(OVERALL_WEIGHTS).filter(([key]) => Number.isFinite(scores[key]));
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) return 0;

  let score = entries.reduce((sum, [key, weight]) => sum + scores[key] * weight, 0) / totalWeight;
  if (!hasFollowers && score > 75) score = 75;
  return Math.round(score);
}

function buildReputationInsight(score, lead, context, benchmark) {
  if (score >= 80) {
    return `Nota excepcional no iFood. Você está acima da média do seu segmento${benchmark ? `, cuja referência forte costuma começar em ${formatRating(benchmark.ratingDestaque)}` : ""}.`;
  }
  if (score >= 55) {
    return `Sua nota está em um patamar competitivo, mas ainda no intervalo em que pequenos ganhos de experiência podem te destacar no bairro.`;
  }
  if (score >= 30) {
    return `A nota está abaixo do que costuma performar melhor no delivery. Isso tende a afetar conversão e recompra mais do que parece no dia a dia.`;
  }
  return `A reputação está em zona de alerta. Qualidade percebida e resposta a avaliações precisam virar prioridade para recuperar tração no iFood.`;
}

function buildDigitalInsight(score, followers, benchmarkFollowers, cuisineLabel, regionLabel) {
  if (score >= 70) {
    return `Sua presença digital já é forte. O próximo passo é transformar audiência em recorrência e não só em alcance.`;
  }
  if (score >= 40) {
    const benchmarkPart = Number.isFinite(benchmarkFollowers)
      ? ` O benchmark observado para ${cuisineLabel.toLowerCase()} em ${regionLabel} gira em torno de ${formatFollowers(Math.round(benchmarkFollowers))} seguidores.`
      : "";
    return `Você tem presença digital funcional, mas ainda distante dos perfis que puxam mais demanda orgânica.${benchmarkPart}`;
  }
  if (score >= 20) {
    return `A presença digital está abaixo do que normalmente sustenta crescimento previsível. Isso aumenta a dependência de iFood e localização.`;
  }
  return `A operação quase não aparece digitalmente. Para o dono, isso costuma significar aquisição cara e pouca base própria para reativação.`;
}

function buildCompetitiveInsight(score, density, position, neighborhood, cuisineLabel) {
  if (density === 1) {
    return `Você é praticamente referência isolada de ${cuisineLabel.toLowerCase()} em ${neighborhood}. Isso é uma vantagem rara, mas precisa ser protegida com fidelização.`;
  }
  if (score >= 70) {
    return `${neighborhood} tem competição, mas sua posição está acima da média. Em cenários assim, eficiência operacional costuma separar quem lucra de quem só gira caixa.`;
  }
  if (density > 4 && Number.isFinite(position) && position > 3) {
    return `O bairro está bem concorrido para ${cuisineLabel.toLowerCase()}, e hoje você não aparece entre os líderes do recorte observado. Gestão e diferenciação tendem a pesar mais que desconto.`;
  }
  return `O contexto competitivo é equilibrado, com espaço para subir posição sem precisar entrar em guerra de preço.`;
}

function buildFinanceInsight(financial) {
  if (!Number.isFinite(financial.vazamentoPercentual)) {
    return "Ainda não há benchmark suficiente para estimar a oportunidade financeira deste segmento com segurança.";
  }

  const recuperacaoMin = Math.round(financial.vazamentoPercentual * 0.7);
  const recuperacaoMax = Math.round(financial.vazamentoPercentual);
  return `Operações com perfil parecido costumam recuperar algo entre ${recuperacaoMin}% e ${recuperacaoMax}% do faturamento mensal quando atacam CMV, desperdício e conciliação de forma disciplinada.`;
}

function buildRecommendations(scores, lead, context, financial) {
  const recs = [];
  const opportunityRange = formatMoneyRange(financial.oportunidadeMin, financial.oportunidadeMax);
  const followerText = Number.isFinite(lead.seguidores) ? `${formatFollowers(lead.seguidores)} seguidores` : "sua base digital";

  if (Number.isFinite(scores.financeiro) && scores.financeiro < 50) {
    recs.push({
      priority: 100,
      title: "Mapear CMV real dos 10 pratos mais vendidos",
      description: opportunityRange
        ? `É o atalho mais direto para validar onde a margem pode estar escapando. O potencial observado neste perfil fica entre ${opportunityRange} por mês.`
        : "É o atalho mais direto para validar onde a margem pode estar escapando sem depender de suposição.",
    });
    recs.push({
      priority: 90,
      title: "Implantar DRE mensal com rotina de caixa",
      description: "Sem fechamento recorrente, o resultado aparece tarde demais. O objetivo é enxergar a margem antes do dinheiro sumir no operacional.",
    });
  } else if (Number.isFinite(scores.financeiro) && scores.financeiro < 60) {
    recs.push({
      priority: 80,
      title: "Revisar precificação e perdas invisíveis",
      description: "CMV acima do ideal, conciliação e desperdício costumam andar juntos. Pequenos ajustes aqui geralmente têm efeito rápido no caixa.",
    });
  }

  if (scores.reputacao < 60) {
    recs.push({
      priority: 75,
      title: "Padronizar operação para subir a nota no iFood",
      description: "Checklists de qualidade, tempo de preparo e resposta a avaliações tendem a melhorar percepção e volume de pedidos em paralelo.",
    });
  }

  if (scores.digital < 50) {
    recs.push({
      priority: 70,
      title: "Ativar fidelização via WhatsApp",
      description: `Hoje ${followerText} ainda não parecem totalmente monetizados. O foco é trazer recompra e frequência, não só alcance.`,
    });
  }

  if (scores.competitivo < 50) {
    recs.push({
      priority: 65,
      title: "Diferenciar pela experiência, não pelo preço",
      description: `Em ${lead.neighborhood || "um bairro competitivo"}, eficiência e padrão costumam pesar mais que promoções frequentes.`,
    });
  }

  if (scores.competitivo > 70) {
    recs.push({
      priority: 60,
      title: "Capitalizar a posição dominante no bairro",
      description: `O contexto competitivo de ${lead.neighborhood || "sua região"} abre espaço para consolidar recorrência antes de novos concorrentes ocuparem esse território.`,
    });
  }

  if (Number.isFinite(lead.seguidores) && lead.seguidores > 3000 && Number.isFinite(scores.financeiro) && scores.financeiro < 60) {
    recs.push({
      priority: 68,
      title: "Converter audiência em lucro previsível",
      description: "Marca com tração digital e margem mal controlada é o perfil clássico de operação que vende bem, mas captura pouco resultado no fim do mês.",
    });
  }

  return recs
    .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, 3);
}

function buildRedFlags(lead, context, financial, benchmark) {
  const flags = [];

  if (Number.isFinite(lead.rating) && Number.isFinite(context.ratingMedioBairro) && lead.rating < context.ratingMedioBairro) {
    flags.push({
      color: "bad",
      text: `Sua nota no iFood está abaixo da média observada no bairro (${formatRating(lead.rating)} vs ${formatRating(context.ratingMedioBairro)}).`,
    });
  }
  if (Number.isFinite(lead.rating) && lead.rating >= 4 && lead.priceRange === "$") {
    flags.push({
      color: "warn",
      text: "Nota alta com ticket enxuto pode indicar margem apertada. Volume sem controle nem sempre vira lucro.",
    });
  }
  if (!Number.isFinite(lead.seguidores) || lead.seguidores < 500) {
    flags.push({
      color: "bad",
      text: "Presença digital muito baixa. Isso aumenta a dependência de iFood e reduz a base própria para reativação.",
    });
  }
  if (context.totalMesmoCuisineBairro > 4) {
    flags.push({
      color: "warn",
      text: `${lead.neighborhood || "O bairro"} está saturado para ${benchmark?.label?.toLowerCase() || "o segmento"} no recorte observado.`,
    });
  }
  if (["japones", "italiana"].includes(normalizeCuisineKey(lead.cuisine)) && lead.priceRange === "$") {
    flags.push({
      color: "bad",
      text: `O posicionamento de preço parece abaixo do padrão que normalmente sustenta o CMV de ${benchmark?.label?.toLowerCase() || "segmentos premium"}.`,
    });
  }
  if (Number.isFinite(lead.seguidores) && lead.seguidores > 3000 && Number.isFinite(lead.rating) && lead.rating < 4) {
    flags.push({
      color: "bad",
      text: "Há audiência, mas a experiência percebida ainda não acompanha. Isso tende a gerar descoberta sem recompra.",
    });
  }
  if (Number.isFinite(lead.seguidores) && lead.seguidores > 3000 && !Number.isFinite(financial.oportunidadeMin)) {
    flags.push({
      color: "warn",
      text: "Sua marca digital já chama atenção, mas o potencial financeiro ainda não foi validado com um benchmark completo deste perfil.",
    });
  }
  if (context.totalMesmoCuisineBairro === 1) {
    flags.push({
      color: "warn",
      text: "Você tem uma vantagem competitiva rara no bairro, mas sem base recorrente isso pode ser fácil de perder quando surgir outro player.",
    });
  }

  if (flags.length < 2 && Number.isFinite(lead.seguidores) && getDigitalScore(lead.seguidores) < 30) {
    flags.push({
      color: "warn",
      text: "A presença digital ainda está abaixo do patamar que costuma sustentar crescimento previsível e recorrência fora do iFood.",
    });
  }
  if (flags.length < 2 && Number.isFinite(financial.score) && financial.score < 50) {
    flags.push({
      color: "bad",
      text: `O recorte financeiro sugere vazamento potencial de ${formatPercent(financial.vazamentoPercentual)} do faturamento antes mesmo de olhar os dados internos.`,
    });
  }
  if (flags.length < 3 && Number.isFinite(context.totalMesmoCuisineBairro) && context.totalMesmoCuisineBairro <= 2) {
    flags.push({
      color: "warn",
      text: "Mercados pouco concorridos parecem confortáveis, mas costumam esconder dependência excessiva de fluxo espontâneo.",
    });
  }

  return flags.slice(0, 3);
}

function buildRoadmap(financial) {
  const month1Min = Number.isFinite(financial.oportunidadeMin) ? financial.oportunidadeMin * 0.4 : null;
  const month1Max = Number.isFinite(financial.oportunidadeMax) ? financial.oportunidadeMax * 0.4 : null;
  const month2Min = Number.isFinite(financial.oportunidadeMin) ? financial.oportunidadeMin * 0.65 : null;
  const month2Max = Number.isFinite(financial.oportunidadeMax) ? financial.oportunidadeMax * 0.65 : null;
  const month3Min = Number.isFinite(financial.oportunidadeMin) ? financial.oportunidadeMin * 0.85 : null;
  const month3Max = Number.isFinite(financial.oportunidadeMax) ? financial.oportunidadeMax * 0.85 : null;

  return {
    month1: formatMoneyRange(month1Min, month1Max),
    month2: formatMoneyRange(month2Min, month2Max),
    month3: formatMoneyRange(month3Min, month3Max),
    total90: formatMoneyRange(
      Number.isFinite(month3Min) ? month3Min * 3 : null,
      Number.isFinite(month3Max) ? month3Max * 3 : null
    ),
  };
}

function buildProvocativeQuestion(lead, weakestPillar, financial, context) {
  if (weakestPillar === "financeiro") {
    return `Este Radar estimou um gap financeiro de ${formatPercent(financial.vazamentoPercentual)}. Qual é o seu número real hoje? Se a resposta for "não sei", esse já é o primeiro diagnóstico que vale fazer.`;
  }
  if (weakestPillar === "reputacao") {
    return `Sua nota ${formatRating(lead.rating)} está ${Number.isFinite(context.ratingMedioBairro) && lead.rating < context.ratingMedioBairro ? "abaixo" : "perto"} da média observada no bairro. Quando foi a última vez que uma avaliação ruim virou ação concreta na operação?`;
  }
  if (weakestPillar === "digital") {
    return `Você tem ${Number.isFinite(lead.seguidores) ? `${formatFollowers(lead.seguidores)} seguidores` : "uma base digital ainda pequena"} no Instagram. Quantas dessas pessoas voltaram a comprar no último mês?`;
  }
  return `Você está disputando espaço com ${context.totalMesmoCuisineBairro || "outros"} restaurantes do mesmo segmento no bairro. O que te diferencia deles além da comida?`;
}

function buildWhatsappMessages(lead, overallScore, financial) {
  const rapport = buildRapportLine(lead);
  const opportunityLine = "Tem uns comparativos ali com o bairro e o segmento que podem te chamar atenção.";

  const opening = [
    rapport,
    `Montei um Radar rápido da operação do ${lead.name} com dados públicos do iFood, Instagram e do bairro.`,
    `${opportunityLine} Quer que eu te mande?`,
  ].join("\n");

  const followUp = [
    `Conseguiu abrir o Radar do ${lead.name}?`,
    "Aquilo ali é baseado em dados públicos e comparativos do segmento.",
    `Se fizer sentido, eu te mostro como validar isso com os números reais da operação. Score atual do Radar ${overallScore}/100.`,
  ].join("\n");

  return { opening, followUp };
}

function buildRapportLine(lead) {
  const raw = normalizeRapport(lead.punch_line);
  if (!raw) return `Vi o perfil do ${lead.name} e achei o contexto de vocês bem interessante.`;

  const instructionMatch = raw.match(/^(elogie|mencione|cite|comente)\s+(.+)$/i);
  if (instructionMatch?.[2]) {
    const detail = sentenceCase(instructionMatch[2]).replace(/[.!\s]+$/, "");
    return `${detail} me chamou atenção.`;
  }

  if (/^entre em contato/i.test(raw)) {
    return `Vi o perfil do ${lead.name} e achei o contexto de vocês bem interessante.`;
  }

  const cleaned = sentenceCase(raw);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function buildProofSection(proofMetrics = null) {
  if (!proofMetrics || !Array.isArray(proofMetrics.items) || !proofMetrics.items.length) {
    return null;
  }

  const title = cleanText(proofMetrics.title) || "O que operações parecidas já destravaram";
  const items = proofMetrics.items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return {
    title,
    html: `
      <section class="card area-proof">
        <div class="card-title">📈 ${escapeHtml(title)}</div>
        <div class="muted">${escapeHtml(cleanText(proofMetrics.subtitle) || "Métricas verificadas da base NOLA configuradas para este Radar.")}</div>
        <ul class="bullet-list">${items}</ul>
      </section>
    `,
  };
}

function renderRadarHtml(payload) {
  const {
    lead,
    scores,
    overall,
    benchmark,
    context,
    financial,
    recommendations,
    redFlags,
    roadmap,
    question,
    warnings,
    proofSection,
    generatedAt,
    whatsappCtaUrl,
    ranking,
  } = payload;

  const scoreRing = `background: conic-gradient(var(--${overall.color}) ${overall.score * 3.6}deg, rgba(148,163,184,.16) 0deg);`;
  const showProof = Boolean(proofSection);
  const proofCardHtml = showProof ? proofSection.html : "";
  const warningsHtml = warnings.length
    ? `<div class="callout callout-muted">${warnings.map((warning) => escapeHtml(warning)).join("<br />")}</div>`
    : "";

  const redFlagsHtml = redFlags.length
    ? redFlags
        .map((flag) => `<div class="flag ${flag.color}">${escapeHtml(flag.text)}</div>`)
        .join("")
    : `<div class="flag warn">Nenhum alerta forte apareceu com os dados públicos atuais, mas ainda há espaço para validar margem e recorrência.</div>`;

  const recommendationsHtml = recommendations
    .map(
      (rec, index) => `
        <div class="recommendation">
          <div class="recommendation-index">${index + 1}</div>
          <div>
            <div class="recommendation-title">${escapeHtml(rec.title)}</div>
            <div class="muted">${escapeHtml(rec.description)}</div>
          </div>
        </div>
      `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Radar ${escapeHtml(lead.name)}</title>
  <style>
    :root {
      --bg: #0b0f14;
      --card: #111827;
      --muted: #94a3b8;
      --text: #e5e7eb;
      --line: rgba(148, 163, 184, .14);
      --accent: #22c55e;
      --warn: #f59e0b;
      --bad: #ef4444;
      --good: #22c55e;
      --chip: #0f172a;
      --shadow: 0 18px 45px rgba(0,0,0,.35);
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
    }
    .page {
      max-width: 1180px;
      margin: 0 auto;
    }
    .hero {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding: 24px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: linear-gradient(180deg, #111827, #020617);
      box-shadow: var(--shadow);
      margin-bottom: 20px;
      align-items: center;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      color: var(--accent);
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      font-size: 12px;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: rgba(34,197,94,.12);
      display: grid;
      place-items: center;
      border: 1px solid rgba(34,197,94,.25);
    }
    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.05;
    }
    .subtitle {
      color: var(--muted);
      margin-top: 10px;
      max-width: 720px;
      line-height: 1.5;
    }
    .hero-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .meta-pill, .chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      background: var(--chip);
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--text);
      font-size: 13px;
    }
    .badge {
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(34,197,94,.14);
      color: #bbf7d0;
      border: 1px solid rgba(34,197,94,.28);
      font-size: 13px;
      white-space: nowrap;
    }
    .layout {
      display: grid;
      gap: 18px;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr);
      grid-template-areas:
        "score reputation"
        "financial digital"
        "alerts competitive"
        "roadmap proof"
        "question recommendations"
        "cta recommendations";
    }
    .area-score { grid-area: score; }
    .area-reputation { grid-area: reputation; }
    .area-digital { grid-area: digital; }
    .area-competitive { grid-area: competitive; }
    .area-financial { grid-area: financial; }
    .area-alerts { grid-area: alerts; }
    .area-roadmap { grid-area: roadmap; }
    .area-proof { grid-area: proof; }
    .area-recommendations { grid-area: recommendations; }
    .area-question { grid-area: question; }
    .area-cta { grid-area: cta; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
      break-inside: avoid;
    }
    .card-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 14px;
      letter-spacing: .01em;
    }
    .muted {
      color: var(--muted);
      line-height: 1.5;
      font-size: 14px;
    }
    .score-card {
      display: grid;
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 22px;
      align-items: center;
    }
    .gauge {
      width: 190px;
      height: 190px;
      border-radius: 50%;
      position: relative;
      ${scoreRing}
      display: grid;
      place-items: center;
      margin: 0 auto;
    }
    .gauge::after {
      content: "";
      position: absolute;
      inset: 18px;
      border-radius: 50%;
      background: rgba(2, 6, 23, .95);
      border: 1px solid rgba(148, 163, 184, .12);
      box-shadow: inset 0 0 30px rgba(0,0,0,.4);
    }
    .gauge-inner {
      position: relative;
      z-index: 1;
      text-align: center;
    }
    .gauge-inner strong {
      display: block;
      font-size: 48px;
      line-height: 1;
      margin-bottom: 6px;
    }
    .score-level {
      display: inline-block;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--line);
      font-size: 12px;
      margin-bottom: 14px;
    }
    .score-text {
      font-size: 16px;
      line-height: 1.55;
      margin: 0 0 14px;
    }
    .chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .chip strong {
      font-size: 15px;
    }
    .bar-group {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 48px;
      gap: 10px;
      align-items: center;
      font-size: 13px;
      color: var(--muted);
    }
    .bar {
      height: 10px;
      border-radius: 999px;
      background: rgba(148,163,184,.14);
      overflow: hidden;
      margin-top: 6px;
    }
    .bar > span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(34,197,94,.55), rgba(34,197,94,1));
    }
    .highlight-box {
      padding: 18px;
      border-radius: 16px;
      border: 1px solid rgba(34,197,94,.18);
      background: linear-gradient(180deg, rgba(34,197,94,.12), rgba(34,197,94,.04));
      margin-bottom: 18px;
    }
    .highlight-box .eyebrow {
      color: #bbf7d0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .highlight-box .value {
      font-size: clamp(24px, 3vw, 34px);
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 6px;
    }
    .breakdown {
      display: grid;
      gap: 12px;
      margin-top: 14px;
    }
    .breakdown-item {
      padding-top: 12px;
      border-top: 1px solid rgba(148,163,184,.12);
    }
    .breakdown-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      margin-bottom: 4px;
    }
    .breakdown-value {
      font-size: 18px;
      font-weight: 700;
    }
    .flag {
      border-radius: 14px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      margin-top: 10px;
      line-height: 1.45;
    }
    .flag.bad {
      background: rgba(239,68,68,.1);
      border-color: rgba(239,68,68,.22);
    }
    .flag.warn {
      background: rgba(245,158,11,.08);
      border-color: rgba(245,158,11,.22);
    }
    .roadmap-step {
      padding: 16px 0;
      border-top: 1px solid rgba(148,163,184,.12);
    }
    .roadmap-step:first-of-type { border-top: 0; padding-top: 0; }
    .roadmap-title {
      font-weight: 700;
      margin-bottom: 6px;
    }
    .roadmap-gain {
      margin-top: 8px;
      color: #bbf7d0;
      font-size: 14px;
      font-weight: 600;
    }
    .bullet-list {
      margin: 14px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }
    .recommendation {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
      padding: 14px 0;
      border-top: 1px solid rgba(148,163,184,.12);
    }
    .recommendation:first-of-type { border-top: 0; padding-top: 0; }
    .recommendation-index {
      width: 36px;
      height: 36px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(34,197,94,.12);
      border: 1px solid rgba(34,197,94,.22);
      color: #bbf7d0;
      font-weight: 700;
    }
    .recommendation-title {
      font-weight: 700;
      margin-bottom: 4px;
    }
    .question-box {
      font-size: 20px;
      line-height: 1.55;
      font-weight: 600;
    }
    .cta-box {
      display: grid;
      gap: 16px;
    }
    .cta-button {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 52px;
      padding: 14px 20px;
      border-radius: 14px;
      text-decoration: none;
      color: #04120a;
      background: linear-gradient(90deg, #22c55e, #4ade80);
      font-weight: 800;
      box-shadow: 0 12px 30px rgba(34,197,94,.28);
    }
    .footer-note {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
    }
    .callout, .callout-muted {
      margin-top: 14px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(148,163,184,.18);
      font-size: 13px;
      line-height: 1.5;
    }
    .callout {
      background: rgba(245,158,11,.06);
    }
    .callout-muted {
      background: rgba(148,163,184,.06);
      color: var(--muted);
    }
    @media (max-width: 860px) {
      body { padding: 14px; }
      .hero { padding: 18px; flex-direction: column; align-items: flex-start; }
      .layout {
        grid-template-columns: 1fr;
        grid-template-areas:
          "score"
          "reputation"
          "digital"
          "competitive"
          "financial"
          "alerts"
          "roadmap"
          "proof"
          "recommendations"
          "question"
          "cta";
      }
      .score-card {
        grid-template-columns: 1fr;
      }
      .gauge {
        width: 170px;
        height: 170px;
      }
    }
    @page {
      size: A4;
      margin: 0;
    }
    @media print {
      html {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        margin: 0; padding: 0;
        width: 100vw;
        overflow-x: hidden;
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        margin: 0;
        padding: 12px;
        background: var(--bg) !important;
        font-size: 13px;
        width: 100vw;
        overflow-x: hidden;
      }
      .page { max-width: 100%; width: 100%; margin: 0; padding: 0; }

      .hero {
        flex-direction: column;
        align-items: flex-start;
        padding: 16px;
        margin-bottom: 14px;
        box-shadow: none;
      }
      h1 { font-size: 24px; }
      .subtitle { font-size: 13px; margin-top: 6px; }
      .hero-meta { gap: 6px; margin-top: 10px; }
      .meta-pill, .chip { font-size: 11px; padding: 6px 10px; }
      .badge { font-size: 11px; padding: 7px 12px; margin-top: 8px; }

      .layout {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .card {
        break-inside: avoid;
        break-before: auto;
        background: var(--card) !important;
        box-shadow: none;
        padding: 16px;
        border-radius: 12px;
        margin-top: 12px;
      }
      .card-title { font-size: 13px; margin-bottom: 10px; }

      .score-card {
        display: flex;
        align-items: center;
        gap: 20px;
      }
      .gauge {
        width: 150px; height: 150px;
        flex-shrink: 0;
      }
      .gauge::after { inset: 14px; }
      .gauge-inner strong { font-size: 38px; }
      .score-level { font-size: 11px; padding: 5px 10px; }
      .score-text { font-size: 13px; margin-bottom: 8px; }
      .chip-grid { gap: 6px; margin-top: 8px; }
      .chip strong { font-size: 13px; }

      .highlight-box { padding: 14px; margin-bottom: 12px; }
      .highlight-box .eyebrow { font-size: 11px; }
      .highlight-box .value { font-size: 22px; }
      .breakdown-value { font-size: 15px; }
      .breakdown-label { font-size: 11px; }

      .bar-row { font-size: 12px; }
      .bar { height: 8px; }

      .flag { padding: 10px 14px; font-size: 13px; margin-top: 8px; border-radius: 10px; }

      .roadmap-step { padding: 10px 0; }
      .roadmap-title { font-size: 14px; }
      .roadmap-gain { font-size: 12px; }
      .bullet-list { font-size: 12px; line-height: 1.5; }

      .recommendation { gap: 10px; padding: 10px 0; }
      .recommendation-index { width: 30px; height: 30px; font-size: 13px; }
      .recommendation-title { font-size: 13px; }

      .question-box { font-size: 16px; }

      .cta-box { gap: 10px; }
      .cta-button { min-height: 44px; padding: 10px 16px; font-size: 14px; border-radius: 10px; }
      .footer-note { font-size: 11px; }
      .callout, .callout-muted { font-size: 12px; padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="hero">
      <div>
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M7.5 12.5 10.4 15.4 16.8 9" stroke="#22c55e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          NOLA Radar
        </div>
        <h1>Radar ${escapeHtml(lead.name)}</h1>
        <div class="subtitle">Análise express da operação com base em dados públicos, contexto competitivo local e benchmarks configurados para o segmento.</div>
        <div class="hero-meta">
          <span class="meta-pill">📍 ${escapeHtml(lead.neighborhoodDisplay || lead.neighborhood || "Bairro não informado")}${lead.regiao ? `, ${escapeHtml(lead.regiaoDisplay || lead.regiao)}` : ""}</span>
          <span class="meta-pill">🍽️ ${escapeHtml(benchmark?.label || lead.cuisine || "Segmento não identificado")}</span>
          <span class="meta-pill">💲 ${escapeHtml(lead.priceRange || "Sem faixa")}</span>
          ${ranking ? `<span class="meta-pill">🏆 #${ranking.posicaoRegional} de ${ranking.totalRegiao} na região</span>` : ""}
          <span class="meta-pill">🗓️ ${escapeHtml(generatedAt)}</span>
        </div>
      </div>
      <div class="badge">Confidencial • Análise express</div>
    </header>

    <main class="layout">
      <section class="card area-score">
        <div class="card-title">Nola Score geral</div>
        <div class="score-card">
          <div class="gauge">
            <div class="gauge-inner">
              <strong>${overall.score}</strong>
              <span class="muted">de 100</span>
            </div>
          </div>
          <div>
            <div class="score-level">${escapeHtml(overall.nivel)}</div>
            <p class="score-text">${escapeHtml(overall.frase)}</p>
            <div class="chip-grid">
              <div class="chip">⭐ Reputação <strong>${scores.reputacao}</strong></div>
              <div class="chip">📱 Digital <strong>${scores.digital}</strong></div>
              <div class="chip">🏘️ Competitivo <strong>${scores.competitivo}</strong></div>
              <div class="chip">💰 Financeiro <strong>${Number.isFinite(scores.financeiro) ? scores.financeiro : "—"}</strong></div>
              ${ranking ? `<div class="chip">🏆 Posição <strong>#${ranking.posicaoRegional}/${ranking.totalRegiao}</strong></div>` : ""}
            </div>
            ${warningsHtml}
          </div>
        </div>
      </section>

      <section class="card area-reputation">
        <div class="card-title">⭐ Reputação digital</div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="breakdown-label">Sua nota no iFood</div>
            <div class="breakdown-value">${formatRating(lead.rating)} ⭐</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">Média do segmento</div>
            <div class="breakdown-value">${Number.isFinite(context.ratingMedioCuisine) ? formatRating(context.ratingMedioCuisine) : benchmark ? formatRating(benchmark.ratingIcp) : "sem base"}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">Média da região</div>
            <div class="breakdown-value">${Number.isFinite(context.ratingMediaRegiao) ? formatRating(context.ratingMediaRegiao) : "sem base"}</div>
          </div>
        </div>
        <div class="bar-group">
          <div class="bar-row">
            <div>Sua nota<div class="bar"><span style="width:${Math.max(0, Math.min((lead.rating || 0) * 20, 100))}%"></span></div></div>
            <strong>${formatRating(lead.rating)}</strong>
          </div>
          <div class="bar-row">
            <div>Média região<div class="bar"><span style="width:${Math.max(0, Math.min((context.ratingMediaRegiao || 0) * 20, 100))}%"></span></div></div>
            <strong>${Number.isFinite(context.ratingMediaRegiao) ? formatRating(context.ratingMediaRegiao) : "—"}</strong>
          </div>
        </div>
        <div class="callout">${escapeHtml(payload.insights.reputacao)}</div>
      </section>

      <section class="card area-digital">
        <div class="card-title">📱 Presença digital</div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="breakdown-label">Seguidores</div>
            <div class="breakdown-value">${Number.isFinite(lead.seguidores) ? formatFollowers(lead.seguidores) : "sem dados"}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">Classificação</div>
            <div class="breakdown-value">${escapeHtml(getDigitalLevel(scores.digital))}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">Benchmark observado na região</div>
            <div class="breakdown-value">${Number.isFinite(context.digitalBenchmark) ? formatFollowers(Math.round(context.digitalBenchmark)) : "sem base"}</div>
          </div>
        </div>
        <div class="callout">${escapeHtml(payload.insights.digital)}</div>
      </section>

      <section class="card area-competitive">
        <div class="card-title">🏘️ Posicionamento competitivo</div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="breakdown-label">Total de restaurantes na região</div>
            <div class="breakdown-value">${ranking ? formatInteger(ranking.totalRegiao) : formatInteger(context.totalRestaurantesBairro || 0)}</div>
          </div>
          <div class="breakdown-item">
          <div class="breakdown-label">Sua posição por rating na região</div>
            <div class="breakdown-value">${ranking ? `${ranking.posicaoRegional} de ${ranking.totalRegiao}` : (Number.isFinite(context.posicaoRatingBairro) ? `${context.posicaoRatingBairro} de ${Math.max(context.totalMesmoCuisineBairro, context.totalRestaurantesBairro, 1)}` : "sem base")}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">Faixa predominante no bairro</div>
            <div class="breakdown-value">${escapeHtml(context.priceRangePredominante || "sem base")}</div>
          </div>
        </div>
        <div class="callout">${escapeHtml(payload.insights.competitivo)}</div>
      </section>

      <section class="card area-financial">
        <div class="card-title">💰 Estimativa de oportunidade financeira</div>
        <div class="highlight-box">
          <div class="eyebrow">Margem que pode estar escapando</div>
          <div class="value">${financial.oportunidadeMin && financial.oportunidadeMax ? formatMoneyRange(financial.oportunidadeMin, financial.oportunidadeMax) : "Estimativa indisponível"}</div>
          <div class="muted">${financial.oportunidadeAnualMin && financial.oportunidadeAnualMax ? `Equivalente a ${formatMoneyRange(financial.oportunidadeAnualMin, financial.oportunidadeAnualMax)} por ano.` : "Sem faixa de faturamento validada para este price range."}</div>
        </div>
        <div class="breakdown">
          <div class="breakdown-item">
            <div class="breakdown-label">Faturamento estimado do perfil</div>
            <div class="breakdown-value">${formatMoneyRange(financial.faturamentoMin, financial.faturamentoMax) || "sem base"}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">CMV típico sem controle</div>
            <div class="breakdown-value">${benchmark ? `${formatPercent(benchmark.cmvMedio)} (ideal ${formatPercent(benchmark.cmvIdeal)})` : "sem benchmark"}</div>
          </div>
          <div class="breakdown-item">
            <div class="breakdown-label">Gap estimado</div>
            <div class="breakdown-value">${formatPercent(financial.gapCmv)} ${Number.isFinite(financial.gapCmv) ? "de CMV + 4% de vazamentos comuns" : ""}</div>
          </div>
        </div>
        <div class="callout">${escapeHtml(payload.insights.financeiro)}</div>
      </section>

      <section class="card area-alerts">
        <div class="card-title">⚠️ Alertas detectados</div>
        ${redFlagsHtml}
      </section>

      <section class="card area-roadmap">
        <div class="card-title">📅 Caminho de 90 dias</div>
        <div class="roadmap-step">
          <div class="roadmap-title">Mês 1 • Diagnóstico e controle básico</div>
          <div class="muted">Mapear CMV real dos pratos mais vendidos, fechar caixa com rotina e localizar perdas invisíveis.</div>
          <div class="roadmap-gain">${roadmap.month1 || "Ganho potencial será refinado com dados internos."}</div>
        </div>
        <div class="roadmap-step">
          <div class="roadmap-title">Mês 2 • Otimização e padronização</div>
          <div class="muted">Reprecificar itens críticos, ajustar desperdício e transformar padrão operacional em rotina.</div>
          <div class="roadmap-gain">${roadmap.month2 || "Ganho acumulado depende da profundidade do diagnóstico."}</div>
        </div>
        <div class="roadmap-step">
          <div class="roadmap-title">Mês 3 • Crescimento e recorrência</div>
          <div class="muted">Ativar fidelização, CRM e reativação da base para crescer com margem mais previsível.</div>
          <div class="roadmap-gain">${roadmap.month3 || "A base financeira consolidada abre espaço para crescimento mais saudável."}</div>
        </div>
        <div class="callout callout-muted">Resultado projetado em 90 dias • ${roadmap.total90 || "faixa será calculada quando houver benchmark completo"}</div>
      </section>

      ${proofCardHtml}

      <section class="card area-recommendations">
        <div class="card-title">🎯 Top 3 ações recomendadas</div>
        ${recommendationsHtml}
      </section>

      <section class="card area-question">
        <div class="card-title">💬 Pergunta que fica no ar</div>
        <div class="question-box">${escapeHtml(question)}</div>
      </section>

      <section class="card area-cta">
        <div class="card-title">📋 Próximo passo</div>
        <div class="cta-box">
          <div class="muted">Este Radar usa dados públicos e benchmarks do setor. Seus números reais podem ser melhores ou piores. Só um diagnóstico com dados internos valida a fotografia completa.</div>
          <a class="cta-button" href="${escapeHtml(whatsappCtaUrl)}">Quero validar meus números reais</a>
          <div class="footer-note">Powered by NOLA • Sua paixão é cozinhar. Nossa missão é aumentar seu lucro.</div>
        </div>
      </section>
    </main>
  </div>
</body>
</html>`;
}

function resolveWeakestPillar(scores) {
  return Object.entries(scores)
    .filter(([, value]) => Number.isFinite(value))
    .sort((a, b) => a[1] - b[1])[0]?.[0] || "financeiro";
}

function buildWhatsappCtaUrl(leadName, score) {
  const text = `Oi! Vi o Radar do ${leadName} e quero validar os números reais. Score atual ${score}/100.`;
  return `https://api.whatsapp.com/send?phone=5521973548373&text=${encodeURIComponent(text)}`;
}

function generateRestaurantRadar({ lead: rawLead, allRows = [], proofMetrics = null, generatedAt = new Date(), ranking = null }) {
  const lead = sanitizeLeadRow(rawLead);
  const cuisineKey = normalizeCuisineKey(lead.cuisine);
  const benchmark = getBenchmarkForCuisine(cuisineKey);
  const context = buildCompetitiveContext(lead, allRows.length ? allRows : [lead]);
  const financial = calculateFinancials(lead, cuisineKey);

  const scores = {
    reputacao: getReputationScore(lead.rating),
    digital: getDigitalScore(lead.seguidores),
    competitivo: getCompetitiveScore(
      context.totalMesmoCuisineBairro || 0,
      context.posicaoRatingBairro,
      lead.priceRange,
      context.priceRangePredominante
    ),
    financeiro: financial.score,
  };

  const overallScore = calculateOverallScore(scores, Number.isFinite(lead.seguidores));
  const overallMeta = getOverallClassification(overallScore);
  const overall = { ...overallMeta, score: overallScore };
  const weakestPillar = resolveWeakestPillar(scores);
  const warnings = [financial.warning].filter(Boolean);

  const insights = {
    reputacao: buildReputationInsight(scores.reputacao, lead, context, benchmark),
    digital: buildDigitalInsight(scores.digital, lead.seguidores, context.digitalBenchmark, benchmark?.label || lead.cuisine || "segmento", lead.regiao || "sua região"),
    competitivo: buildCompetitiveInsight(scores.competitivo, context.totalMesmoCuisineBairro || 0, context.posicaoRatingBairro, lead.neighborhood || "o bairro", benchmark?.label || lead.cuisine || "o segmento"),
    financeiro: buildFinanceInsight(financial),
  };

  const recommendations = buildRecommendations(scores, lead, context, financial);
  const redFlags = buildRedFlags(lead, context, financial, benchmark);
  const roadmap = buildRoadmap(financial);
  const question = buildProvocativeQuestion(lead, weakestPillar, financial, context);
  const messages = buildWhatsappMessages(lead, overallScore, financial);
  const proofSection = buildProofSection(proofMetrics);
  const generatedAtLabel = generatedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const whatsappCtaUrl = buildWhatsappCtaUrl(lead.name, overallScore);

  const html = renderRadarHtml({
    lead,
    scores,
    overall,
    benchmark,
    context,
    financial,
    recommendations,
    redFlags,
    roadmap,
    question,
    insights,
    warnings,
    proofSection,
    generatedAt: generatedAtLabel,
    whatsappCtaUrl,
    ranking,
  });

  return {
    slug: slugify(lead.name),
    lead,
    context,
    benchmark,
    scores: {
      ...scores,
      geral: overallScore,
      nivel: overall.nivel,
    },
    financial,
    recommendations,
    redFlags,
    roadmap,
    question,
    warnings,
    messages,
    hubspotData: {
      radar_score_geral: overallScore,
      radar_score_reputacao: scores.reputacao,
      radar_score_digital: scores.digital,
      radar_score_competitivo: scores.competitivo,
      radar_score_financeiro: scores.financeiro,
      radar_nivel: overall.nivel,
      radar_oportunidade_mensal_min: financial.oportunidadeMin,
      radar_oportunidade_mensal_max: financial.oportunidadeMax,
      radar_oportunidade_anual_min: financial.oportunidadeAnualMin,
      radar_oportunidade_anual_max: financial.oportunidadeAnualMax,
      radar_bairro: lead.neighborhoodDisplay || lead.neighborhood,
      radar_regiao: lead.regiaoDisplay || lead.regiao,
      radar_cuisine: benchmark?.label || lead.cuisine,
      radar_price_range: lead.priceRange,
    },
    html,
  };
}

export {
  generateRestaurantRadar,
  normalizeCuisineKey,
  normalizePriceRange,
  parseFollowers,
  sanitizeLeadRow,
  slugify,
};
