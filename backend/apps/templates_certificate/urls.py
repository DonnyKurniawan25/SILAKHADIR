from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CertificateTemplateViewSet

router = DefaultRouter()
router.register(r'', CertificateTemplateViewSet, basename='certificate-template')

urlpatterns = [path('', include(router.urls))]
