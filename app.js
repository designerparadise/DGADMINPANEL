// ==========================================
// БАЗОВЫЕ НАСТРОЙКИ
// ==========================================
// allorigins возвращает JSON-обёртку: { contents: '...', status: {...} }
// Для бинарных данных (аватары) используем отдельный прокси
const PROXY_URL = 'https://api.allorigins.win/raw?url=';
const BASE_API = 'https://loliland.ru/apiv2';
const fallbackAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%232a2a35'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23b142f5' font-family='sans-serif' font-size='24'>?</text></svg>";

// Аватары загружаем через fetch() → blob: URL
// Пробуем несколько прокси и форматов URL по очереди
const avatarBlobCache = {};
async function getAvatarBlob(login) {
    if (avatarBlobCache[login]) return avatarBlobCache[login];

    // Разные варианты URL аватара на loliland
    const avatarUrls = [
        `https://loliland.ru/avatar/${login}/64`,
        `https://loliland.ru/skin/head/${login}/64`,
        `https://loliland.ru/api/skin/head/${login}`,
    ];
    // Разные прокси
    const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://thingproxy.freeboard.io/fetch/',
        'https://proxy.cors.sh/',
    ];

    for (const avatarSrc of avatarUrls) {
        for (const proxy of proxies) {
            try {
                const url = proxy + encodeURIComponent(avatarSrc);
                const res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) continue;
                const contentType = res.headers.get('content-type') || '';
                if (!contentType.startsWith('image/')) continue;
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                avatarBlobCache[login] = blobUrl;
                return blobUrl;
            } catch {
                continue;
            }
        }
    }
    return fallbackAvatar;
}

let currentMode = 'dashboard';

// ==========================================
// ФУНКЦИЯ ДЛЯ ЗАПРОСОВ
// ==========================================
const API_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/',
    'https://proxy.cors.sh/',
];

async function fetchLoliLandAPI(endpoint) {
    const cacheBuster = `_cb=${Date.now()}`;
    const separator = endpoint.includes('?') ? '&' : '?';
    const targetUrl = BASE_API + endpoint + separator + cacheBuster;

    for (const proxy of API_PROXIES) {
        try {
            const proxiedUrl = proxy + encodeURIComponent(targetUrl);
            const response = await fetch(proxiedUrl);
            if (!response.ok) continue;
            const text = await response.text();
            // Проверяем что это JSON, а не HTML/ошибка прокси
            if (text.startsWith('{') || text.startsWith('[')) {
                return JSON.parse(text);
            }
        } catch (e) {
            continue;
        }
    }
    console.error(`[ALL PROXIES FAILED] ${endpoint}`);
    return null;
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
function formatTime(minutes) {
    if (!minutes && minutes !== 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}м`;
    return `${h}ч ${m}м`;
}

function formatNumber(n) {
    if (!n && n !== 0) return '0';
    return n.toLocaleString('ru-RU');
}

function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getRoleColor(role) {
    const colors = {
        curator: '#f5a623', admin: '#ff4444', moderator: '#ff8800',
        legendary: '#ffd700', premium: '#b142f5', default: '#8a8a98'
    };
    return colors[role] || '#b142f5';
}

function getRoleLabel(role) {
    const labels = {
        curator: 'Куратор', admin: 'Админ', moderator: 'Модератор',
        legendary: 'Легендарный', premium: 'Премиум', default: 'Игрок'
    };
    return labels[role] || role;
}

// Мини-график активности из объекта playtime {дата: минуты}
function buildActivityChart(ptData) {
    const entries = Object.entries(ptData)
        .filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14);

    if (entries.length === 0) return '<div style="color:var(--text-muted);font-size:12px;">Нет данных об активности</div>';

    const maxVal = Math.max(...entries.map(([, v]) => v), 1);
    const bars = entries.map(([date, val]) => {
        const pct = Math.max(4, Math.round((val / maxVal) * 100));
        const shortDate = date.slice(5);
        const hours = Math.floor(val / 60);
        const mins = val % 60;
        const label = hours > 0 ? `${hours}ч` : `${mins}м`;
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;">
                <div style="font-size:9px;color:var(--purple-light);opacity:0.8;">${label}</div>
                <div style="width:100%;background:linear-gradient(180deg,var(--purple-glow),var(--purple-light));height:${pct}%;border-radius:3px 3px 0 0;box-shadow:0 0 6px rgba(177,66,245,0.4);min-height:4px;"></div>
                <div style="font-size:8px;color:var(--text-muted);writing-mode:vertical-rl;transform:rotate(180deg);height:28px;">${shortDate}</div>
            </div>`;
    }).join('');

    return `<div style="display:flex;align-items:flex-end;gap:3px;height:120px;padding-bottom:30px;">${bars}</div>`;
}

