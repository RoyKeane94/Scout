# Stage 1: build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: run Django + serve built frontend
FROM python:3.12-slim
WORKDIR /app

# Install Python deps
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code
COPY backend/ backend/

# Copy built frontend from stage 1 (Django expects frontend/dist at repo root)
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Entrypoint: run migrations then start gunicorn
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Collect static files (optional; WhiteNoise can serve from STATIC_ROOT)
RUN cd backend && python manage.py collectstatic --noinput --settings=backend.settings 2>/dev/null || true

ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000

WORKDIR /app/backend
ENTRYPOINT ["/entrypoint.sh"]
