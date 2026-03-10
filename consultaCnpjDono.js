/**
 * Consulta CNPJ na BrasilAPI e retorna dados da empresa e dos sócios (donos).
 * API: https://brasilapi.com.br/docs#tag/CNPJ
 *
 * Uso: node consultaCnpjDono.js <CNPJ>
 * Ex.: node consultaCnpjDono.js 19131243000197
 *      node consultaCnpjDono.js 19.131.243/0001-97
 */

const CNPJ_SOMENTE_NUMEROS = /^\d{14}$/;
const LIMPAR_CNPJ = (str) => String(str).replace(/\D/g, "");

async function consultarCnpj(cnpj) {
  const apenasNumeros = LIMPAR_CNPJ(cnpj);
  if (!CNPJ_SOMENTE_NUMEROS.test(apenasNumeros)) {
    throw new Error("CNPJ deve ter 14 dígitos (com ou sem formatação).");
  }

  const url = `https://brasilapi.com.br/cnpj/v1/${apenasNumeros}`;
  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error("CNPJ não encontrado.");
  }
  if (res.status === 400) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "CNPJ inválido ou mal formatado.");
  }
  if (!res.ok) {
    throw new Error(`Erro na API: ${res.status}`);
  }

  return res.json();
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