// ==========================================
// UI СКЕЛЕТОНЫ
// ==========================================
function showSkeletons() {
    document.getElementById('card1').innerHTML = `<div class="skeleton sk-title-large"></div><div class="skeleton sk-subtitle"></div><div style="height: 150px; width: 100%; border-bottom: 1px solid rgba(177, 66, 245, 0.3); position: relative; overflow: hidden; margin-top: 10px;"><svg viewBox="0 0 100 50" style="width: 100%; height: 100%;"><path d="M0,45 Q15,45 25,35 T50,25 T75,15 T100,20" fill="none" stroke="var(--purple-glow)" stroke-width="1.5" style="filter: drop-shadow(0 0 5px var(--purple-glow));"/></svg></div>`;
    document.getElementById('card2').innerHTML = `<div style="display: flex; justify-content: space-between;"><div><div class="skeleton sk-title-med"></div><div class="skeleton sk-subtitle-short"></div></div><div><div class="skeleton sk-title-med"></div><div class="skeleton sk-subtitle-short"></div></div></div><div style="display: flex; justify-content: space-around; margin-top: 20px;"><div style="width: 90px; height: 90px; border-radius: 50%; border: 12px solid rgba(177,66,245,0.2);"></div></div>`;
    document.getElementById('card3').innerHTML = `<div class="skeleton sk-title-large"></div><div class="skeleton sk-subtitle"></div>`;
}

// ==========================================
// 1. ДАШБОРД
// ==========================================
async function loadServerDashboard(isSilent = false) {
    if (isSilent && currentMode !== 'dashboard') return;
    currentMode = 'dashboard';

    if (!isSilent) {
        showSkeletons();
        if (document.getElementById('playerInput')) document.getElementById('playerInput').value = '';
    }

    const data = await fetchLoliLandAPI('/server/monitoring');
    if (!data || !data.records) return;

    const logoEl = document.getElementById('main-logo');
    if (logoEl) {
        logoEl.outerHTML = '<div id="main-logo" style="text-align: center; margin-bottom: 40px; font-size: 20px; font-weight: 700; color: #fff; text-shadow: 0 0 15px var(--purple-glow); letter-spacing: 1px;">LoliLand Admin</div>';
    }

    document.querySelectorAll('.sk-nav, .sk-nav-short').forEach((el, i) => {
        const items = ['Дашборд', 'Серверы', 'Игроки', 'Настройки'];
        if (items[i]) el.outerHTML = `<span style="color:rgba(255,255,255,0.8)">${items[i]}</span>`;
    });

    document.getElementById('card1').innerHTML = `
        <div style="font-size: 36px; font-weight: 700;">${data.records.onlineCurrent}</div>
        <div style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px;">Общий онлайн проекта</div>
        <div style="height: 150px; border-bottom: 1px solid rgba(177, 66, 245, 0.3);">
            <svg viewBox="0 0 100 50" style="width: 100%; height: 100%;"><path d="M0,45 Q15,45 25,35 T50,25 T75,15 T100,20" fill="none" stroke="var(--purple-glow)" stroke-width="1.5" style="filter: drop-shadow(0 0 5px var(--purple-glow));"/></svg>
        </div>`;

    const dgOnline = data.servers?.dark_galaxy?.online || 0;
    const tmOnline = data.servers?.techno_magic_rpg?.online || 0;

    document.getElementById('card2').innerHTML = `
        <div style="display: flex; justify-content: space-between;">
            <div>
                <div style="font-size: 24px; color: var(--purple-light); text-shadow: 0 0 10px var(--purple-glow);">${dgOnline} <span style="font-size: 12px; color: var(--text-muted);">/ 100</span></div>
                <div style="color: var(--text-muted); font-size: 11px;">DarkGalaxy</div>
            </div>
            <div>
                <div style="font-size: 24px;">${tmOnline} <span style="font-size: 12px; color: var(--text-muted);">/ 1000</span></div>
                <div style="color: var(--text-muted); font-size: 11px;">TechnoMagic RPG</div>
            </div>
        </div>
        <div style="display: flex; justify-content: space-around; margin-top: 30px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(var(--purple-glow) ${(dgOnline / 100) * 100}%, rgba(255,255,255,0.05) 0); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(177, 66, 245, 0.2);">
                <div style="width: 58px; height: 58px; background-color: #111; border-radius: 50%;"></div>
            </div>
            <div style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(var(--purple-light) ${(tmOnline / 1000) * 100}%, rgba(255,255,255,0.05) 0); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(177, 66, 245, 0.2);">
                <div style="width: 58px; height: 58px; background-color: #111; border-radius: 50%;"></div>
            </div>
        </div>`;

    document.getElementById('card3').innerHTML = `
        <div style="font-size: 20px; font-weight: 500;">Управление системой</div>
        <div style="color: var(--text-muted); font-size: 12px;">Данные обновлены: ${new Date().toLocaleTimeString()}</div>
        <div style="margin-top: 20px; padding: 10px; background: rgba(177,66,245,0.1); border: 1px dashed rgba(177,66,245,0.3); border-radius: 8px; color: var(--purple-light); text-align: center; font-size: 12px;">Мониторинг активен</div>
    `;
}

