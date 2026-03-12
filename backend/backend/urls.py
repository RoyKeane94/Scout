from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.static import serve

from . import views

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('favicon.svg', views.favicon),
    path('', views.react_app),
    path('api/', include('scout_api.urls')),
    path('privacy/', views.react_app),
    path('register/', views.react_app),
    path('join/', views.react_app),
    path('login/', views.react_app),
    path('error/', views.react_app),
    path('log/', views.react_app),
    path('log/sighting/', views.react_app),
    path('log/gap/', views.react_app),
    path('dashboard/', views.react_app),
    path('admin/', views.react_app),
    path('assets/<path:path>', serve, {'document_root': settings.FRONTEND_DIST / 'assets'}),
]
