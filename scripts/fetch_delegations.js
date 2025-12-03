/**
 * Script: Fetch Delegations
 * Version: 1.3.0
 * Update: Gera arquivo meta.json com data da atualização
 */

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const ACCOUNT = "hive-br.voter";
const API = `https://rpc.mahdiyari.info/hafsql/delegations/${ACCOUNT}/incoming?limit=300`;
const DATA_DIR = "data";

// Garante que a pasta existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function run() {
  try {
    console.log(`🔄 Buscando dados para @${ACCOUNT}...`);
    const res = await fetch(API);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log("⚠️ Nenhum dado retornado da API.");
      return;
    }

    // Processamento dos dados
    const delegators = data
      .map(item => ({
        delegator: item.delegator,
        hp: parseFloat(item.hp_equivalent)
      }))
      .sort((a, b) => b.hp - a.hp);

    // Salva a lista principal
    fs.writeFileSync(path.join(DATA_DIR, "current.json"), JSON.stringify(delegators, null, 2));
    
    // Salva Metadados (Data da atualização)
    const metaData = {
      last_updated: new Date().toISOString(),
      total_delegators: delegators.length,
      total_hp: delegators.reduce((acc, curr) => acc + curr.hp, 0)
    };
    fs.writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(metaData, null, 2));

    console.log("✅ current.json e meta.json atualizados com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao buscar delegações:", err.message);
    process.exit(1);
  }
}

run();
