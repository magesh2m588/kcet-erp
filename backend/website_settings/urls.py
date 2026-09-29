from django.urls import path
from . import views

urlpatterns = [
    # Public — no auth required, safe fields only
    path('website-settings/', views.public_website_settings, name='public_website_settings'),

    # Admin — full CRUD, requires admin role
    path('admin/website-settings/', views.admin_website_settings, name='admin_website_settings'),
    path('admin/website-settings/logo/', views.upload_logo, name='upload_logo'),
    path('admin/website-settings/logo/delete/', views.delete_logo, name='delete_logo'),
    path('admin/website-settings/background/', views.upload_background, name='upload_background'),
    path('admin/website-settings/background/delete/', views.delete_background, name='delete_background'),
    path('admin/website-settings/reset/', views.reset_to_defaults, name='reset_website_settings'),
]
