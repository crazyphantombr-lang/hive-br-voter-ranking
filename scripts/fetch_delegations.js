import { Client } from "https://cdn.jsdelivr.net/npm/@hiveio/dhive/dist/dhive.esm.js";

const client = new Client("https://api.hive.blog");

// Busca todas as delegações feitas para @hive-br.voter
async function getDelegators(delegatee) {
  const delegations = await client.call("database_api", "list_vesting_delegations", {
    start: [delegatee, ""],
    limit: 1000, // busca até 1000 delegações
  });
  return delegations.vesting_delegations;
}

// Pega dados globais da blockchain para converter VESTS -> HP
async function getGlobalProps() {
  const props = await client.call("database_api", "get_dynamic_global_properties", {});
  return {
    totalVestingFundHive: parseFloat(props.total_vesting_fund_hive),
    totalVestingShares: parseFloat(props.total_vesting_shares),
  };
}

// Função de conversão para HP
async function vestToHP(vest) {
  const globals = await getGlobalProps();
  return vest * (globals.totalVestingFundHive / globals.totalVestingShares);
}

// Função principal: retorna ranking ordenado
export async function fetchDelegationData() {
  const delegations = await getDelegators("hive-br.voter");
  const data = [];

  for (const d of delegations) {
    const hp = await vestToHP(parseFloat(d.vesting_shares));
    data.push({ delegator: d.delegator, hp });
  }

  // Ordena por maior HP delegado
  data.sort((a, b) => b.hp - a.hp);

  return data;
}

// Permite testar manualmente rodando no console (opcional)
fetchDelegationData().then(console.log);
