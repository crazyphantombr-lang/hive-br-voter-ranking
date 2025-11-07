const dhive = require("@hiveio/dhive");
const fs = require("fs");

const client = new dhive.Client("https://api.hive.blog");

// Converte VESTS → HP
async function getGlobalProps() {
  const props = await client.call("database_api", "get_dynamic_global_properties", {});
  return {
    totalVestingFundHive: parseFloat(props.total_vesting_fund_hive),
    totalVestingShares: parseFloat(props.total_vesting_shares),
  };
}

async function vestToHP(vest) {
  const globals = await getGlobalProps();
  return vest * (globals.totalVestingFundHive / globals.totalVestingShares);
}

async function run() {
  // Aqui está a API CERTA: lista delegadores que delegam PARA você
  const account = await client.call("bridge", "get_account", { account: "hive-br.voter" });

  if (!account.delegations_in) {
    console.log("⚠️ Nenhuma delegação encontrada.");
    fs.writeFileSync("data/current.json", "[]");
    return;
  }

  const list = [];

  for (const d of account.delegations_in) {
    const hp = await vestToHP(parseFloat(d.vesting_shares));
    list.push({ delegator: d.delegator, hp });
  }

  // Ordena do maior para o menor
  list.sort((a, b) => b.hp - a.hp);

  fs.writeFileSync("data/current.json", JSON.stringify(list, null, 2));
  console.log("✅ current.json atualizado com sucesso.");
}

run();
