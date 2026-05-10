from django.urls import include, path
from rest_framework.routers import DefaultRouter, SimpleRouter

from .views import CertificateNumberFormatViewSet, CertificateViewSet

router = DefaultRouter()
router.register(r'', CertificateViewSet, basename='certificate')

# Hindari conflict API root dengan path kosong.
number_format_router = SimpleRouter()
number_format_router.register(
    r'number-formats', CertificateNumberFormatViewSet, basename='certificate-number-format',
)

urlpatterns = [
    path('', include(number_format_router.urls)),
    path('', include(router.urls)),
]
