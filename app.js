// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
// ВАЖНО: Убедись, что в конце ссылки стоит /?url=
const PROXY = "https://loliland-proxy.orbs-bot.workers.dev/?url=";
const API_BASE = 'https://loliland.ru/apiv2';
const FALLBACK_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%232a2a35'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23b142f5' font-family='sans-serif' font-size='24'>?</text></svg>";

let currentMode = 'dashboard';

// ==========================================
// ЕДИНАЯ ФУНКЦИЯ ЗАПРОСА
// ==========================================
async function request(endpoint) {
    const target = `${API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    try {
        const res = await fetch(PROXY + encodeURIComponent(target));
        if (!res.ok) throw new Error(`Ошибка прокси: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error(`[API FAIL] ${endpoint}`, e);
        return null;
    }
}

// Ссылка на аватар через твой прокси
const getAvatarUrl = (login) => PROXY + encodeURIComponent(`https://loliland.ru/avatar/${login}/64`);

// ==========================================
// УТИЛИТЫ ФОРМАТИРОВАНИЯ
// ==========================================
const format = {
    time: (min) => {
        if (!min) return '0м';
        return min >= 60 ? `${Math.floor(min/60)}ч ${min%60}м` : `${min}м`;
    },
    num: (n) => (n || 0).toLocaleString('ru-RU'),
    role: (role) => {
        const map = { curator: ['#f5a623', 'Куратор'], admin: ['#ff4444', 'Админ'], moderator: ['#ff8800', 'Модератор'] };
        return map[role] || ['#b142f5', 'Игрок'];
    }
};

// ==========================================
// ЛОГИКА ОБНОВЛЕНИЯ ИНТЕРФЕЙСА
// ==========================================
function render(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function showSkeletons() {
    render('card1', `<div class="skeleton" style="height:40px;width:100px;"></div><div class="skeleton" style="height:20px;width:150px;margin-top:10px;"></div>`);
    render('card2', `<div class="skeleton" style="height:60px;width:100%;"></div>`);
    render('card3', `<div class="skeleton" style="height:20px;width:100%;"></div>`);
}

// ==========================================
// 1. ДАШБОРД (ГЛАВНАЯ)
// ==========================================
async function loadServerDashboard(isSilent = false) {
    if (isSilent && currentMode !== 'dashboard') return;
    currentMode = 'dashboard';

    if (!isSilent) showSkeletons();

    const data = await request('/server/monitoring');
    if (!data) return;

    // Карточка 1: Онлайн
    render('card1', `
        <div style="font-size: 36px; font-weight: 700;">${format.num(data.records.onlineCurrent)}</div>
        <div style="color: var(--text-muted); font-size: 14px;">Общий онлайн проекта</div>
        <div style="height: 100px; border-bottom: 2px solid var(--purple-glow); margin-top: 20px;">
            <svg viewBox="0 0 100 50" style="width: 100%; height: 100%; opacity: 0.5;">
                <path d="M0,45 Q20,45 40,20 T100,10" fill="none" stroke="var(--purple-glow)" stroke-width="2"/>
            </svg>
        </div>
    `);

    // Карточка 2: Серверы
    const dg = data.servers?.dark_galaxy?.online || 0;
    const tm = data.servers?.techno_magic_rpg?.online || 0;
    render('card2', `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <div><b>${dg}</b> / 100 <p style="font-size: 10px; opacity: 0.5;">DarkGalaxy</p></div>
            <div><b>${tm}</b> / 1000 <p style="font-size: 10px; opacity: 0.5;">TechnoMagic RPG</p></div>
        </div>
    `);

    render('card3', `<div style="font-size:12px;opacity:0.6;">Мониторинг обновлен: ${new Date().toLocaleTimeString()}</div>`);
}

// ==========================================
// 2. ПОИСК ИГРОКОВ
// ==========================================
const input = document.getElementById('playerInput');
const drop = document.getElementById('searchResults');

input.oninput = async () => {
    const q = input.value.trim();
    if (q.length < 2) return drop.classList.remove('active');

    const res = await request(`/user/search?limit=5&login=${encodeURIComponent(q)}`);
    
    // Пытаемся найти массив игроков в ответе LoliLand
    const players = res?.users?.elements || res?.elements || (Array.isArray(res) ? res : []);
    
    if (players.length === 0) {
        drop.innerHTML = '<div class="search-item">Никого не нашли</div>';
    } else {
        drop.innerHTML = players.map(p => `
            <div class="search-item" onclick="loadPlayerProfile('${p.login}', '${p.uuid || p.id}')">
                <img src="${getAvatarUrl(p.login)}" class="player-head" onerror="this.src='${FALLBACK_AVATAR}'">
                <span>${p.login}</span>
            </div>
        `).join('');
    }
    drop.classList.add('active');
};

// ==========================================
// 3. ПРОФИЛЬ ИГРОКА
// ==========================================
async function loadPlayerProfile(login, uuid) {
    currentMode = 'profile';
    drop.classList.remove('active');
    input.value = login;
    showSkeletons();

    const [pt, st] = await Promise.all([
        request(`/user/profile/playtime/${uuid}?period=m`),
        request(`/user/profile/statistics/${uuid}`)
    ]);

    // Суммируем время
    const timeData = pt || {};
    const totalTime = Object.entries(timeData)
        .filter(([k]) => k.includes('-'))
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);

    render('card1', `
        <div style="display:flex; align-items:center; gap:15px;">
            <img src="${getAvatarUrl(login)}" style="width:64px; border-radius:8px; border:2px solid var(--purple-glow);" onerror="this.src='${FALLBACK_AVATAR}'">
            <div>
                <h2 style="margin:0;">${login}</h2>
                <p style="font-size:10px; opacity:0.5; font-family:monospace;">${uuid}</p>
            </div>
        </div>
    `);

    render('card2', `
        <div style="text-align:center;">
            <div style="font-size:24px; font-weight:700; color:var(--purple-light);">${format.time(totalTime)}</div>
            <p style="font-size:10px; opacity:0.5;">Время за месяц</p>
        </div>
    `);

    const stats = st?.game || {};
    render('card3', `
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
            <div class="stat-node" style="background:rgba(0,0,0,0.3);padding:10px;border-radius:5px;text-align:center;">
                <span style="font-size:9px;display:block;opacity:0.5;">Убийств</span>
                <b>${format.num(stats.playersKilled)}</b>
            </div>
            <div class="stat-node" style="background:rgba(0,0,0,0.3);padding:10px;border-radius:5px;text-align:center;">
                <span style="font-size:9px;display:block;opacity:0.5;">Смертей</span>
                <b>${format.num(stats.deaths)}</b>
            </div>
            <div class="stat-node" style="background:rgba(0,0,0,0.3);padding:10px;border-radius:5px;text-align:center;">
                <span style="font-size:9px;display:block;opacity:0.5;">Баланс</span>
                <b>${format.num(st?.coins?.amount)}</b>
            </div>
        </div>
        <button class="btn-return" onclick="loadServerDashboard()" style="margin-top:20px; width:100%; background:var(--purple-glow); border:none; color:white; padding:8px; border-radius:5px; cursor:pointer;">← Назад</button>
    `);
}

// ==========================================
// СЛУШАТЕЛИ
// ==========================================
window.onload = () => {
    loadServerDashboard();
    setInterval(() => loadServerDashboard(true), 30000);
};

document.onclick = (e) => {
    if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.remove('active');
};
