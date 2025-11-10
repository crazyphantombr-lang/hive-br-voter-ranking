import fetch from "node-fetch";
import fs from "fs";

const ACCOUNT = "hive-br.voter";
const API = `https://rpc.mahdiyari.info/hafsql/delegations/${ACCOUNT}/incoming?limit=300`;

async function run() {
  try {
    const res = await fetch(API);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log("⚠️ Nenhum dado retornado da API.");
      return;
    }

    // Converte para o formato que usamos no ranking
    const delegators = data.map(item => ({
      delegator: item.delegator,
      hp: parseFloat(item.hp_equivalent)
    })).sort((a, b) => b.hp - a.hp);

    fs.writeFileSync("data/current.json", JSON.stringify(delegators, null, 2));
    console.log("✅ current.json atualizado com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao buscar delegações:", err.message);
  }
}

run();
