import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
# Load .env from repo root (Scout/) so DJANGO_SECRET_KEY etc. are available
load_dotenv(BASE_DIR.parent / '.env')
FRONTEND_DIST = BASE_DIR.parent / 'frontend' / 'dist'

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or 'dev-secret-key-change-in-production'
_debug = (os.environ.get('DJANGO_DEBUG') or 'true').lower()
DEBUG = _debug in ('1', 'true', 'yes')
ALLOWED_HOSTS = (os.environ.get('ALLOWED_HOSTS') or '*').strip().split(',')

INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'scout_api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'
WSGI_APPLICATION = 'backend.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

_django_env = (os.environ.get('DJANGO_ENV') or '').strip().lower()
if _django_env == 'production':
    # Trust X-Forwarded-Proto so build_absolute_uri() returns https (avoids mixed content)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    # Production must use PostgreSQL. SQLite in a container is ephemeral — data is lost on every deploy.
    # Accept Railway-style vars (PGHOST, etc.) or explicit DB_* or a single DATABASE_URL.
    _database_url = os.environ.get('DATABASE_URL')
    if _database_url and _database_url.startswith(('postgres://', 'postgresql://')):
        import urllib.parse
        _parsed = urllib.parse.urlparse(_database_url)
        _db_name = _parsed.path.lstrip('/').split('?')[0] or 'scout'
        _db_user = urllib.parse.unquote(_parsed.username or '')
        _db_pass = urllib.parse.unquote(_parsed.password or '')
        _db_host = _parsed.hostname or ''
        _db_port = str(_parsed.port or 5432)
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': _db_name,
                'USER': _db_user,
                'PASSWORD': _db_pass,
                'HOST': _db_host,
                'PORT': _db_port,
            }
        }
    else:
        _db_host = os.environ.get('DB_HOST') or os.environ.get('PGHOST')
        if not _db_host:
            raise RuntimeError(
                'Production (DJANGO_ENV=production) requires a persistent database. '
                'Set DATABASE_URL (postgres://...) or DB_HOST/PGHOST and DB_NAME, DB_USER, DB_PASSWORD, DB_PORT. '
                'On Railway: add Postgres, then in your app service link it or add DATABASE_URL from the Postgres service.'
            )
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.environ.get('DB_NAME') or os.environ.get('PGDATABASE', 'scout'),
                'USER': os.environ.get('DB_USER') or os.environ.get('PGUSER', ''),
                'PASSWORD': os.environ.get('DB_PASSWORD') or os.environ.get('PGPASSWORD', ''),
                'HOST': _db_host,
                'PORT': os.environ.get('DB_PORT') or os.environ.get('PGPORT', '5432'),
            }
        }
else:
    # Non-production only: SQLite for local development.
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
# WhiteNoise: compress and cache static files in production
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'scout_api.User'

# CORS: dev origin + optional production origin from env
CORS_ALLOWED_ORIGINS = ['http://localhost:5173']
if os.environ.get('CORS_ORIGIN'):
    CORS_ALLOWED_ORIGINS.append(os.environ.get('CORS_ORIGIN').rstrip('/'))

# Production: trust CSRF on this origin (e.g. https://yourdomain.com)
if os.environ.get('CSRF_TRUSTED_ORIGIN'):
    CSRF_TRUSTED_ORIGINS = [os.environ.get('CSRF_TRUSTED_ORIGIN').rstrip('/')]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
}
