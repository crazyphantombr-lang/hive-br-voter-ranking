const dhive = require("@hiveio/dhive");
const fs = require("fs");

// Lista de RPCs para Hive Blockchain (com bridge)
const HIVE_NODES = [
  "https://api.deathwing.me",
  "https://api.c0ff33a.uk",
  "https://anyx.io",
  "https://api.openhive.network",
  "https://hive.roelandp.nl",
  "https://api.hive.blog"
];

// Lista reservada para Hive-Engine (para futuro uso)
const ENGINE_NODES = [
  "https://api.primersion.com",
  "https://api.hive-engine.com/rpc",
  "https://api2.hive-engine.com/rpc",
  "https://herpc.dtoools.dev",
  "https://enginerpc.com",
  "https://herpc.kanibot.com",
  "https://herpc.actifit.io"
];

// Cliente com failover automático
const client = new dhive.Client(HIVE_NODES, { timeout: 4000 });

// Conversão VESTS → HP
async function getGlobalProps() {
  const props = await client.call("database_api", "get_dynamic_global_properties", {});
  return {
    totalVestingFundHive: parseFloat(props.total_vesting_fund_hive),
    totalVestingShares: parseFloat(props.total_vesting_shares)
  };
}

async function vestToHP(vest) {
  const g = await getGlobalProps();
  return vest * (g.totalVestingFundHive / g.totalVestingShares);
}

// BUSCA DELEGADORES EXATAMENTE COMO PEAKD / HIVETASKS
async function getDelegators(delegatee) {
  const acc = await client.call("bridge", "get_account", { account: delegatee });

  if (!acc.delegations_in) return [];

  const list = [];

  for (const d of acc.delegations_in) {
    const hp = await vestToHP(parseFloat(d.vesting_shares));
    list.push({ delegator: d.delegator, hp });
  }

  return list.sort((a, b) => b.hp - a.hp);
}

async function run() {
  try {
    const data = await getDelegators("hive-br.voter");
    fs.writeFileSync("data/current.json", JSON.stringify(data, null, 2));
    console.log("✅ current.json atualizado com sucesso.");
  } catch (e) {
    console.error("❌ Erro ao coletar delegações:", e.message);
    fs.writeFileSy
