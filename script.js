// =========================================================================
// НАСТРОЙКА: Вставьте вашу ссылку веб-приложения Google Apps Script (/exec)
// =========================================================================
const SUPABASE_URL = "https://zrwfbyjlyohbygguwfpo.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_ZaFXrDhp8Tx5p_X93DB7wQ_4wPZzyk8";
const TABLE_NAME = "albums_to_listen"; // Имя вашей таблицы в Supabase
// =========================================================================

// Базовый заголовок для авторизации запросов в Supabase
const sHeaders = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
};

let queueAlbums = [];
let activeSessions =[];
const serviceNames = { Yandex: "Yandex Music", Spotify: "Spotify", YTMusic: "YouTube Music", Qobuz: "Qobuz", Deezer: "Deezer" };
let lastGeneratedAlbum = null;
let lastGeneratedServiceKey = null;

window.onload = function() {
    loadFromCloud();
};

async function loadFromCloud() {
    try {
        // Запрашиваем данные напрямую из Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=*`, {
            method: "GET",
            headers: sHeaders
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Ответ сервера Google:", errText);
            throw new Error(`Статус сервера: ${response.status}`);
        }
        
        const data = await response.json();
        
        queueAlbums = [];
        activeSessions = [];
        
        data.forEach(item => {
            // Проверяем, что объект пришел корректным и содержит поле статуса
            if (item) {
                const status = item.listened ? item.listened.toString().trim().toLowerCase() : "";
                
                if (status === "listening") {
                    activeSessions.push(item);
                } else if (status !== "да" && status !== "yes" && status !== "true" && status !== "added" && status !== "listening") {
                    queueAlbums.push(item);
                }
            }
        });

        const counter = document.getElementById('countQueue');
        if (counter) counter.innerText = queueAlbums.length;

        renderList();
        renderActiveSessions();
    } catch (e) {
        alert("Ошибка загрузки данных из таблицы:\n" + e.message + "\n\nПроверьте, что в Apps Script выбрано 'Доступ: Все' и создана 'Новая версия'!");
    }
}

// ОТРИСОВКА СПИСКА ОЧЕРЕДИ
function renderList() {
    const container = document.getElementById('listContainer');
    if (!container) return;
    container.innerHTML = "";

    if (queueAlbums.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#666;padding:15px;font-size:13px;">Все альбомы прослушаны! 🎉</div>';
        return;
    }

    const limit = Math.min(queueAlbums.length, 30);
    for (let i = 0; i < limit; i++) {
        const item = document.createElement('div');
        item.style.padding = "6px 10px";
        item.style.marginBottom = "5px";
        item.style.background = "#1e1e1e";
        item.style.borderRadius = "6px";
        item.style.fontSize = "13px";
        item.style.borderLeft = "4px solid #1db954";
        item.innerText = queueAlbums[i].album;
        container.appendChild(item);
    }

    if (queueAlbums.length > 30) {
        const more = document.createElement('div');
        more.style.textAlignment = "center";
        more.style.color = "#666";
        more.style.fontSize = "12px";
        more.style.marginTop = "8px";
        more.innerText = `... и еще ${queueAlbums.length - 30} альбомов в очереди`;
        container.appendChild(more);
    }
}

