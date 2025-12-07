/**
 * Script: Fetch Delegations (Multi-Node Failover)
 * Version: 1.9.2
 * Update: Implementa rotação de servidores RPC e limite seguro de histórico (1500)
 */

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const ACCOUNT = "hive-br.voter";
const TOKEN_SYMBOL = "HBR";

const HAF_API = `https://rpc.mahdiyari.info/hafsql/delegations/${ACCOUNT}/incoming?limit=300`;
const HE_RPC = "https://api.hive-engine.com/rpc/contracts";

// Lista de Servidores para garantir que um funcione
const RPC_NODES = [
  "https://api.hive.blog",       // Oficial (Lento mas confiável)
  "https://api.deathwing.me",    // Rápido
  "https://api.openhive.network" // Alternativo
];

const DATA_DIR = "data";

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Função inteligente que tenta vários nós até conseguir
async function hiveRpc(method, params) {
  for (const node of RPC_NODES) {
    try {
      const response = await fetch(node, {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", method: method, params: params, id: 1 }),
        headers: { "Content-Type": "application/json" },
        timeout: 5000 // 5 segundos de timeout
      });
      
      if (!response.ok) throw new Error(`Status ${response.status}`);
      
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      
      return json.result; // Sucesso! Retorna e sai do loop
    } catch (err) {
      console.warn(`⚠️ Falha no node ${node}: ${err.message}. Tentando próximo...`);
    }
  }
  console.error("❌ Todos os nós RPC falharam.");
  return null;
}

async function fetchHiveEngineBalances(accounts, symbol) {
  try {
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
  } catch (err) {
    console.error("❌ Erro na Hive-Engine:", err.message);
    return [];
  }
}

async function fetchVoteHistory(voterAccount) {
  console.log(`🔎 Buscando histórico de votos de @${voterAccount}...`);
  
  // Limite reduzido para 1500 para evitar bloqueio, mas usando o sistema multi-node
  const history = await hiveRpc("condenser_api.get_account_history", [voterAccount, -1, 1500]);
  
  if (!history || !Array.isArray(history)) {
    console.warn("⚠️ Não foi possível baixar o histórico de votos.");
    return {};
  }

  console.log(`✅ ${history.length} operações recuperadas.`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const voteStats = {}; 

  history.forEach(tx => {
    const op = tx[1].op;
    const timestamp = tx[1].timestamp;
    
    if (op[0] === 'vote' && op[1].voter === voterAccount) {
      const author = op[1].author;
      // Garante formato ISO para compatibilidade
      const voteDate = new Date(timestamp + (timestamp.endsWith("Z") ? "" : "Z"));

      if (!voteStats[author]) {
        voteStats[author] = { count_30d: 0, last_vote_ts: null };
      }

      // Salva sempre o timestamp mais recente encontrado
      voteStats[author].last_vote_ts = timestamp;

      if (voteDate >= thirtyDaysAgo) {
        voteStats[author].count_30d += 1;
      }
    }
  });
  
  return voteStats;
}

async function run() {
  try {
    console.log(`1. 🔄 HAFSQL (Delegações)...`);
    const res = await fetch(HAF_API);
    const delegationsData = await res.json();

    if (!Array.isArray(delegationsData)) return;

    const userNames = delegationsData.map(d => d.delegator);

    console.log(`2. 🌍 Hive RPC (Cotação e HP)...`);
    const globals = await hiveRpc("condenser_api.get_dynamic_global_properties", []);
    
    // Tratamento de erro caso globals falhe
    let vestToHp = 0.0005; // Valor fallback aproximado
    if (globals) {
        vestToHp = parseFloat(globals.total_vesting_fund_hive) / parseFloat(globals.total_vesting_shares);
    }

    const accounts = await hiveRpc("condenser_api.get_accounts", [userNames]);
    const wealthMap = {};
    if (accounts) {
        accounts.forEach(acc => {
            wealthMap[acc.name] = parseFloat(acc.vesting_shares) * vestToHp;
        });
    }

    console.log(`3. 🪙 Hive-Engine (HBR Stake)...`);
    const heBalances = await fetchHiveEngineBalances(userNames, TOKEN_SYMBOL);
    const tokenMap = {};
    heBalances.forEach(b => { 
        tokenMap[b.account] = parseFloat(b.stake || 0); 
    });

    console.log(`4. 🗳️ Histórico de Curadoria...`);
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
          last_vote_date: voteInfo.last_vote_ts,
          votes_month: voteInfo.count_30d
        };
      })
      .sort((a, b) => b.delegated_hp - a.delegated_hp);

    fs.writeFileSync(path.join(DATA_DIR, "current.json"), JSON.stringify(finalData, null, 2));
    
    const metaData = {
      last_updated: new Date().toISOString(),
      total_delegators: finalData.length,
      total_hp: finalData.reduce((acc, curr) => acc + curr.delegated_hp, 0),
      total_hbr_staked: finalData.reduce((acc, curr) => acc + curr.token_balance, 0)
    };
    fs.writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(metaData, null, 2));

    console.log("✅ Ciclo concluído com sucesso!");

  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    process.exit(1);
  }
}

run();
