/**
 * Script: Fetch Delegations + Wealth + Hive-Engine + Curation History
 * Version: 1.9.0
 * Update: Rastreia histórico de votos da conta @hive-br.voter
 */

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const ACCOUNT = "hive-br.voter";
const TOKEN_SYMBOL = "HBR";

const HAF_API = `https://rpc.mahdiyari.info/hafsql/delegations/${ACCOUNT}/incoming?limit=300`;
const HIVE_RPC = "https://api.deathwing.me";
const HE_RPC = "https://api.hive-engine.com/rpc/contracts";

const DATA_DIR = "data";

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function hiveRpc(method, params) {
  const response = await fetch(HIVE_RPC, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", method: method, params: params, id: 1 }),
    headers: { "Content-Type": "application/json" }
  });
  const json = await response.json();
  return json.result;
}

// Layer 2: Tokens
async function fetchHiveEngineBalances(accounts, symbol) {
  const query = { symbol: symbol, account: { "$in": accounts } };
  const response = await fetch(HE_RPC, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0", method: "find",
      params: { contract: "tokens", table: "balances", query: query, limit: 1000 },
      id: 1
    }),
    headers: { "Content-Type": "application/json" }
  });
  const json = await response.json();
  return json.result || [];
}

// NOVA FUNÇÃO: Busca histórico de votos recentes
async function fetchVoteHistory(voterAccount) {
  console.log(`🔎 Analisando histórico de votos de @${voterAccount}...`);
  // Busca as últimas 2000 operações (-1 = mais recente)
  const history = await hiveRpc("condenser_api.get_account_history", [voterAccount, -1, 2000]);
  
  if (!history || !Array.isArray(history)) return {};

  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const voteStats = {}; 
  // Estrutura: { 'usuario': { count_30d: 0, last_vote_ts: '...' } }

  history.forEach(tx => {
    const op = tx[1].op;
    const timestamp = tx[1].timestamp;
    
    // Filtra apenas votos feitos pela conta
    if (op[0] === 'vote' && op[1].voter === voterAccount) {
      const author = op[1].author;
      const voteDate = new Date(timestamp + "Z"); // Adiciona Z para UTC

      if (!voteStats[author]) {
        voteStats[author] = { count_30d: 0, last_vote_ts: null };
      }

      // Atualiza data do último voto (como a lista vem cronológica, o último processado é o mais recente se invertermos ou apenas checarmos)
      // O get_account_history retorna do mais antigo para o mais novo. Então o último que aparecer é o mais recente.
      voteStats[author].last_vote_ts = timestamp;

      // Conta se for nos últimos 30 dias
      if (voteDate >= thirtyDaysAgo) {
        voteStats[author].count_30d += 1;
      }
    }
  });
  return voteStats;
}

async function run() {
  try {
    console.log(`1. 🔄 Buscando delegações...`);
    const res = await fetch(HAF_API);
    const delegationsData = await res.json();

    if (!Array.isArray(delegationsData)) return;

    const userNames = delegationsData.map(d => d.delegator);

    console.log(`2. 🌍 Buscando Dados Globais e Riqueza...`);
    const globals = await hiveRpc("condenser_api.get_dynamic_global_properties", []);
    const vestToHp = parseFloat(globals.total_vesting_fund_hive) / parseFloat(globals.total_vesting_shares);

    const accounts = await hiveRpc("condenser_api.get_accounts", [userNames]);
    const wealthMap = {};
    accounts.forEach(acc => {
      wealthMap[acc.name] = parseFloat(acc.vesting_shares) * vestToHp;
    });

    console.log(`3. 🪙 Buscando Tokens...`);
    const heBalances = await fetchHiveEngineBalances(userNames, TOKEN_SYMBOL);
    const tokenMap = {};
    heBalances.forEach(b => { tokenMap[b.account] = parseFloat(b.stake || 0); });

    console.log(`4. 🗳️ Buscando Histórico de Curadoria...`);
    const curationMap = await fetchVoteHistory(ACCOUNT);

    const finalData = delegationsData
      .map(item => {
        const voteInfo = curationMap[item.delegator] || { count_30d: 0, last_vote_ts: null };
        return {
          delegator: item.delegator,
          delegated_hp: parseFloat(item.hp_equivalent),
          total_account_hp: wealthMap[item.delegator] || 0,
          token_balance: tokenMap[item.delegator] || 0,
          timestamp: item.timestamp,
          // Novos Campos de Curadoria
          last_vote_date: voteInfo.last_vote_ts,
          votes_month: voteInfo.count_30d
        };
      })
      .sort((a, b) => b.delegated_hp - a.delegated_hp);

    fs.writeFileSync(path.join(DATA_DIR, "current.json"), JSON.stringify(finalData, null, 2));
    
    // Metadados
    const metaData = {
      last_updated: new Date().toISOString(),
      total_delegators: finalData.length,
      total_hp: finalData.reduce((acc, curr) => acc + curr.delegated_hp, 0),
      total_hbr_staked: finalData.reduce((acc, curr) => acc + curr.token_balance, 0)
    };
    fs.writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(metaData, null, 2));

    console.log("✅ Dados salvos (incluindo Curadoria)!");

  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    process.exit(1);
  }
}

run();
