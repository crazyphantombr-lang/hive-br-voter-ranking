const fs = require("fs");
const fetch = require("node-fetch");

const TARGET = "hive-br.voter";

async function getDelegations() {
  const query = `
    select delegator, vesting_shares 
    from hive_vesting_delegations 
    where delegatee = '${TARGET}';
  `;

  const url = "https://db.ausbit.dev/query?q=" + encodeURIComponent(query);

  const res = await fetch(url);
  const json = await res.json();

  // VESTS → HP converter
  // HP = VESTS / 1e6 * Hive_Vesting_Share_Ratio
  // Pegaremos o ratio automaticamente
  const global = await fetch("https://api.hive.blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "condenser_api.get_dynamic_global_properties",
      params: [],
      id: 1
    })
  }).then(r => r.json());

  const gp = global.result;
  const totalVestingFund = parseFloat(gp.total_vesting_fund_hive.split(" ")[0]);
  const totalVestingShares = parseFloat(gp.total_vesting_shares.split(" ")[0]);
  const vestToHp = totalVestingFund / totalVestingShares;

  const formatted = json.map(row => ({
    delegator: row.delegator,
    hp: parseFloat(row.vesting_shares) * vestToHp
  })).sort((a, b) => b.hp - a.hp);

  return formatted;
}

async function run() {
  try {
    const delegs = await getDelegations();
    fs.writeFileSync("data/current.json", JSON.stringify(delegs, null, 2));
    console.log("✅ current.json atualizado com sucesso!");
  } catch (err) {
    console.error("❌ Erro:", err.message);
    fs.writeFileSync("data/current.json", "[]");
  }
}

run();
