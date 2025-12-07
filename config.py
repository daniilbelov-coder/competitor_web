#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Конфигурационный файл для веб-приложения мониторинга Instagram Reels
"""

import os
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

# Apify настройки
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")

# Параметры скрапинга
RESULTS_LIMIT = int(os.getenv("RESULTS_LIMIT", "200"))
DAYS_BACK = int(os.getenv("DAYS_BACK", "7"))

# Валидация обязательных параметров
if not APIFY_API_TOKEN:
    raise ValueError("APIFY_API_TOKEN не установлен")

