const fs = require("fs");
const dhive = require("@hiveio/dhive");

// Lista de RPCs confiáveis — qualquer um aqui funciona com database_api
const RPCNODES = [
  "https://api.hive.blog",
  "https://api.openhive.network",
  "https://anyx.io",
  "https://hive.roelandp.nl"
];

const client = new dhive.Client(RPCNODES);

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

async function getDelegations(delegatee) {
  const result = await client.call("database_api", "list_vesting_delegations", {
    start: [delegatee, ""],
    limit: 1000,
    order: "by_delegatee"
  });

  return result.delegations || [];
}

async function run() {
  try {
    const rawDelegs = await getDelegations("hive-br.voter");
    const list = [];

    for (const d of rawDelegs) {
      const hp = await vestToHP(parseFloat(d.vesting_shares));
      list.push({
        delegator: d.delegator,
        hp: Number(hp.toFixed(3))
      });
    }

    list.sort((a, b) => b.hp - a.hp);
    fs.writeFileSync("data/current.json", JSON.stringify(list, null, 2));

    console.log("✅ current.json atualizado COM SUCESSO.");
  } catch (err) {
    console.error("❌ Erro:", err.message);
    fs.writeFileSync("data/current.json", "[]");
  }
}

run();