// ==========================================
// 2. ПОИСК ИГРОКОВ
// ==========================================
const searchInput = document.getElementById('playerInput');
const searchDropdown = document.getElementById('searchResults');
let typingTimer;

searchInput.addEventListener('input', () => {
    clearTimeout(typingTimer);
    const query = searchInput.value.trim();

    if (query.length < 2) {
        searchDropdown.classList.remove('active');
        return;
    }

    searchDropdown.innerHTML = '<div class="search-item" style="color: var(--purple-light);">📡 Поиск...</div>';
    searchDropdown.classList.add('active');

    typingTimer = setTimeout(async () => {
        const result = await fetchLoliLandAPI(`/user/search?limit=10&login=${encodeURIComponent(query)}`);
        searchDropdown.innerHTML = '';

        if (!result) {
            searchDropdown.innerHTML = '<div class="search-item" style="color: #ff4444;">Ошибка API</div>';
            return;
        }

        let players = [];
        if (result.users?.elements) players = result.users.elements;
        else if (Array.isArray(result)) players = result;
        else if (result.elements) players = result.elements;

        if (players.length === 0) {
            searchDropdown.innerHTML = '<div class="search-item" style="color: #ff4444;">Игрок не найден</div>';
            return;
        }

        for (const player of players) {
            const login = player.login || 'Unknown';
            const role = player.roles?.entry?.role || 'default';

            const item = document.createElement('div');
            item.className = 'search-item';

            // Placeholder аватар сразу, потом заменим blob-ом
            item.innerHTML = `
                <img src="${fallbackAvatar}" class="player-head" data-login="${login}">
                <div style="flex:1;">
                    <div style="font-weight:500;font-size:13px;">${login}</div>
                    <div style="font-size:10px;color:${getRoleColor(role)};">${getRoleLabel(role)}</div>
                </div>
            `;
            item.onclick = async () => {
                const blob = await getAvatarBlob(login);
                loadPlayerProfile(player, blob);
            };
            searchDropdown.appendChild(item);

            // Загружаем аватар асинхронно и подставляем
            getAvatarBlob(login).then(blob => {
                const img = item.querySelector('img[data-login]');
                if (img) img.src = blob;
            });
        }
    }, 400);
});

