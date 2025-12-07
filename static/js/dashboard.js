// Chart Defaults
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
Chart.defaults.color = '#64748b';

let viewsChart = null;
let erChart = null;
let engagementChart = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDateInputs();
    loadAccountUrl();
    loadData();
    
    document.getElementById('update-url-btn').addEventListener('click', updateAccountUrl);
    document.getElementById('refresh-btn').addEventListener('click', loadData);
    document.getElementById('quick-period-btn').addEventListener('click', showQuickPeriodMenu);
    
    // Auto-load on date change
    document.getElementById('start-date').addEventListener('change', () => setTimeout(loadData, 300));
    document.getElementById('end-date').addEventListener('change', () => setTimeout(loadData, 300));
});

function initializeDateInputs() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    document.getElementById('end-date').value = formatDateForInput(endDate);
    document.getElementById('start-date').value = formatDateForInput(startDate);
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function loadAccountUrl() {
    try {
        const response = await fetch('/api/account-url');
        const data = await response.json();
        if (data.url) document.getElementById('account-url').value = data.url;
    } catch (error) {
        console.error('Error loading URL:', error);
    }
}

async function updateAccountUrl() {
    const urlInput = document.getElementById('account-url');
    const newUrl = urlInput.value.trim();
    
    if (!newUrl) return showError('URL cannot be empty');
    if (!newUrl.includes('instagram.com')) return showError('Must be a valid Instagram URL');
    
    try {
        const response = await fetch('/api/account-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: newUrl })
        });
        const data = await response.json();
        if (data.error) showError(data.error);
        else {
            loadData();
        }
    } catch (error) {
        showError(error.message);
    }
}

async function loadData() {
    showLoading();
    hideError();
    document.getElementById('dashboard').style.display = 'none';
    
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        let url = `/api/data?start_date=${startDate}&end_date=${endDate}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            showError('Data Error: ' + data.error);
            return;
        }
        
        displayData(data);
    } catch (error) {
        showError('Network Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayData(data) {
    document.getElementById('dashboard').style.display = 'block';
    
    document.getElementById('account-name').textContent = `@${data.account}`;
    document.getElementById('period-range').textContent = `${data.period.start} - ${data.period.end}`;
    document.getElementById('follower-count').textContent = formatNumber(data.followerCount) + ' Followers';
    document.getElementById('total-reels').textContent = data.reels.length;
    
    const avgER = data.reels.length > 0 
        ? data.reels.reduce((sum, reel) => sum + (reel.er || 0), 0) / data.reels.length 
        : 0;
    document.getElementById('avg-er').textContent = avgER.toFixed(2) + '%';
    
    updateCharts(data.reels);
    updateTable(data.reels);
}

function updateCharts(reels) {
    if (!reels.length) return;
    
    const sorted = [...reels].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const labels = sorted.map((r, i) => r.timestamp ? new Date(r.timestamp).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) : `#${i+1}`);
    
    // Views Chart
    if (viewsChart) viewsChart.destroy();
    viewsChart = new Chart(document.getElementById('views-chart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Views',
                data: sorted.map(r => r.viewsCount),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
    
    // ER Chart
    if (erChart) erChart.destroy();
    erChart = new Chart(document.getElementById('er-chart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ER %',
                data: sorted.map(r => r.er),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
    
    // Engagement Chart
    if (engagementChart) engagementChart.destroy();
    engagementChart = new Chart(document.getElementById('engagement-chart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Likes',
                    data: sorted.map(r => r.likesCount),
                    backgroundColor: '#f43f5e',
                    borderRadius: 4
                },
                {
                    label: 'Comments',
                    data: sorted.map(r => r.commentsCount),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }
            ]
        },
        options: { responsive: true }
    });
}

function updateTable(reels) {
    const tbody = document.getElementById('posts-tbody');
    tbody.innerHTML = '';
    
    const sorted = [...reels].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">No data found</td></tr>';
        return;
    }
    
    sorted.forEach(reel => {
        const row = tbody.insertRow();
        const date = reel.timestamp ? new Date(reel.timestamp).toLocaleDateString('ru-RU') : '-';
        
        row.innerHTML = `
            <td>${date}</td>
            <td class="post-caption" title="${reel.caption}">${reel.caption || '-'}</td>
            <td>${formatNumber(reel.viewsCount)}</td>
            <td>${formatNumber(reel.likesCount)}</td>
            <td>${formatNumber(reel.commentsCount)}</td>
            <td>${(reel.er || 0).toFixed(2)}%</td>
            <td>${reel.url ? `<a href="${reel.url}" target="_blank" class="post-link">Open</a>` : '-'}</td>
        `;
    });
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(msg) {
    const el = document.getElementById('error-message');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

// Quick Menu Logic
function showQuickPeriodMenu() {
    // Check if exists
    if (document.querySelector('.quick-period-menu')) {
        document.querySelector('.quick-period-menu').remove();
        return;
    }

    const menu = document.createElement('div');
    menu.className = 'quick-period-menu';
    menu.innerHTML = `
        <div class="quick-period-item" onclick="setPeriod(7)">Last 7 Days</div>
        <div class="quick-period-item" onclick="setPeriod(14)">Last 14 Days</div>
        <div class="quick-period-item" onclick="setPeriod(30)">Last 30 Days</div>
        <div class="quick-period-item" onclick="setPeriod(0)">Today</div>
    `;
    
    const btn = document.getElementById('quick-period-btn');
    const rect = btn.getBoundingClientRect();
    
    // Position relative to button (simple approach)
    // We append to body to avoid overflow issues
    document.body.appendChild(menu);
    menu.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    menu.style.left = (rect.left + window.scrollX) + 'px';
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!menu.contains(e.target) && e.target !== btn) {
                menu.remove();
                document.removeEventListener('click', close);
            }
        });
    }, 100);
}

function setPeriod(days) {
    const end = new Date();
    const start = new Date();
    if (days > 0) start.setDate(start.getDate() - days);
    else start.setHours(0,0,0,0);
    
    document.getElementById('start-date').value = formatDateForInput(start);
    document.getElementById('end-date').value = formatDateForInput(end);
    loadData();
    
    const menu = document.querySelector('.quick-period-menu');
    if(menu) menu.remove();
}
