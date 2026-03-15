from django.conf import settings
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import path, include, re_path
from django.views.static import serve

from . import views

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('django-admin', lambda req: redirect('/django-admin/', permanent=False)),
    path('favicon.svg', views.favicon),
    path('api/', include('scout_api.urls')),
    path('assets/<path:path>', serve, {'document_root': settings.FRONTEND_DIST / 'assets'}),
    # SPA catch-all: serve index.html for any other path so React Router can handle routes (e.g. /dashboard/sd, /log, /dashboard)
    re_path(r'^.*$', views.react_app),
]
