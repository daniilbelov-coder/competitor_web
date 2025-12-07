// Глобальные переменные для графиков
let viewsChart = null;
let erChart = null;
let engagementChart = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeDateInputs();
    loadAccountUrl();
    loadData();
    
    // Обработчики событий
    document.getElementById('update-url-btn').addEventListener('click', updateAccountUrl);
    document.getElementById('refresh-btn').addEventListener('click', loadData);
    document.getElementById('quick-period-btn').addEventListener('click', showQuickPeriodMenu);
    document.getElementById('account-url').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            updateAccountUrl();
        }
    });
    
    // Автоматическая загрузка данных при изменении дат
    document.getElementById('start-date').addEventListener('change', function() {
        setTimeout(loadData, 300);
    });
    document.getElementById('end-date').addEventListener('change', function() {
        setTimeout(loadData, 300);
    });
});

// Инициализация полей даты значениями по умолчанию
function initializeDateInputs() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    document.getElementById('end-date').value = formatDateForInput(endDate);
    document.getElementById('start-date').value = formatDateForInput(startDate);
}

// Форматирование даты для input type="date" (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Показать меню быстрого выбора периода
function showQuickPeriodMenu() {
    const menu = document.createElement('div');
    menu.className = 'quick-period-menu';
    menu.innerHTML = `
        <div class="quick-period-item" data-days="7">Последние 7 дней</div>
        <div class="quick-period-item" data-days="14">Последние 14 дней</div>
        <div class="quick-period-item" data-days="30">Последние 30 дней</div>
        <div class="quick-period-item" data-days="90">Последние 90 дней</div>
        <div class="quick-period-item" data-days="0">Сегодня</div>
    `;
    
    const oldMenu = document.querySelector('.quick-period-menu');
    if (oldMenu) {
        oldMenu.remove();
    }
    
    document.body.appendChild(menu);
    
    const btn = document.getElementById('quick-period-btn');
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = rect.left + 'px';
    
    menu.querySelectorAll('.quick-period-item').forEach(item => {
        item.addEventListener('click', function() {
            const days = parseInt(this.dataset.days);
            setQuickPeriod(days);
            menu.remove();
        });
    });
    
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// Установить быстрый период
function setQuickPeriod(days) {
    const endDate = new Date();
    const startDate = new Date();
    
    if (days === 0) {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    } else {
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }
    
    document.getElementById('start-date').value = formatDateForInput(startDate);
    document.getElementById('end-date').value = formatDateForInput(endDate);
    
    loadData();
}

// Загрузка текущего URL аккаунта
async function loadAccountUrl() {
    try {
        const response = await fetch('/api/account-url');
        const data = await response.json();
        if (data.url) {
            document.getElementById('account-url').value = data.url;
        }
    } catch (error) {
        console.error('Ошибка при загрузке URL аккаунта:', error);
    }
}

// Обновление URL аккаунта
async function updateAccountUrl() {
    const urlInput = document.getElementById('account-url');
    const newUrl = urlInput.value.trim();
    
    if (!newUrl) {
        showError('URL не может быть пустым');
        return;
    }
    
    if (!newUrl.includes('instagram.com')) {
        showError('URL должен содержать instagram.com');
        return;
    }
    
    try {
        const response = await fetch('/api/account-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: newUrl })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
        } else {
            showSuccess('URL аккаунта успешно обновлен');
            loadData();
        }
    } catch (error) {
        showError('Ошибка при обновлении URL: ' + error.message);
    }
}

// Загрузка данных
async function loadData() {
    showLoading();
    hideError();
    hideDashboard();
    
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        let url = '/api/data';
        const params = new URLSearchParams();
        if (startDate) {
            params.append('start_date', startDate);
        }
        if (endDate) {
            params.append('end_date', endDate);
        }
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            showError('Ошибка при получении данных: ' + data.error);
            return;
        }
        
        displayData(data);
    } catch (error) {
        showError('Ошибка при загрузке данных: ' + error.message);
    }
}

