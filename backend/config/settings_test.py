"""Isolated SQLite/media settings for tests; never connect to production DB."""
import tempfile
from .settings import *  # noqa: F403,F401

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
MEDIA_ROOT = tempfile.mkdtemp(prefix='silakhadir-test-media-')
CERTIFICATE_IMPORT_ROOT = tempfile.mkdtemp(prefix='silakhadir-test-private-')
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
FRONTEND_URL = 'https://silakhadir.web.id'
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_CLASSES': ()}
