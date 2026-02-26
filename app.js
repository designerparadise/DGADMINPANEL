// ==========================================
// КОНФИГУРАЦИЯ
// ==========================================
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

// ==========================================
// АВАТАРЫ
// avatarOrSkin.id + extension → прямая ссылка на CDN
// ==========================================
const avatarCache = {};

function buildAvatarUrls(login, avatarOrSkin) {
    const urls = [];
    if (avatarOrSkin?.id) {
        const ext = avatarOrSkin.extension || 'png';
        const id = avatarOrSkin.id;
        // Варианты CDN путей — один из них должен сработать
        urls.push(`https://loliland.ru/uploads/avatars/${id}.${ext}`);
        urls.push(`https://loliland.ru/static/avatars/${id}.${ext}`);
        urls.push(`https://loliland.ru/api/avatar/${id}`);
        urls.push(`https://loliland.ru/cdn/avatars/${id}.${ext}`);
    }
    urls.push(`https://loliland.ru/avatar/${login}/64`);
    urls.push(`https://loliland.ru/skin/${login}/avatar`);
    return urls;
}

async function getAvatar(login, avatarOrSkin) {
    const key = login;
    if (avatarCache[key]) return avatarCache[key];

    const urlsToTry = buildAvatarUrls(login, avatarOrSkin);

    for (const src of urlsToTry) {
        try {
            const res = await fetch(PROXY + encodeURIComponent(src));
            if (!res.ok) continue;
            const ct = res.headers.get('content-type') || '';
            if (!ct.startsWith('image/')) continue;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            avatarCache[key] = url;
            return url;
        } catch {
            continue;
        }
    }
    return FALLBACK_AVATAR;
}

function setAvatar(imgEl, login, avatarOrSkin) {
    imgEl.src = FALLBACK_AVATAR;
    getAvatar(login, avatarOrSkin).then(url => { imgEl.src = url; });
}

// ==========================================
// УТИЛИТЫ
// ==========================================
const format = {
    time: (min) => {
        if (!min) return '0м';
        return min >= 60 ? `${Math.floor(min/60)}ч ${min%60}м` : `${min}м`;
    },
    num: (n) => (n || 0).toLocaleString('ru-RU'),
    role: (role) => {
        const map = {
            curator:   ['#f5a623', 'Куратор'],
            admin:     ['#ff4444', 'Админ'],
            moderator: ['#ff8800', 'Модератор'],
            legendary: ['#ffd700', 'Легендарный'],
        };
        return map[role] || ['#b142f5', 'Игрок'];
    }
};

function render(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function showSkeletons() {
    render('card1', `<div class="skeleton" style="height:40px;width:120px;margin-bottom:10px;"></div><div class="skeleton" style="height:16px;width:180px;"></div>`);
    render('card2', `<div class="skeleton" style="height:80px;width:100%;"></div>`);
    render('card3', `<div class="skeleton" style="height:20px;width:100%;margin-bottom:8px;"></div><div class="skeleton" style="height:20px;width:60%;"></div>`);
}

// ==========================================
// 1. ДАШБОРД
// ==========================================
async function loadServerDashboard(isSilent = false) {
    if (isSilent && currentMode !== 'dashboard') return;
    currentMode = 'dashboard';

    if (!isSilent) showSkeletons();

    const data = await request('/server/monitoring');
    if (!data) return;

    render('card1', `
        <div style="font-size:36px;font-weight:700;">${format.num(data.records.onlineCurrent)}</div>
        <div style="color:var(--text-muted);font-size:14px;margin-top:5px;">Общий онлайн проекта</div>
        <div style="height:100px;margin-top:20px;">
            <svg viewBox="0 0 100 50" style="width:100%;height:100%;opacity:0.6;">
                <path d="M0,45 Q20,45 40,20 T100,10" fill="none" stroke="var(--purple-glow)" stroke-width="2" style="filter:drop-shadow(0 0 4px var(--purple-glow))"/>
            </svg>
        </div>
    `);

    const dg = data.servers?.dark_galaxy?.online || 0;
    const tm = data.servers?.techno_magic_rpg?.online || 0;
    render('card2', `
        <div style="display:flex;flex-direction:column;gap:20px;">
            <div>
                <div style="font-size:28px;font-weight:700;color:var(--purple-light);">${dg}<span style="font-size:12px;opacity:0.5;"> / 100</span></div>
                <div style="font-size:11px;opacity:0.5;">DarkGalaxy</div>
            </div>
            <div>
                <div style="font-size:28px;font-weight:700;">${tm}<span style="font-size:12px;opacity:0.5;"> / 1000</span></div>
                <div style="font-size:11px;opacity:0.5;">TechnoMagic RPG</div>
            </div>
        </div>
    `);

    render('card3', `<div style="font-size:12px;opacity:0.5;">Мониторинг обновлён: ${new Date().toLocaleTimeString()}</div>`);
}

// ==========================================
// 2. ПОИСК ИГРОКОВ
// ==========================================
const input = document.getElementById('playerInput');
const drop = document.getElementById('searchResults');
let searchTimer;

input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { drop.classList.remove('active'); return; }

    drop.innerHTML = '<div class="search-item" style="opacity:0.5;">📡 Ищем...</div>';
    drop.classList.add('active');

    searchTimer = setTimeout(async () => {
        const res = await request(`/user/search?limit=5&login=${encodeURIComponent(q)}`);
        const players = res?.users?.elements || res?.elements || (Array.isArray(res) ? res : []);

        if (players.length === 0) {
            drop.innerHTML = '<div class="search-item" style="opacity:0.5;">Никого не нашли</div>';
            return;
        }

        drop.innerHTML = '';
        for (const p of players) {
            const login = p.login || 'Unknown';
            const uuid = p.uuid || p.id || '';
            const [roleColor, roleLabel] = format.role(p.roles?.entry?.role);

            const item = document.createElement('div');
            item.className = 'search-item';
            item.innerHTML = `
                <img class="player-head" src="${FALLBACK_AVATAR}">
                <div>
                    <div style="font-size:13px;font-weight:600;">${login}</div>
                    <div style="font-size:10px;color:${roleColor};">${roleLabel}</div>
                </div>
            `;
            setAvatar(item.querySelector('img'), login, p.avatarOrSkin);
            item.onclick = () => loadPlayerProfile(login, uuid, p.avatarOrSkin);
            drop.appendChild(item);
        }
    }, 400);
});

