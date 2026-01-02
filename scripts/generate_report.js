/**
 * Script: AI Report Generator
 * Version: 2.20.0
 * Description: Generates blog post with Cover Image, Social Links and Educational Info.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// --- CONFIGURAÇÕES DO RELATÓRIO ---
const COVER_IMAGE_URL = "https://files.peakd.com/file/peakd-hive/crazyphantombr/23tknNzYZVr2stDGwN8Sv9BpmnRmeRgcZNaC1ZhHFB1U99MTAe5qfGrcsZd4a51PPnRkZ.png"; // <--- INSIRA A URL DA SUA IMAGEM AQUI
const DISCORD_LINK = "https://discord.gg/NgfkeVJT5w";    // <--- SEU LINK DISCORD
const WHATSAPP_LINK = "";  // <--- SEU LINK WHATSAPP
const MODEL_NAME = "gemini-2.5-flash"; 

const DATA_DIR = "data";
const REPORT_DIR = "reports";
const META_FILE = path.join(DATA_DIR, "meta.json");
const HISTORY_FILE = path.join(DATA_DIR, "monthly_stats.json");

if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { console.error("❌ Erro: GEMINI_API_KEY ausente."); process.exit(1); }

    try {
        console.log("📂 Lendo dados...");
        const meta = JSON.parse(fs.readFileSync(META_FILE));
        let history = [];
        try { history = JSON.parse(fs.readFileSync(HISTORY_FILE)); } catch (e) {}

        const today = new Date().toLocaleDateString("pt-BR");
        
        // Histórico para comparação (Pega os últimos 2 meses para ver tendência)
        const lastMonth = history.length >= 2 ? history[history.length - 2] : null;
        
        // Texto fixo educativo
        const educationalText = `
        > **O que é a Hive?**
        > A Hive é uma blockchain descentralizada, rápida e sem taxas de transação, onde criadores de conteúdo são donos de seus dados e monetizam suas publicações. Diferente das redes sociais tradicionais, aqui a comunidade decide o valor do conteúdo. A **Comunidade Hive BR** é o ponto de encontro para brasileiros explorarem esse ecossistema.
        `;

        const prompt = `
        Você é o **Gerente de Comunidade e Redator da Hive BR**.
        Escreva um relatório mensal para o blog, focado em atrair novos membros e prestar contas.

        --- DADOS ESTRUTURAIS ---
        - Imagem de Capa (Obrigatória no topo): ${COVER_IMAGE_URL}
        - Link Discord: ${DISCORD_LINK}
        - Link WhatsApp: ${WHATSAPP_LINK}
        
        --- DADOS DE PERFORMANCE (${today}) ---
        1. **Membros Ativos (Base Única):** ${meta.active_community_members} (Pessoas distintas entre delegadores e trilha).
        2. **Poder da Comunidade (Total HP):** ${meta.total_hp.toFixed(0)} HP.
        3. **HP Próprio (Sustentabilidade):** ${meta.project_account_hp.toFixed(0)} HP.
        4. **Seguidores da Trilha (Curation Trail):** ${meta.curation_trail_count}.
        5. **Votos no Mês:** ${meta.votes_month_current}.
        6. **Economia HBR (Stake):** ${meta.total_hbr_staked.toFixed(0)} HBR.

        --- COMPARAÇÃO HISTÓRICA ---
        ${lastMonth ? `Mês anterior: ${lastMonth.total_power.toFixed(0)} HP e ${lastMonth.active_members || 'N/A'} membros.` : "Sem dados anteriores."}
        (Analise se houve queda ou subida e comente sobre a resiliência ou crescimento).

        --- ESTRUTURA DO POST (Markdown) ---
        1. **Imagem de Capa** (Use a sintaxe: ![Capa](${COVER_IMAGE_URL}))
        2. **Título:** Criativo e datado.
        3. **Introdução:** Energética, boas vindas.
        4. **O que é a Hive?** (Insira este texto educativo: "${educationalText}").
        5. **Raio-X da Comunidade (Números):** Apresente os dados acima com comentários. Dê destaque especial ao número de "Membros Ativos".
        6. **Nossos Canais:** Convite enfático para entrar no Discord e WhatsApp (Use os links fornecidos).
        7. **Chamada para Ação:** Delegue para @hive-br.voter e siga a trilha.

        Escreva em Português do Brasil, tom acolhedor, profissional e otimista.
        `;

        console.log(`🤖 Gerando relatório v2.20 com ${MODEL_NAME}...`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const filename = `relatorio_${new Date().toISOString().slice(0, 10)}.md`;
        fs.writeFileSync(path.join(REPORT_DIR, filename), text);
        console.log(`✅ Relatório v2.20 salvo: ${filename}`);

    } catch (error) {
        console.error("❌ Falha:", error.message);
        process.exit(1);
    }
}

run();
