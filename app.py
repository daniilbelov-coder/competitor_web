#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flask веб-приложение для дашборда Instagram Reels мониторинга
"""

import logging
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from apify_client import ApifyClient

from config import APIFY_API_TOKEN, DAYS_BACK

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')
CORS(app)

# Файл для хранения текущего URL аккаунта
ACCOUNT_URL_FILE = 'current_account_url.txt'
DEFAULT_ACCOUNT_URL = 'https://www.instagram.com/vkusvill_ru/'


def get_current_account_url() -> str:
    """Получает текущий URL аккаунта из файла или возвращает дефолтный"""
    if os.path.exists(ACCOUNT_URL_FILE):
        try:
            with open(ACCOUNT_URL_FILE, 'r', encoding='utf-8') as f:
                url = f.read().strip()
                if url:
                    return url
        except Exception as e:
            logger.error(f"Ошибка при чтении URL аккаунта: {e}")
    return DEFAULT_ACCOUNT_URL


def save_account_url(url: str) -> None:
    """Сохраняет URL аккаунта в файл"""
    try:
        with open(ACCOUNT_URL_FILE, 'w', encoding='utf-8') as f:
            f.write(url.strip())
        logger.info(f"URL аккаунта сохранен: {url}")
    except Exception as e:
        logger.error(f"Ошибка при сохранении URL аккаунта: {e}")
        raise


def extract_username_from_url(url: str) -> str:
    """Извлекает username из URL Instagram"""
    url = url.strip()
    if url.endswith('/'):
        url = url[:-1]
    if '/instagram.com/' in url:
        parts = url.split('/instagram.com/')
        if len(parts) > 1:
            username = parts[1].split('/')[0]
            return username
    return url


def scrape_account_reels(username: str, account_url: str, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
    """
    Скрапит Reels для указанного аккаунта через Apify
    """
    try:
        logger.info(f"Начинаю скрапинг аккаунта: {username} ({account_url})")
        
        apify_client = ApifyClient(APIFY_API_TOKEN)
        
        run_input = {
            "directUrls": [account_url],
            "resultsLimit": 10,
            "resultsType": "posts",
            "searchType": "user"
        }
        
        logger.info(f"Параметры запроса к Apify: {run_input}")
        
        run = apify_client.actor("apify/instagram-scraper").call(run_input=run_input)
        
        dataset_items = list(apify_client.dataset(run["defaultDatasetId"]).iterate_items())
        
        logger.info(f"Получено {len(dataset_items)} элементов")
        
        # Проверяем наличие ошибок
        if len(dataset_items) > 0:
            first_item = dataset_items[0]
            if "error" in first_item:
                error_msg = first_item.get("error", "Неизвестная ошибка")
                error_desc = first_item.get("errorDescription", "Нет описания")
                logger.error(f"Ошибка от Apify для {username}: {error_msg} - {error_desc}")
                
                return {
                    "account": username,
                    "accountUrl": account_url,
                    "followerCount": 0,
                    "reels": [],
                    "error": f"{error_msg}: {error_desc}"
                }
        
        if not dataset_items:
            logger.warning(f"Не найдено данных для аккаунта {username}")
            return {
                "account": username,
                "accountUrl": account_url,
                "followerCount": 0,
                "reels": []
            }
        
        # Извлекаем количество подписчиков
        follower_count = 1000000
        for item in dataset_items:
            if "followerCount" in item:
                follower_count = item.get("followerCount", 1000000)
                break
        
        # Вычисляем дату начала и конца периода
        if start_date is None:
            period_start_date = datetime.now() - timedelta(days=DAYS_BACK)
        else:
            period_start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if end_date is None:
            period_end_date = datetime.now()
        else:
            period_end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Фильтруем ТОЛЬКО Reels за указанный период
        posts = []
        for item in dataset_items:
            if "error" in item:
                continue
            
            if item.get("type") == "user" or ("username" in item and "url" not in item and "shortCode" not in item):
                continue
            
            item_type = str(item.get("type", "")).lower()
            product_type = str(item.get("productType", "")).lower()
            url = item.get("url", "") or ""
            
            is_reel = False
            if item_type == "video" and product_type == "clips":
                is_reel = True
            elif item_type in ["reels", "reel"]:
                is_reel = True
            elif "/reel/" in url.lower():
                is_reel = True
            elif item.get("videoViewCount") is not None and product_type == "clips":
                is_reel = True
            
            if is_reel:
                timestamp_str = item.get("timestamp", "")
                if timestamp_str:
                    try:
                        post_date = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                        post_date_local = post_date.replace(tzinfo=None)
                        if post_date_local < period_start_date or post_date_local > period_end_date:
                            continue
                    except (ValueError, AttributeError):
                        pass
                
                post_data = {
                    "account": username,
                    "url": url,
                    "shortCode": item.get("shortCode", "") or item.get("id", ""),
                    "caption": item.get("caption", "") or "",
                    "likesCount": item.get("likesCount", 0) or 0,
                    "commentsCount": item.get("commentsCount", 0) or 0,
                    "viewsCount": item.get("videoViewCount", 0) or item.get("videoPlayCount", 0) or 0,
                    "timestamp": timestamp_str,
                    "type": "Reel"
                }
                posts.append(post_data)
                
                if len(posts) >= 10:
                    break
        
        logger.info(f"Найдено {len(posts)} Reels")
        
        return {
            "account": username,
            "accountUrl": account_url,
            "followerCount": follower_count,
            "reels": posts
        }
        
    except Exception as e:
        logger.error(f"Ошибка при скрапинге аккаунта {username}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "account": username,
            "accountUrl": account_url,
            "followerCount": 0,
            "reels": [],
            "error": str(e)
        }


def calculate_engagement_rate(reels: List[Dict], follower_count: int) -> List[Dict]:
    """Вычисляет Engagement Rate для каждого Reel"""
    if follower_count == 0:
        follower_count = 1
        
    for reel in reels:
        total_engagement = reel.get("likesCount", 0) + reel.get("commentsCount", 0)
        er = (total_engagement / follower_count) * 100
        reel["er"] = round(er, 2)
        reel["engagement"] = total_engagement
    
    return reels


@app.route('/')
def index():
    """Главная страница дашборда"""
    return render_template('index.html')


@app.route('/api/account-url', methods=['GET'])
def get_account_url():
    """Получить текущий URL аккаунта"""
    url = get_current_account_url()
    return jsonify({"url": url})


@app.route('/api/account-url', methods=['POST'])
def update_account_url():
    """Обновить URL аккаунта"""
    try:
        data = request.get_json()
        new_url = data.get('url', '').strip()
        
        if not new_url:
            return jsonify({"error": "URL не может быть пустым"}), 400
        
        if 'instagram.com' not in new_url:
            return jsonify({"error": "URL должен содержать instagram.com"}), 400
        
        save_account_url(new_url)
        return jsonify({"success": True, "url": new_url})
    except Exception as e:
        logger.error(f"Ошибка при обновлении URL: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/data', methods=['GET'])
def get_data():
    """Получить данные о Reels"""
    try:
        account_url = get_current_account_url()
        username = extract_username_from_url(account_url)
        
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            except ValueError:
                logger.warning(f"Неверный формат start_date: {start_date_str}")
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            except ValueError:
                logger.warning(f"Неверный формат end_date: {end_date_str}")
        
        account_data = scrape_account_reels(username, account_url, start_date, end_date)
        
        if account_data.get("reels"):
            reels_with_er = calculate_engagement_rate(
                account_data["reels"],
                account_data["followerCount"]
            )
            account_data["reels"] = reels_with_er
        
        if start_date and end_date:
            period_start = start_date
            period_end = end_date
        elif start_date:
            period_start = start_date
            period_end = datetime.now()
        elif end_date:
            period_start = datetime.now() - timedelta(days=DAYS_BACK)
            period_end = end_date
        else:
            period_end = datetime.now()
            period_start = period_end - timedelta(days=DAYS_BACK)
        
        response_data = {
            "account": account_data.get("account", username),
            "accountUrl": account_data.get("accountUrl", account_url),
            "followerCount": account_data.get("followerCount", 0),
            "period": {
                "start": period_start.strftime("%d.%m.%Y"),
                "end": period_end.strftime("%d.%m.%Y")
            },
            "reels": account_data.get("reels", []),
            "error": account_data.get("error")
        }
        
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Ошибка при получении данных: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    
    port = int(os.getenv('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)

