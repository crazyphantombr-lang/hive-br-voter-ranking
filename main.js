/**
 * Script: Main Frontend Logic
 * Version: 1.3.0
 * Description: Dashboard completo com Search, Stats e Ranking
 */

async function loadDashboard() {
  const BASE_URL = "https://crazyphantombr-lang.github.io/hive-br-voter-ranking/data";
  
  try {
    // Busca dados em paralelo (incluindo o novo meta.json)
    const [resCurrent, resHistory, resMeta] = await Promise.all([
      fetch(`${BASE_URL}/current.json`),
      fetch(`${BASE_URL}/ranking_history.json`),
      fetch(`${BASE_URL}/meta.json`) // Tenta buscar metadados, se existir
    ]);

    if (!resCurrent.ok) throw new Error("Erro ao carregar dados.");

    const delegations = await resCurrent.json();
    const historyData = resHistory.ok ? await resHistory.json() : {};
    const metaData = resMeta.ok ? await resMeta.json() : null;

    // 1. Renderiza Cabeçalho e Stats
    updateStats(delegations, metaData, historyData);

    // 2. Renderiza Tabela
    renderTable(delegations, historyData);

    // 3. Ativa Pesquisa
    setupSearch();

  } catch (err) {
    console.error("Erro no dashboard:", err);
    document.getElementById("last-updated").innerText = "Erro ao carregar dados. Tente atualizar.";
  }
}

function updateStats(delegations, meta, historyData) {
  // Data de Atualização
  const dateEl = document.getElementById("last-updated");
  if (meta && meta.last_updated) {
    const dateObj = new Date(meta.last_updated);
    dateEl.innerText = `Atualizado em: ${dateObj.toLocaleString("pt-BR")}`;
  } else {
    dateEl.innerText = "Atualizado recentemente";
  }

  // Estatísticas Gerais
  const totalHP = delegations.reduce((acc, curr) => acc + curr.hp, 0);
  const totalUsers = delegations.length;

  document.getElementById("stat-total-hp").innerText = 
    totalHP.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " HP";
  
  document.getElementById("stat-count").innerText = totalUsers;

  // Calcula Maior Crescimento (Quem mais subiu de ontem pra hoje)
  let bestGrower = { name: "—", val: 0 };
  
  delegations.forEach(user => {
    const hist = historyData[user.delegator];
    if (hist) {
      const dates = Object.keys(hist).sort();
      if (dates.length >= 2) {
        const todayVal = hist[dates[dates.length - 1]];
        const yesterdayVal = hist[dates[dates.length - 2]];
        const diff = todayVal - yesterdayVal;
        
        if (diff > bestGrower.val) {
          bestGrower = { name: user.delegator, val: diff };
        }
      }
    }
  });

  if (bestGrower.val > 0) {
    document.getElementById("stat-growth").innerHTML = 
      `@${bestGrower.name} <span style="font-size:0.6em; color:#4dff91">(+${bestGrower.val.toFixed(0)})</span>`;
  }
}

function renderTable(delegations, historyData) {
  const tbody = document.getElementById("ranking-body");
  tbody.innerHTML = "";

  delegations.forEach((user, index) => {
    const rank = index + 1;
    const tr = document.createElement("tr");
    
    // Adiciona classe para busca (nome do usuário em minúsculo)
    tr.classList.add("delegator-row");
    tr.dataset.name = user.delegator.toLowerCase();

    const canvasId = `chart-${user.delegator}`;
    const bonusHtml = getBonusBadge(rank);

    tr.innerHTML = `
      <td>
        <span style="color:#666; margin-right:8px; font-weight:bold;">#${rank}</span>
        <img src="https://images.hive.blog/u/${user.delegator}/avatar/small" 
             style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:5px;">
        <a href="https://peakd.com/@${user.delegator}" target="_blank">@${user.delegator}</a>
      </td>
      <td style="font-weight:bold; font-family:monospace; font-size:1.1em;">
          ${user.hp.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}
      </td>
      <td>${bonusHtml}</td>
      <td style="width:140px;">
          <canvas id="${canvasId}" width="120" height="40"></canvas>
      </td>
    `;

    tbody.appendChild(tr);

    // Gráfico
    let userHistory = historyData[user.delegator] || {};
    if (Object.keys(userHistory).length === 0) {
       const today = new Date().toISOString().slice(0, 10);
       userHistory = { [today]: user.hp };
    }
    renderSparkline(canvasId, userHistory);
  });
}

function setupSearch() {
  const input = document.getElementById("search-input");
  input.addEventListener("keyup", (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll(".delegator-row");

    rows.forEach(row => {
      const name = row.dataset.name;
      if (name.includes(term)) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  });
}

function getBonusBadge(rank) {
  if (rank <= 10) return `<span class="bonus-tag bonus-gold">Ouro (+20%)</span>`;
  if (rank <= 20) return `<span class="bonus-tag bonus-silver">Prata (+15%)</span>`;
  if (rank <= 30) return `<span class="bonus-tag bonus-bronze">Bronze (+10%)</span>`;
  if (rank <= 40) return `<span class="bonus-tag bonus-honor">Honra (+5%)</span>`;
  return `<span style="opacity:0.3">—</span>`;
}

function renderSparkline(canvasId, userHistoryObj) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const sortedDates = Object.keys(userHistoryObj).sort();
  const values = sortedDates.map(date => userHistoryObj[date]);
  
  const last = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : last;
  const color = last >= prev ? '#4dff91' : '#ff4d4d';

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 2,
        pointRadius: values.length === 1 ? 3 : 0, // Bolinha se for só 1 ponto
        tension: 0.2,
        fill: false
      }]
    },
    options: {
      responsive: false,
      plugins: { legend: {display:false}, tooltip: {enabled: true} },
      scales: { x: {display:false}, y: {display:false} }
    }
  });
}

document.addEventListener("DOMContentLoaded", loadDashboard);