// ==========================================
// 3. ПРОФИЛЬ ИГРОКА
// ==========================================
async function loadPlayerProfile(login, uuid, avatarOrSkin) {
    if (!uuid) return;
    currentMode = 'profile';
    drop.classList.remove('active');
    input.value = login;
    showSkeletons();

    const [pt, st] = await Promise.all([
        request(`/user/profile/playtime/${uuid}?period=m`),
        request(`/user/profile/statistics/${uuid}`)
    ]);

    const dateEntries = Object.entries(pt || {}).filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k));
    const totalTime = dateEntries.reduce((s, [, v]) => s + (Number(v) || 0), 0);
    const curMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const monthTime = dateEntries.filter(([k]) => k.startsWith(curMonth)).reduce((s,[,v]) => s+(Number(v)||0), 0);

    render('card1', `
        <div style="display:flex;align-items:center;gap:15px;">
            <img id="profileAvatar" src="${FALLBACK_AVATAR}" style="width:72px;height:72px;border-radius:10px;border:2px solid var(--purple-glow);box-shadow:0 0 20px rgba(177,66,245,0.4);">
            <div>
                <div style="font-size:24px;font-weight:700;">${login}</div>
                <div style="font-size:10px;opacity:0.4;font-family:monospace;margin-top:3px;">${uuid}</div>
            </div>
        </div>
    `);
    setAvatar(document.getElementById('profileAvatar'), login, avatarOrSkin);

    render('card2', `
        <div style="font-size:14px;font-weight:600;margin-bottom:15px;opacity:0.8;">⏱ Активность</div>
        <div style="display:flex;gap:10px;">
            <div style="flex:1;background:rgba(177,66,245,0.08);border:1px solid rgba(177,66,245,0.2);border-radius:10px;padding:15px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:var(--purple-light);">${format.time(totalTime)}</div>
                <div style="font-size:10px;opacity:0.5;margin-top:3px;">Всего</div>
            </div>
            <div style="flex:1;background:rgba(177,66,245,0.08);border:1px solid rgba(177,66,245,0.2);border-radius:10px;padding:15px;text-align:center;">
                <div style="font-size:20px;font-weight:700;color:var(--purple-light);">${format.time(monthTime)}</div>
                <div style="font-size:10px;opacity:0.5;margin-top:3px;">За месяц</div>
            </div>
        </div>
    `);

    const g = st?.game || {};
    const coins = st?.coins || {};
    const r = st?.ratings || {};
    const stats = [
        ['⛏️', 'Сломано блоков', format.num(g.blocksBreaked)],
        ['🧱', 'Поставлено',     format.num(g.blocksPlaced)],
        ['⚔️', 'Убийств',        format.num(g.playersKilled)],
        ['💀', 'Смертей',        format.num(g.deaths)],
        ['🐉', 'Мобов убито',    format.num(g.monstersKilled)],
        ['✉️', 'Сообщений',      format.num(g.messages)],
        ['💰', 'Баланс',         format.num(coins.amount)],
        ['📈', 'Заработано',     format.num(coins.income)],
        ['🏆', 'Рейтинг коинов', r.coins > 0 ? `#${r.coins}` : '—'],
        ['❤️', 'Лайков',         format.num(r.likes)],
    ];

    render('card3', `
        <div style="font-size:14px;font-weight:600;margin-bottom:15px;opacity:0.8;">📊 Статистика</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
            ${stats.map(([icon, label, val]) => `
                <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(177,66,245,0.15);border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:18px;">${icon}</span>
                    <div>
                        <div style="font-size:9px;opacity:0.5;">${label}</div>
                        <div style="font-size:15px;font-weight:600;">${val}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn-return" onclick="loadServerDashboard()">← Назад</button>
    `);
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ
// ==========================================
window.onload = () => {
    loadServerDashboard();
    setInterval(() => loadServerDashboard(true), 30000);
};

document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.remove('active');
});