// Отрисовка НОВОГО фрейма активных сессий прослушивания
function renderActiveSessions() {
    const container = document.getElementById('activeSessionsContainer');
    if (!container) return;
    container.innerHTML = "";

    if (activeSessions.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#888;padding:12px;font-size:13px;font-style:italic;">Нет активных сессий</div>';
        return;
    }

    activeSessions.forEach((album, index) => {
        const item = document.createElement('div');
        item.className = "session-item";
        item.style.flexDirection = "column"; // Разворачиваем карточку вертикально для удобства поля ввода
        item.style.alignItems = "stretch";
    
        const safeName = album.album.replace(/'/g, "\\'");

        // Генерируем уникальный ID для инпута этой сессии, используя индекс
        const inputId = `sessMemo_${index}`;

        // Если заметка уже есть в таблице, подставляем её как дефолтное значение (value)
        const currentMemoValue = album.note ? album.note.replace(/"/g, '&quot;') : "";
    
        // Кнопка быстрого закрытия сессии прямо из списка
        item.innerHTML = `
            <div class="session-info">
                <span class="session-badge">${album.service} | </span> 
                <strong>${album.album}</strong>
            </div>
            
            <!-- Поле ввода комментария прямо внутри карточки сессии -->
            <div style="margin-bottom: 10px;">
                <input type="text" id="${inputId}" class="memo-input" style="margin-top: 0; width: 100%;" 
                       placeholder="Добавить финальные впечатления..." value="${currentMemoValue}">
            </div>
            
            <div class="session-actions" style="justify-content: flex-end; width: 100%; border-top: 1px solid #2c3e50; padding-top: 8px;">
                <!-- Передаем ID инпута в функцию закрытия сессии -->
                <button class="sess-btn liked" onclick="finishSessionDirectly('${album.album}', 'liked', '${inputId}')">👍</button>
                <button class="sess-btn ok" onclick="finishSessionDirectly('${album.album}', 'ok', '${inputId}')">ok</button>
                <button class="sess-btn meh" onclick="finishSessionDirectly('${album.album}', 'meh', '${inputId}')">meh</button>
                <button class="sess-btn disliked" onclick="finishSessionDirectly('${album.album}', 'disliked', '${inputId}')">👎</button>
            </div>
        `;
        container.appendChild(item);
    });
}
// Закрытие сессии напрямую из фрейма кнопками
async function finishSessionDirectly(albumName, ratingValue, inputId) {
    // Находим инпут на экране по его уникальному ID и забираем текст
    const inputElement = document.getElementById(inputId);
    const finalMemo = inputElement ? inputElement.value.trim() : "";

    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?album=eq.${encodeURIComponent(albumName)}`;
        
        await fetch(url, {
            method: 'PATCH',
            headers: sHeaders,
            body: JSON.stringify({
                listened: 'true',
                rating: ratingValue,
                note: finalMemo
            })
        });
        loadFromCloud();
    } catch (e) {
        alert("Ошибка: " + e.message);
    }
}
// Команда "Слушаю сейчас" (Фиксация во фрейме и таблице)
async function markAsListening() {
    if (!lastGeneratedAlbum || !lastGeneratedServiceKey) return;
    const memoValue = document.getElementById('albumMemoInput').value.trim();
    
    document.getElementById('resultBox').style.display = 'none';
    
    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?album=eq.${encodeURIComponent(lastGeneratedAlbum.album)}`;
        
        await fetch(url, {
            method: 'PATCH',
            headers: sHeaders,
            body: JSON.stringify({ 
                listened: 'listening',
                service: serviceNames[lastGeneratedServiceKey],
                note: memoValue
            })
        });
        document.getElementById('albumMemoInput').value = "";
        loadFromCloud(); 
    } catch (e) {
        alert("Ошибка старта сессии: " + e.message);
    }
}

// ДОБАВЛЕНИЕ НОВОГО АЛЬБОМА ИЗ ВИДЖЕТА В ТАБЛИЦУ
async function addAlbums() {
    const input = document.getElementById('newAlbumsInput').value;
    const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    document.getElementById('newAlbumsInput').value = "Добавление...";
    
    // Перебираем и отправляем в таблицу построчно
    for (let line of lines) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, { 
                method: 'POST',
                headers: sHeaders,
                body: JSON.stringify({ 
                    album: line, 
                    listened: '',
                    rating: '',
                    note: '',
                    service: ''
                }) 
            });
        } catch (e) {
            console.error("Ошибка добавления строки: " + line);
        }
    }

    document.getElementById('newAlbumsInput').value = "";
    alert(`Успешно добавлено релизов: ${lines.length}`);
    loadFromCloud(); // Перезагружаем список
}

// ОТМЕТКА ПРОСЛУШАНО + ОЦЕНКА ИЗ ВИДЖЕТА В ТАБЛИЦУ
async function rateLastAlbum(ratingValue) {
    if (!lastGeneratedAlbum) return;

    const memoValue = document.getElementById('albumMemoInput').value.trim();
  
    document.getElementById('resultBox').style.display = 'none';
    
    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?album=eq.${encodeURIComponent(lastGeneratedAlbum.album)}`;
        
        await fetch(url, {
            method: 'PATCH',
            headers: sHeaders,
            body: JSON.stringify({ 
                listened: 'true',
                rating: ratingValue,
                note: memoValue
            })
        });
        // Очищаем поле ввода для следующего раза
        document.getElementById('albumMemoInput').value = "";
        loadFromCloud(); // Обновляем список, альбом исчезнет из очереди
    } catch (e) {
        alert("Ошибка отправки оценки в таблицу: " + e.message);
    }
}

// РАНДОМИЗАТОР
function generateSelection() {
    const checkboxes = document.querySelectorAll('.services-group input:checked');
    const keys = Array.from(checkboxes).map(cb => cb.value);

    if (queueAlbums.length === 0) {
        alert('Очередь альбомов пуста!');
        return;
    }
    if (keys.length === 0) {
        alert('Выберите хотя бы один сервис!');
        return;
    }

    const randomAlbum = queueAlbums[Math.floor(Math.random() * queueAlbums.length)];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    
    lastGeneratedAlbum = randomAlbum; // Запоминаем, какой альбом выпал
    lastGeneratedServiceKey = randomKey;

    document.getElementById('resAlbum').innerText = randomAlbum.album;
    document.getElementById('resService').innerText = serviceNames[randomKey];
    document.getElementById('albumMemoInput').value = randomAlbum.note ? randomAlbum.note : "";

    const q = encodeURIComponent(randomAlbum.album);
    let url = "";

    if (randomKey === 'Yandex') url = "https://music.yandex.ru/search?text=" + q;
    else if (randomKey === 'Spotify') url = "https://open.spotify.com/search/" + q;
    else if (randomKey === 'YTMusic') url = "https://music.youtube.com/search?q=" + q;
    else if (randomKey === 'Deezer') url = "https://www.deezer.com/search/" + q + "/album";
    else if (randomKey === 'Qobuz') url = "https://play.qobuz.com/search?query=" + q + "&i=all";

    const btn = document.getElementById('searchLink');
    btn.href = url;
    btn.style.background = randomKey === 'Yandex' ? '#ffcc00' : randomKey === 'Spotify' ? '#1db954' : randomKey === 'YTMusic' ? '#ff0000' : '#000000';
    btn.style.color = randomKey === 'Yandex' ? '#121212' : '#fff';

    document.getElementById('resultBox').style.display = 'block';
}