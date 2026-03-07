from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('auth/register-org/', views.register_org),
    path('auth/register-member/', views.register_member),
    path('auth/login/', views.login),
    path('auth/refresh/', TokenRefreshView.as_view()),
    path('auth/me/', views.me),
    path('auth/validate-code/', views.validate_code),
    path('config/fields/', views.field_config_list),
    path('config/brands/', views.brand_list),
    path('config/brands/create/', views.brand_create),
    path('users/', views.user_list),
    path('users/<int:user_id>/role/', views.user_update_role),
    path('venues/', views.venue_list),
    path('sightings/', views.sighting_list),
    path('sightings/<int:sighting_id>/photo/', views.sighting_photo),
]
