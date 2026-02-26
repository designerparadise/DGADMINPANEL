const PROXY = "https://loliland-proxy.orbs-bot.workers.dev/?url=";
const API_BASE = "https://loliland.ru/apiv2";
const FALLBACK = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='%232a2a35'/></svg>";

let currentMode = 'dashboard';

async function request(path) {
    const url = `${API_BASE}${path}${path.includes('?') ? '&' : '?'}t=${Date.now()}`;
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        return res.ok ? await res.json() : null;
    } catch (e) { return null; }
}

const getAva = (login) => PROXY + encodeURIComponent(`https://loliland.ru/avatar/${login}/128`);

// --- ЗАГРУЗКА ГЛАВНОЙ ---
async function loadDash(isSilent = false) {
    if (isSilent && currentMode !== 'dashboard') return;
    currentMode = 'dashboard';

    const data = await request('/server/monitoring');
    if (!data) return;

    document.getElementById('card1').innerHTML = `
        <div style="font-size: 40px; font-weight: 800;">${data.records.onlineCurrent}</div>
        <div style="color: #8a8a98; font-size: 13px;">ОБЩИЙ ОНЛАЙН</div>
        <div style="height: 60px; border-bottom: 2px solid var(--purple-glow); opacity: 0.2; margin-top: 10px;"></div>
    `;

    const dg = data.servers?.dark_galaxy?.online || 0;
    const tm = data.servers?.techno_magic_rpg?.online || 0;

    document.getElementById('card2').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
            <p style="font-size:12px;">DarkGalaxy: <b style="color:var(--purple-glow)">${dg}</b></p>
            <p style="font-size:12px;">TechnoMagic: <b>${tm}</b></p>
        </div>
    `;
}

// --- ПОИСК ---
const input = document.getElementById('playerInput');
const drop = document.getElementById('searchResults');

input.oninput = async () => {
    const q = input.value.trim();
    if (q.length < 2) return drop.classList.remove('active');

    const res = await request(`/user/search?limit=5&login=${encodeURIComponent(q)}`);
    const players = res?.users?.elements || [];

    drop.innerHTML = players.map(p => `
        <div class="search-item" onclick="openProfile('${p.login}', '${p.uuid || p.id}')">
            <img src="${getAva(p.login)}" class="player-head" onerror="this.src='${FALLBACK}'">
            <span>${p.login}</span>
        </div>
    `).join('') || '<div class="search-item">Никто не найден</div>';
    drop.classList.add('active');
};

// --- ПРОФИЛЬ (ИСПРАВЛЕНО ВРЕМЯ) ---
async function openProfile(login, uuid) {
    currentMode = 'profile';
    drop.classList.remove('active');
    input.value = login;

    document.getElementById('content').innerHTML = `
        <div class="card full-width">
            <div style="display:flex; align-items:center; gap:20px;">
                <img src="${getAva(login)}" style="width:70px; border-radius:10px; border:2px solid var(--purple-glow);" onerror="this.src='${FALLBACK}'">
                <div><h2 style="font-size:22px;">${login}</h2><p style="font-size:10px; opacity:0.4;">${uuid}</p></div>
            </div>
        </div>
        <div class="card"><h3>Время (месяц)</h3><div id="pt-val" style="font-size:24px; color:var(--purple-light); margin-top:10px;">Загрузка...</div></div>
        <div class="card"><h3>Баланс</h3><div id="balance-val" style="font-size:24px; color:#fff; margin-top:10px;">Загрузка...</div></div>
        <div class="full-width"><button class="btn-return" onclick="location.reload()">← Назад</button></div>
    `;

    const [pt, st] = await Promise.all([
        request(`/user/profile/playtime/${uuid}?period=m`),
        request(`/user/profile/statistics/${uuid}`)
    ]);

    // Исправленный расчет времени
    let totalMin = 0;
    if (pt) {
        // Если API вернуло объект с датами "2026-02-26": 15
        Object.entries(pt).forEach(([k, v]) => {
            if (k.includes('-')) totalMin += (Number(v) || 0);
        });
    }

    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    
    document.getElementById('pt-val').innerText = h > 0 ? `${h}ч ${m}м` : `${m}м`;
    document.getElementById('balance-val').innerText = st?.coins?.amount ? st.coins.amount.toLocaleString() : "0";
}

loadDash();
setInterval(() => loadDash(true), 15000);
document.onclick = (e) => { if (!input.contains(e.target)) drop.classList.remove('active'); };
