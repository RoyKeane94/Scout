#!/bin/sh
set -e
cd backend && python3 -m gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000}
