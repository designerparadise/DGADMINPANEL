// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
const PROXY = "https://loliland-proxy.orbs-bot.workers.dev/?url=";
const API_BASE = "https://loliland.ru/apiv2";
const FALLBACK_AVA = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='%232a2a35'/></svg>";

let currentMode = 'dashboard';

// --- Единая функция для работы с API ---
async function request(path) {
    // Добавляем штамп времени, чтобы прокси всегда давал свежие данные
    const url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}_nocache=${Date.now()}`;
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error("Ошибка запроса:", path, e);
        return null;
    }
}

// --- Ссылка на аватар через твой прокси ---
const getAva = (login) => PROXY + encodeURIComponent(`https://loliland.ru/avatar/${login}/128`);

// ==========================================
// 1. ГЛАВНАЯ (ДАШБОРД)
// ==========================================
async function loadDashboard(isSilent = false) {
    if (isSilent && currentMode !== 'dashboard') return;
    currentMode = 'dashboard';

    const data = await request('/server/monitoring');
    if (!data) return;

    // Карточка 1: Общий онлайн
    document.getElementById('card1').innerHTML = `
        <div style="font-size: 42px; font-weight: 700; color: #fff;">${data.records.onlineCurrent}</div>
        <div style="color: var(--text-muted); font-size: 14px; margin-top: 5px;">Общий онлайн проекта</div>
        <div style="height: 100px; border-bottom: 2px solid var(--purple-glow); margin-top: 20px; opacity: 0.4;">
            <svg viewBox="0 0 100 50" style="width:100%; height:100%;"><path d="M0,45 Q20,45 40,20 T100,10" fill="none" stroke="white" stroke-width="2"/></svg>
        </div>`;

    // Карточка 2: Серверы
    const dg = data.servers?.dark_galaxy?.online || 0;
    const tm = data.servers?.techno_magic_rpg?.online || 0;
    document.getElementById('card2').innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div>
                <div style="font-size: 24px; font-weight: 700; color: var(--purple-light);">${dg} <span style="font-size: 12px; opacity: 0.5;">/ 100</span></div>
                <div style="font-size: 11px; opacity: 0.6;">DarkGalaxy</div>
            </div>
            <div>
                <div style="font-size: 24px; font-weight: 700; color: #fff;">${tm} <span style="font-size: 12px; opacity: 0.5;">/ 1000</span></div>
                <div style="font-size: 11px; opacity: 0.6;">TechnoMagic RPG</div>
            </div>
        </div>`;

    // Карточка 3: Статус
    document.getElementById('card3').innerHTML = `
        <div style="font-size: 14px; opacity: 0.7;">Мониторинг обновлен: ${new Date().toLocaleTimeString()}</div>
        <div style="margin-top: 15px; padding: 10px; background: rgba(177,66,245,0.1); border: 1px dashed var(--purple-glow); border-radius: 8px; text-align: center; color: var(--purple-light); font-size: 12px;">Система активна</div>
    `;
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
    // Путь к игрокам из API: res.users.elements
    const players = res?.users?.elements || [];

    drop.innerHTML = '';
    if (players.length === 0) {
        drop.innerHTML = '<div class="search-item" style="font-size: 12px; opacity: 0.5;">Никто не найден</div>';
    } else {
        players.forEach(p => {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.innerHTML = `<img src="${getAva(p.login)}" class="player-head" onerror="this.src='${FALLBACK_AVA}'"> <span>${p.login}</span>`;
            item.onclick = () => openProfile(p.login, p.uuid || p.id);
            drop.appendChild(item);
        });
    }
    drop.classList.add('active');
};

// ==========================================
// 3. ПРОФИЛЬ ИГРОКА
// ==========================================
async function openProfile(login, uuid) {
    currentMode = 'profile';
    drop.classList.remove('active');
    input.value = login;

    // Сразу рисуем каркас профиля
    document.getElementById('content').innerHTML = `
        <div class="card full-width">
            <div style="display: flex; align-items: center; gap: 20px;">
                <img src="${getAva(login)}" style="width: 80px; height: 80px; border-radius: 12px; border: 2px solid var(--purple-glow); box-shadow: 0 0 20px rgba(177,66,245,0.3);">
                <div>
                    <h2 style="color: #fff;">${login}</h2>
                    <p style="font-size: 10px; opacity: 0.4; font-family: monospace; margin-top: 5px;">${uuid}</p>
                </div>
            </div>
        </div>
        <div class="card">
            <h3 style="font-size: 14px; margin-bottom: 15px; opacity: 0.7;">Игровое время</h3>
            <div id="pt-data" style="font-size: 24px; font-weight: 700; color: var(--purple-light);">Загрузка...</div>
        </div>
        <div class="card">
            <h3 style="font-size: 14px; margin-bottom: 15px; opacity: 0.7;">Статистика (JSON)</h3>
            <div id="st-data" class="api-terminal">Загрузка...</div>
        </div>
        <div class="full-width">
            <button class="btn-return" onclick="location.reload()">← Вернуться к серверам</button>
        </div>
    `;

    const [pt, st] = await Promise.all([
        request(`/user/profile/playtime/${uuid}?period=m`),
        request(`/user/profile/statistics/${uuid}`)
    ]);

    // --- Расчет времени (сложение всех минут по датам) ---
    let totalMinutes = 0;
    if (pt) {
        // Проходим по всем ключам объекта (которые выглядят как "2026-02-26")
        Object.entries(pt).forEach(([key, value]) => {
            if (key.includes('-')) totalMinutes += (Number(value) || 0);
        });
    }
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeString = hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;

    document.getElementById('pt-data').innerHTML = `<div>${timeString}</div><div style="font-size: 10px; opacity: 0.5; margin-top: 5px;">Всего за месяц</div>`;
    document.getElementById('st-data').innerText = st ? JSON.stringify(st, null, 2) : "Статистика скрыта";
}

// --- Инициализация ---
window.onload = () => {
    loadDashboard();
    // Обновляем онлайн каждые 20 секунд
    setInterval(() => loadDashboard(true), 20000);
};

// Закрытие поиска при клике мимо
document.onclick = (e) => {
    if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.remove('active');
};
