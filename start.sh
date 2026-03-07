#!/bin/sh
set -e
cd backend && gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000}
