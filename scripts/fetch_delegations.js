const dhive = require("@hiveio/dhive");
const fs = require("fs");

// Lista de RPCs da blockchain Hive (com suporte a bridge)
const HIVE_NODES = [
  "https://api.deathwing.me",
  "https://api.c0ff33a.uk",
  "https://anyx.io",
  "https://api.openhive.network",
  "https://hive.roelandp.nl",
  "https://api.hive.blog"
];

// Cliente com failover automático
const client = new dhive.Client(HIVE_NODES, { timeout: 4000 });

// Converte VESTS → HP
async function getGlobalProps() {
  const props = await client.call("database_api", "get_dynamic_global_properties", {});
  const totalVestingFundHive = parseFloat(props.total_vesting_fund_hive);
  const totalVestingShares = parseFloat(props.total_vesting_shares);
  return { totalVestingFundHive, totalVestingShares };
}

async function vestToHP(vest) {
  const { totalVestingFundHive, totalVestingShares } = await getGlobalProps();
  return vest * (totalVestingFundHive / totalVestingShares);
}

// Busca delegadores que DELEGAM para essa conta (igual PeakD)
async function getDelegators(delegatee) {
  const account = await client.call("bridge", "get_account", { account: delegatee });

  if (!account || !account.delegations_in) {
    return [];
  }

  const list = [];

  for (const d of account.delegations_in) {
    const hp = await vestToHP(parseFloat(d.vesting_shares));
    list.push({ delegator: d.delegator, hp });
  }

  return list.sort((a, b) => b.hp - a.hp);
}

// Função principal
async function run() {
  try {
    const data = await getDelegators("hive-br.voter");
    fs.writeFileSync("data/current.json", JSON.stringify(data, null, 2));
    console.log("✅ current.json atualizado com sucesso.");
  } catch (e) {
    console.error("❌ Erro ao coletar delegações:", e.message);
    fs.writeFileSync("data/current.json", "[]");
    console.log("⚠️ Salvando lista vazia para evitar erro no site.");
  }
}

run();
