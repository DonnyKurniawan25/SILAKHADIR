"""
Captcha sederhana berbasis soal matematika.
Challenge disimpan di Django cache selama 10 menit.
"""
import random
import uuid

from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView


CACHE_PREFIX = 'captcha:'
TTL = 600  # 10 menit


def _generate_challenge():
    """Return (question_str, answer_int)."""
    a = random.randint(2, 12)
    b = random.randint(2, 12)
    op = random.choice(['+', '-', '×'])
    if op == '+':
        return f'{a} + {b}', a + b
    if op == '-':
        # Pastikan hasilnya tidak negatif
        if b > a:
            a, b = b, a
        return f'{a} - {b}', a - b
    # Perkalian dengan angka kecil agar mudah
    a = random.randint(2, 9)
    b = random.randint(2, 9)
    return f'{a} × {b}', a * b


def issue_captcha() -> dict:
    token = uuid.uuid4().hex
    question, answer = _generate_challenge()
    cache.set(f'{CACHE_PREFIX}{token}', str(answer), TTL)
    return {'token': token, 'question': question, 'expires_in': TTL}


def verify_captcha(token: str, answer) -> bool:
    if not token or answer is None:
        return False
    key = f'{CACHE_PREFIX}{token}'
    expected = cache.get(key)
    if expected is None:
        return False
    # Invalidate setelah dipakai (one-time use)
    cache.delete(key)
    try:
        return str(int(str(answer).strip())) == str(expected)
    except (TypeError, ValueError):
        return False


class CaptchaView(APIView):
    """GET /api/captcha/ - terbitkan challenge baru."""
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request):
        return Response(issue_captcha())