// Отображение данных
function displayData(data) {
    hideLoading();
    showDashboard();
    
    document.getElementById('account-name').textContent = `@${data.account}`;
    document.getElementById('period-range').textContent = `${data.period.start} - ${data.period.end}`;
    document.getElementById('follower-count').textContent = formatNumber(data.followerCount);
    document.getElementById('total-reels').textContent = data.reels.length;
    
    if (data.reels.length > 0) {
        const avgER = data.reels.reduce((sum, reel) => sum + (reel.er || 0), 0) / data.reels.length;
        document.getElementById('avg-er').textContent = avgER.toFixed(2) + '%';
    } else {
        document.getElementById('avg-er').textContent = '0%';
    }
    
    updateCharts(data.reels);
    updateTable(data.reels);
}

// Обновление графиков
function updateCharts(reels) {
    if (reels.length === 0) {
        return;
    }
    
    const sortedReels = [...reels].sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dateB - dateA;
    });
    
    const labels = sortedReels.map((reel, index) => {
        if (reel.timestamp) {
            const date = new Date(reel.timestamp);
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }
        return `Пост ${index + 1}`;
    });
    
    // График просмотров
    const viewsCtx = document.getElementById('views-chart').getContext('2d');
    if (viewsChart) {
        viewsChart.destroy();
    }
    viewsChart = new Chart(viewsCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Просмотры',
                data: sortedReels.map(r => r.viewsCount || 0),
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Просмотры: ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
    
    // График Engagement Rate
    const erCtx = document.getElementById('er-chart').getContext('2d');
    if (erChart) {
        erChart.destroy();
    }
    erChart = new Chart(erCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ER (%)',
                data: sortedReels.map(r => r.er || 0),
                borderColor: 'rgba(17, 24, 39, 1)',
                backgroundColor: 'rgba(17, 24, 39, 0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: 'rgba(17, 24, 39, 1)',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2) + '%';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'ER: ' + context.parsed.y.toFixed(2) + '%';
                        }
                    }
                }
            }
        }
    });
    
    // График лайков и комментариев
    const engagementCtx = document.getElementById('engagement-chart').getContext('2d');
    if (engagementChart) {
        engagementChart.destroy();
    }
    engagementChart = new Chart(engagementCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Лайки',
                    data: sortedReels.map(r => r.likesCount || 0),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Комментарии',
                    data: sortedReels.map(r => r.commentsCount || 0),
                    backgroundColor: 'rgba(17, 24, 39, 0.8)',
                    borderColor: 'rgba(17, 24, 39, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// Обновление таблицы
function updateTable(reels) {
    const tbody = document.getElementById('posts-tbody');
    tbody.innerHTML = '';
    
    if (reels.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.textContent = 'Нет данных для отображения';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        return;
    }
    
    const sortedReels = [...reels].sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dateB - dateA;
    });
    
    sortedReels.forEach(reel => {
        const row = tbody.insertRow();
        
        // Дата
        const dateCell = row.insertCell();
        if (reel.timestamp) {
            const date = new Date(reel.timestamp);
            dateCell.textContent = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } else {
            dateCell.textContent = '-';
        }
        
        // Описание
        const captionCell = row.insertCell();
        captionCell.className = 'post-caption';
        captionCell.title = reel.caption || 'Без описания';
        captionCell.textContent = reel.caption || 'Без описания';
        
        // Просмотры
        const viewsCell = row.insertCell();
        viewsCell.textContent = formatNumber(reel.viewsCount || 0);
        
        // Лайки
        const likesCell = row.insertCell();
        likesCell.textContent = formatNumber(reel.likesCount || 0);
        
        // Комментарии
        const commentsCell = row.insertCell();
        commentsCell.textContent = formatNumber(reel.commentsCount || 0);
        
        // ER
        const erCell = row.insertCell();
        erCell.textContent = (reel.er || 0).toFixed(2) + '%';
        
        // Ссылка
        const linkCell = row.insertCell();
        if (reel.url) {
            const link = document.createElement('a');
            link.href = reel.url;
            link.target = '_blank';
            link.className = 'post-link';
            link.textContent = 'Открыть';
            linkCell.appendChild(link);
        } else {
            linkCell.textContent = '-';
        }
    });
}

// Форматирование чисел
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Показать/скрыть элементы
function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
}

function hideDashboard() {
    document.getElementById('dashboard').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.style.background = '#f0fdf4';
    errorDiv.style.color = '#15803d';
    errorDiv.style.borderLeftColor = '#22c55e';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
        // Reset to error styles (will be applied by CSS class anyway when error occurs)
        errorDiv.style.background = ''; 
        errorDiv.style.color = '';
        errorDiv.style.borderLeftColor = '';
    }, 3000);
}

