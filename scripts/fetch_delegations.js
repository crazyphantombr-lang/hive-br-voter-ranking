// scripts/fetch_delegations.js
// Executar em Node 18+ (GitHub Actions usa Node 18)
// Tentamos primeiro o endpoint HafSQL que você mencionou.
// Se falhar, apenas logamos o erro e retornamos não-zero.

const fs = require('fs');
const path = require('path');

const HAFSQL_URL = 'https://rpc.mahdiyari.info/hafsql/delegations/hive-br.voter/incoming?limit=100';
const OUTDIR = path.join(__dirname, '..', 'data');
const OUTFILE = path.join(OUTDIR, 'current.json');

async function fetchHafsql() {
  const res = await fetch(HAFSQL_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`HafSQL HTTP ${res.status}`);
  return res.json();
}

function normalizeHafsql(items) {
  // Espera itens no formato que você mostrou:
  // { delegator, delegatee, vests, hp_equivalent, timestamp }
  return items.map(i => {
    const hp = i.hp_equivalent !== undefined
      ? parseFloat(i.hp_equivalent)
      : (i.hps !== undefined ? parseFloat(i.hps) : 0);
    return {
      delegator: i.delegator,
      hp: Number.isFinite(hp) ? Number(hp.toFixed(3)) : 0,
      timestamp: i.timestamp || null
    };
  }).sort((a,b) => b.hp - a.hp);
}

(async () => {
  try {
    // garante pasta data
    if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

    console.log('🔎 tentando HafSQL endpoint...');
    const raw = await fetchHafsql();
    // dependendo do endpoint, a resposta pode vir embalada (ex: {result: [...]}) ou direto array
    const items = Array.isArray(raw) ? raw : (raw.result || raw.data || raw.delegations || []);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Resposta HafSQL vazia ou no formato inesperado');
    }

    const normalized = normalizeHafsql(items);
    fs.writeFileSync(OUTFILE, JSON.stringify(normalized, null, 2), 'utf8');
    console.log('✅ current.json atualizado com sucesso!');
    process.exit(0);
  } catch (err) {
    console.error('❌ falha ao buscar delegações:', err.message || err);
    // mantém logs para debug — mas NÃO escrevemos JSON inválido.
    process.exit(2);
  }
})();
