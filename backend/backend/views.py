from django.http import HttpResponse
from django.shortcuts import render
from django.conf import settings


def favicon(request):
    """Serve favicon from frontend dist."""
    favicon_path = settings.FRONTEND_DIST / 'favicon.svg'
    if not favicon_path.exists():
        return HttpResponse(status=404)
    with open(favicon_path, 'rb') as f:
        return HttpResponse(f.read(), content_type='image/svg+xml')


def index(request):
    return render(request, 'index.html')


def react_app(request):
    """Serve the React SPA for app routes."""
    index_path = settings.FRONTEND_DIST / 'index.html'
    if not index_path.exists():
        return HttpResponse(
            '<h1>Frontend not built</h1><p>Run: cd frontend && npm run build</p>',
            status=503
        )
    return HttpResponse(index_path.read_text(), content_type='text/html')
