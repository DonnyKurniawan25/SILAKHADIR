"""Isolated test settings: never connect to the production database."""
import tempfile
from config.settings import *  # noqa: F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
MEDIA_ROOT = tempfile.mkdtemp(prefix='certificate-tests-media-')
CERTIFICATE_IMPORT_ROOT = tempfile.mkdtemp(prefix='certificate-tests-private-')
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