// ==========================================
// 3. ПРОФИЛЬ ИГРОКА — КРАСИВЫЙ UI
// ==========================================
async function loadPlayerProfile(player, avatarUrl) {
    const login = player.login || 'Unknown';
    const uuid = player.uuid || player.id || '';
    const role = player.roles?.entry?.role || 'default';
    const roleColor = getRoleColor(role);

    if (!uuid) return;

    currentMode = 'profile';
    searchDropdown.classList.remove('active');
    searchInput.value = login;
    showSkeletons();

    const [ptData, stData] = await Promise.all([
        fetchLoliLandAPI(`/user/profile/playtime/${uuid}?period=m`),
        fetchLoliLandAPI(`/user/profile/statistics/${uuid}`)
    ]);

    // ── КАРТОЧКА 1: Шапка профиля ──
    const regDate = formatDate(player.registerDate);
    const serverRoles = player.roles?.tooltip?.serverStackedRoles || {};
    const serverRolesList = Object.entries(serverRoles).map(([server, roles]) => {
        const topRole = roles[0]?.role || '';
        return `<span style="font-size:9px;padding:2px 7px;border-radius:10px;background:rgba(177,66,245,0.15);border:1px solid rgba(177,66,245,0.3);color:var(--purple-light);">${server.replace(/_/g,' ')}: ${topRole}</span>`;
    }).join('');

    document.getElementById('card1').innerHTML = `
        <div style="display:flex;align-items:center;gap:20px;">
            <div style="position:relative;flex-shrink:0;">
                <img src="${avatarUrl}" style="width:72px;height:72px;border-radius:10px;box-shadow:0 0 25px ${roleColor}66;display:block;" onerror="this.src='${fallbackAvatar}'">
                <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;padding:2px 8px;border-radius:10px;background:${roleColor}22;border:1px solid ${roleColor};color:${roleColor};">${getRoleLabel(role)}</div>
            </div>
            <div style="flex:1;min-width:0;margin-top:4px;">
                <div style="font-size:26px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${login}</div>
                <div style="color:var(--text-muted);font-size:10px;font-family:monospace;margin:4px 0 10px;">${uuid}</div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;">${serverRolesList || '<span style="font-size:10px;color:var(--text-muted);">Нет серверных ролей</span>'}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:10px;color:var(--text-muted);">Регистрация</div>
                <div style="font-size:13px;color:var(--purple-light);margin-top:3px;">${regDate}</div>
            </div>
        </div>
    `;

    // ── КАРТОЧКА 2: Playtime + График ──
    // ptData содержит ключи вида "2026-02-20": 27 (минуты за день)
    // Суммируем сами, т.к. поля total/month в ответе нет
    let totalMinutes = ptData?.total ?? ptData?.playtime?.total ?? null;
    let monthMinutes = ptData?.month ?? ptData?.playtime?.month ?? null;

    if (ptData && totalMinutes === null) {
        // Считаем сумму всех дат
        const dateEntries = Object.entries(ptData).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k));
        totalMinutes = dateEntries.reduce((sum, [, v]) => sum + (Number(v) || 0), 0);

        // За текущий месяц
        const now = new Date();
        const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthMinutes = dateEntries
            .filter(([k]) => k.startsWith(curMonth))
            .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
    }

    const chartHtml = ptData ? buildActivityChart(ptData) : '<div style="color:var(--text-muted);font-size:12px;">Нет данных</div>';

    document.getElementById('card2').innerHTML = `
        <div style="font-size:15px;font-weight:600;margin-bottom:14px;color:#fff;">⏱ Активность</div>
        <div style="display:flex;gap:10px;margin-bottom:16px;">
            <div style="flex:1;background:rgba(177,66,245,0.07);border:1px solid rgba(177,66,245,0.2);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:var(--purple-light);">${formatTime(totalMinutes)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Всего</div>
            </div>
            <div style="flex:1;background:rgba(177,66,245,0.07);border:1px solid rgba(177,66,245,0.2);border-radius:10px;padding:12px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:var(--purple-light);">${formatTime(monthMinutes)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">За месяц</div>
            </div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;">График за последние 14 дней</div>
        ${chartHtml}
    `;

    // ── КАРТОЧКА 3: Статистика сеткой ──
    const g = stData?.game || {};
    const coins = stData?.coins || {};
    const ratings = stData?.ratings || {};

    const statItems = [
        { icon: '⛏️', label: 'Блоков сломано',    value: formatNumber(g.blocksBreaked) },
        { icon: '🧱',  label: 'Блоков поставлено', value: formatNumber(g.blocksPlaced) },
        { icon: '⚔️',  label: 'Убийств игроков',   value: formatNumber(g.playersKilled) },
        { icon: '🐉',  label: 'Убито мобов',        value: formatNumber(g.monstersKilled) },
        { icon: '💀',  label: 'Смертей',            value: formatNumber(g.deaths) },
        { icon: '✉️',  label: 'Сообщений',          value: formatNumber(g.messages) },
        { icon: '💰',  label: 'Баланс',             value: formatNumber(coins.amount) },
        { icon: '📈',  label: 'Заработано',         value: formatNumber(coins.income) },
        { icon: '💸',  label: 'Потрачено',          value: formatNumber(coins.expenses) },
        { icon: '🏆',  label: 'Рейтинг коинов',    value: ratings.coins > 0 ? `#${ratings.coins}` : '—' },
        { icon: '⏳',  label: 'Рейтинг онлайна',   value: ratings.playtime > 0 ? `#${ratings.playtime}` : '—' },
        { icon: '❤️',  label: 'Лайков',             value: formatNumber(ratings.likes) },
    ];

    const statsGrid = statItems.map(s => `
        <div style="background:rgba(177,66,245,0.06);border:1px solid rgba(177,66,245,0.15);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;flex-shrink:0;">${s.icon}</span>
            <div style="min-width:0;">
                <div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.label}</div>
                <div style="font-size:15px;font-weight:600;color:#fff;">${s.value}</div>
            </div>
        </div>`).join('');

    document.getElementById('card3').innerHTML = `
        <div style="font-size:15px;font-weight:600;margin-bottom:16px;color:#fff;">📊 Статистика профиля</div>
        ${stData
            ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;">${statsGrid}</div>`
            : '<div style="color:#ff6666;font-size:13px;">Данные статистики недоступны</div>'
        }
        <button class="btn-return" onclick="loadServerDashboard()">← Назад</button>
    `;
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    loadServerDashboard();
    setInterval(() => loadServerDashboard(true), 20000);
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.remove('active');
    }
});