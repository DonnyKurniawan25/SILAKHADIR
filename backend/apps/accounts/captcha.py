"""
Captcha sederhana berbasis soal matematika.
Token ditandatangani dengan HMAC sehingga tidak perlu shared cache
(berfungsi konsisten dengan multi-worker Gunicorn).
"""
import hashlib
import hmac
import json
import os
import random
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView


SIGNING_KEY = getattr(settings, 'CAPTCHA_SECRET_KEY', settings.SECRET_KEY or 'fallback-secret')
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
    question, answer = _generate_challenge()
    payload = json.dumps({
        'answer': str(answer),
        'expires': int(time.time()) + TTL,
        'nonce': os.urandom(8).hex(),
    }, separators=(',', ':'))
    encoded = urlsafe_b64encode(payload.encode()).decode().rstrip('=')
    sig = hmac.new(SIGNING_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    token = f'{encoded}.{sig}'
    return {'token': token, 'question': question, 'expires_in': TTL}


def verify_captcha(token: str, answer) -> bool:
    if not token or answer is None:
        return False
    try:
        if '.' not in token:
            return False
        encoded, sig = token.rsplit('.', 1)
        expected_sig = hmac.new(SIGNING_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return False
        padded = encoded + '=' * (-len(encoded) % 4)
        payload = json.loads(urlsafe_b64decode(padded))
        if int(payload.get('expires', 0)) < int(time.time()):
            return False
        expected = str(payload['answer']).strip()
        return str(int(str(answer).strip())) == expected
    except Exception:
        return False


class CaptchaView(APIView):
    """GET /api/auth/captcha/ - terbitkan challenge baru."""
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request):
        return Response(issue_captcha())
