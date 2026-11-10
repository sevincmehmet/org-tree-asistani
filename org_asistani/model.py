"""Üç agent'ın (yönetici, çalışan, triyaj) ortak model ayarı."""

import os

from google.adk.models.google_llm import Gemini
from google.genai import types


def gemini_model() -> Gemini:
    # 500/503/504 (anlık sunucu sorunu) tekrar denenir; 429 (kota doldu) denenmez, beklemek işe yaramaz.
    return Gemini(
        model=os.getenv("ORG_ASISTANI_MODEL", "gemini-3.5-flash-lite"),
        retry_options=types.HttpRetryOptions(
            attempts=5, initial_delay=2, max_delay=20, http_status_codes=[500, 503, 504]
        ),
    )
