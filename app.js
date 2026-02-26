// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
const PROXY = "https://loliland-proxy.orbs-bot.workers.dev/?url=";
const API_BASE = "https://loliland.ru/apiv2";

// Важно: внутри SVG используем двойные кавычки ", а саму строку обрамляем в одинарные '
const FALLBACK_AVA = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%232a2a35"/></svg>';

let isProfile = false;

// --- Универсальная функция запроса ---
async function request(path) {
    const url = API_BASE + path + (path.includes('?') ? '&' : '?') + 't=' + Date.now();
    try {
        const response = await fetch(PROXY + encodeURIComponent(url));
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("Ошибка API:", path);
        return null;
    }
}

// --- Ссылка на аватарку через прокси ---
const getAva = (login) => PROXY + encodeURIComponent(`https://loliland.ru/avatar/${login}/128`);

// ==========================================
// ГЛАВНАЯ (ДАШБОРД)
// ==========================================
async function loadDash(isSilent = false) {
    if (isProfile) return;
    const data = await request('/server/monitoring');
    if (!data) return;

    document.getElementById('card1').innerHTML = `
        <h1 style="font-size: 42px; margin-bottom: 5px;">${data.records.onlineCurrent}</h1>
        <p style="opacity: 0.5; font-size: 12px;">ОБЩИЙ ОНЛАЙН</p>
        <div style="height: 100px; border-bottom: 2px solid var(--purple-glow); margin-top: 20px; opacity: 0.2;">
            <svg viewBox="0 0 100 50" style="width:100%; height:100%;"><path d="M0,45 Q20,45 40,20 T100,10" fill="none" stroke="white" stroke-width="2"/></svg>
        </div>
    `;

    document.getElementById('card2').innerHTML = `
        <h3 style="margin-bottom: 15px; font-size: 14px;">СЕРВЕРЫ</h3>
        <p style="font-size: 13px;">DarkGalaxy: <span style="color:var(--purple-glow); font-weight:bold;">${data.servers.dark_galaxy?.online || 0}</span></p>
        <p style="font-size: 13px; margin-top: 5px;">TechnoMagic: <b>${data.servers.techno_magic_rpg?.online || 0}</b></p>
    `;

    document.getElementById('card3').innerHTML = `
        <p style="font-size: 11px; opacity: 0.4;">Последнее обновление: ${new Date().toLocaleTimeString()}</p>
    `;
}

// ==========================================
// ПОИСК И ПРОФИЛЬ
// ==========================================
const input = document.getElementById('playerInput');
const drop = document.getElementById('searchResults');

input.oninput = async () => {
    const val = input.value.trim();
    if (val.length < 2) return drop.classList.remove('active');

    const res = await request('/user/search?limit=5&login=' + encodeURIComponent(val));
    const players = res?.users?.elements || [];

    drop.innerHTML = players.map(p => {
        // Чтобы избежать ошибки SyntaxError, подставляем FALLBACK_AVA аккуратно
        return `
            <div class="search-item" onclick="openProfile('${p.login}', '${p.uuid || p.id}')">
                <img src="${getAva(p.login)}" class="player-head" onerror="this.src='${FALLBACK_AVA}'">
                <span>${p.login}</span>
            </div>
        `;
    }).join('') || '<div class="search-item">Не найдено</div>';
    
    drop.classList.add('active');
};

async function openProfile(login, uuid) {
    isProfile = true;
    drop.classList.remove('active');
    input.value = login;

    document.getElementById('content').innerHTML = `
        <div class="card full-width">
            <div style="display: flex; align-items: center; gap: 20px;">
                <img src="${getAva(login)}" style="width: 80px; border-radius: 12px; border: 2px solid var(--purple-glow);" onerror="this.src='${FALLBACK_AVA}'">
                <div>
                    <h2 style="font-size: 24px;">${login}</h2>
                    <p style="font-size: 10px; opacity: 0.4; font-family: monospace;">${uuid}</p>
                </div>
            </div>
        </div>
        <div class="card">
            <h3 style="font-size: 13px; opacity: 0.6;">ВРЕМЯ (МЕСЯЦ)</h3>
            <h2 id="pt-val" style="color: var(--purple-light); margin-top: 10px;">Загрузка...</h2>
        </div>
        <div class="card">
            <h3 style="font-size: 13px; opacity: 0.6;">БАЛАНС</h3>
            <h2 id="st-val" style="margin-top: 10px;">Загрузка...</h2>
        </div>
        <div class="full-width">
            <button class="btn-return" onclick="location.reload()">← НАЗАД К МОНИТОРИНГУ</button>
        </div>
    `;

    const [pt, st] = await Promise.all([
        request(`/user/profile/playtime/${uuid}?period=m`),
        request(`/user/profile/statistics/${uuid}`)
    ]);

    // --- РАСЧЕТ ВРЕМЕНИ ---
    let totalMinutes = 0;
    if (pt) {
        Object.entries(pt).forEach(([key, val]) => {
            if (key.includes('-')) totalMinutes += (Number(val) || 0);
        });
    }
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    document.getElementById('pt-val').innerText = h > 0 ? `${h}ч ${m}м` : `${m}м`;
    document.getElementById('st-val').innerText = st?.coins?.amount ? st.coins.amount.toLocaleString() : "0";
}

// --- Инициализация ---
window.onload = () => {
    loadDash();
    // Обновляем онлайн каждые 15 секунд
    setInterval(() => loadDash(true), 15000);
};

// Закрытие поиска при клике мимо
document.addEventListener('click', (e) => {
    if (!input.contains(e.target)) drop.classList.remove('active');
});
