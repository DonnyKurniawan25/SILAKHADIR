"""URL configuration for SILAKHADIR project."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('django-admin/', admin.site.urls),

    # Authenticated / admin APIs
    path('api/auth/', include('apps.accounts.urls')),
    path('api/dashboard/', include('apps.reports.urls_dashboard')),
    path('api/events/', include('apps.events.urls')),
    path('api/participants/', include('apps.participants.urls')),
    path('api/certificates/', include('apps.certificates.urls')),
    path('api/certificate-templates/', include('apps.templates_certificate.urls')),
    path('api/settings/', include('apps.settings_app.urls')),
    path('api/kinerja/', include('apps.kinerja.urls')),

    # Public endpoints (no auth required)
    path('api/public/', include('apps.attendance.urls_public')),
    path('api/public/certificates/', include('apps.certificates.urls_public')),
    path('api/public/', include('apps.reports.urls_public')),
    path('api/public/news/', include('apps.news.urls')),
    path('api/public/', include('apps.kinerja.urls_public')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
