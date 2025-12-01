/**
 * Script: Main Frontend Logic
 * Version: 1.2.0
 * Description: Carrega ranking, desenha gráficos e aplica regras de bônus (Ouro/Prata/Bronze)
 */

async function loadRanking() {
  try {
    const BASE_URL = "https://crazyphantombr-lang.github.io/hive-br-voter-ranking/data";
    
    // Busca paralela para performance
    const [resCurrent, resHistory] = await Promise.all([
      fetch(`${BASE_URL}/current.json`),
      fetch(`${BASE_URL}/history.json`)
    ]);

    if (!resCurrent.ok) throw new Error("Erro ao carregar current.json");
    
    const delegations = await resCurrent.json();
    const historyData = resHistory.ok ? await resHistory.json() : {};

    const tbody = document.getElementById("ranking-body");
    tbody.innerHTML = "";

    delegations.forEach((user, index) => {
      const delegator = user.delegator;
      const hp = user.hp;
      const rank = index + 1; // Ranking começa em 1, não 0
      
      const tr = document.createElement("tr");

      // ID único para o canvas
      const canvasId = `chart-${delegator}`;

      // Calcula o HTML do Bônus
      const bonusHtml = getBonusBadge(rank);

      tr.innerHTML = `
        <td>
          <span style="margin-right:10px; font-weight:bold; color:#666;">#${rank}</span>
          <img src="https://images.hive.blog/u/${delegator}/avatar/small" 
               style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:6px;">
          <a href="https://peakd.com/@${delegator}" target="_blank">@${delegator}</a>
        </td>
        <td style="font-weight:bold;">
            ${hp.toLocaleString("pt-BR", { minimumFractionDigits: 3 })} HP
        </td>
        <td>
            ${bonusHtml}
        </td>
        <td style="width: 150px; height: 60px;">
            <canvas id="${canvasId}" width="140" height="50"></canvas>
        </td>
      `;

      tbody.appendChild(tr);

      // Renderiza o gráfico se houver histórico
      if (historyData[delegator]) {
        renderSparkline(canvasId, historyData[delegator]);
      }
    });

  } catch (err) {
    console.error("Erro fatal na aplicação:", err);
  }
}

/**
 * Determina a etiqueta de bônus baseada no Ranking
 * 1-10: +20% (Ouro)
 * 11-20: +15% (Prata)
 * 21-30: +10% (Bronze)
 * 31-40: +5% (Honra/Medalha)
 */
function getBonusBadge(rank) {
  if (rank <= 10) {
    return `<span class="bonus-tag bonus-gold">+20%</span>`;
  } else if (rank <= 20) {
    return `<span class="bonus-tag bonus-silver">+15%</span>`;
  } else if (rank <= 30) {
    return `<span class="bonus-tag bonus-bronze">+10%</span>`;
  } else if (rank <= 40) {
    return `<span class="bonus-tag bonus-honor">+5%</span>`;
  } else {
    return `<span style="color:#444; font-size:0.8rem;">—</span>`;
  }
}

/**
 * Função auxiliar para desenhar o gráfico Sparkline
 */
function renderSparkline(canvasId, userHistoryObj) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  const sortedDates = Object.keys(userHistoryObj).sort();
  const values = sortedDates.map(date => userHistoryObj[date]);

  const lastValue = values[values.length - 1];
  const penLastValue = values.length > 1 ? values[values.length - 2] : lastValue;
  const color = lastValue >= penLastValue ? '#28a745' : '#dc3545';

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      layout: {
        padding: 5
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", loadRanking);
