from django.conf import settings
from django.urls import path, include
from django.views.static import serve

from . import views

urlpatterns = [
    path('favicon.svg', views.favicon),
    path('', views.react_app),
    path('api/', include('scout_api.urls')),
    path('register/', views.react_app),
    path('join/', views.react_app),
    path('login/', views.react_app),
    path('log/', views.react_app),
    path('dashboard/', views.react_app),
    path('admin/', views.react_app),
    path('assets/<path:path>', serve, {'document_root': settings.FRONTEND_DIST / 'assets'}),
]
