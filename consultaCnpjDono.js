/**
 * Consulta CNPJ e retorna dados da empresa e dos sócios (donos).
 * Ordem: 1) OpenCNPJ (https://api.opencnpj.org/{CNPJ}); 2) se não encontrar, BrasilAPI.
 *
 * Uso: node consultaCnpjDono.js <CNPJ>
 * Ex.: node consultaCnpjDono.js 19131243000197
 *      node consultaCnpjDono.js 19.131.243/0001-97
 */

const CNPJ_SOMENTE_NUMEROS = /^\d{14}$/;
const LIMPAR_CNPJ = (str) => String(str).replace(/\D/g, "");

const OPENCNPJ_URL = "https://api.opencnpj.org";
const BRASILAPI_URL = "https://brasilapi.com.br/api/cnpj/v1";

/** Tenta OpenCNPJ primeiro. Retorna dados brutos ou null se não encontrar/erro. */
async function consultarOpenCNPJ(cnpj) {
  const url = `${OPENCNPJ_URL}/${cnpj}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404 || !res.ok) return null;
  return res.json().catch(() => null);
}

/** Normaliza resposta da OpenCNPJ para o mesmo formato que formatarResposta espera (shape BrasilAPI). */
function normalizarOpenCNPJ(dados) {
  if (!dados || !dados.cnpj) return null;
  const tel = Array.isArray(dados.telefones) && dados.telefones.length > 0
    ? dados.telefones.find((t) => !t.is_fax) || dados.telefones[0]
    : null;
  const dddTelefone1 = tel ? `${(tel.ddd || "").replace(/\D/g, "")}${(tel.numero || "").replace(/\D/g, "")}` : "";
  const qsa = (dados.QSA || []).map((s) => ({
    nome_socio: s.nome_socio,
    qualificacao_socio: s.qualificacao_socio,
    data_entrada_sociedade: s.data_entrada_sociedade,
    identificador_de_socio: String(s.identificador_socio || "").toLowerCase().includes("física") ? 2 : 1,
  }));
  return {
    cnpj: dados.cnpj,
    razao_social: dados.razao_social || "",
    nome_fantasia: dados.nome_fantasia || "",
    descricao_situacao_cadastral: dados.situacao_cadastral || "",
    logradouro: dados.logradouro || "",
    numero: dados.numero || "",
    bairro: dados.bairro || "",
    municipio: dados.municipio || "",
    uf: dados.uf || "",
    cep: dados.cep || "",
    ddd_telefone_1: dddTelefone1 || null,
    email: dados.email || null,
    capital_social: dados.capital_social,
    porte: dados.porte_empresa || dados.porte || "",
    qsa,
  };
}

/** Tenta BrasilAPI. Retorna dados brutos ou lança. */
async function consultarBrasilAPI(cnpj) {
  const url = `${BRASILAPI_URL}/${cnpj}`;
  const res = await fetch(url);
  if (res.status === 404) throw new Error("CNPJ não encontrado.");
  if (res.status === 400) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "CNPJ inválido ou mal formatado.");
  }
  if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
  return res.json();
}

/**
 * Consulta CNPJ: primeiro OpenCNPJ, se não encontrar nada tenta BrasilAPI.
 * Retorna dados no formato esperado por formatarResposta.
 */
async function consultarCnpj(cnpj) {
  const apenasNumeros = LIMPAR_CNPJ(cnpj);
  if (!CNPJ_SOMENTE_NUMEROS.test(apenasNumeros)) {
    throw new Error("CNPJ deve ter 14 dígitos (com ou sem formatação).");
  }

  const open = await consultarOpenCNPJ(apenasNumeros);
  if (open && open.cnpj) {
    const normalizado = normalizarOpenCNPJ(open);
    if (normalizado) return normalizado;
  }

  return consultarBrasilAPI(apenasNumeros);
}

function formatarResposta(dados) {
  const empresa = {
    cnpj: dados.cnpj,
    razao_social: dados.razao_social,
    nome_fantasia: dados.nome_fantasia,
    situacao: dados.descricao_situacao_cadastral,
    logradouro: dados.logradouro,
    numero: dados.numero,
    bairro: dados.bairro,
    municipio: dados.municipio,
    uf: dados.uf,
    cep: dados.cep,
    telefone: dados.ddd_telefone_1 ? `(${dados.ddd_telefone_1?.slice(0, 2)}) ${dados.ddd_telefone_1?.slice(2)}` : null,
    email: dados.email,
    capital_social: dados.capital_social,
    porte: dados.porte,
  };

  const donos = (dados.qsa || []).map((s) => ({
    nome: s.nome_socio,
    qualificacao: s.qualificacao_socio,
    data_entrada: s.data_entrada_sociedade,
    tipo: s.identificador_de_socio === 2 ? "Pessoa Física" : "Pessoa Jurídica",
  }));

  return { empresa, donos };
}

async function main() {
  const cnpjArg = process.argv[2];
  if (!cnpjArg) {
    console.log("Uso: node consultaCnpjDono.js <CNPJ>");
    console.log("Ex.: node consultaCnpjDono.js 19131243000197");
    process.exit(1);
  }

  try {
    const dados = await consultarCnpj(cnpjArg);
    const { empresa, donos } = formatarResposta(dados);

    console.log("--- Empresa ---");
    console.log(JSON.stringify(empresa, null, 2));
    console.log("\n--- Sócios / Donos (QSA) ---");
    console.log(JSON.stringify(donos, null, 2));

    return { empresa, donos };
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();

export { consultarCnpj, formatarResposta };
