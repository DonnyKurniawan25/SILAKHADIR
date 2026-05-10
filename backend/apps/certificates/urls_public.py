from django.urls import path

from .views import (
    PublicCheckCertificateView,
    PublicDownloadCertificateView,
    PublicVerifyCertificateView,
)

urlpatterns = [
    path('check/', PublicCheckCertificateView.as_view(), name='public-cert-check'),
    path('download/<str:token>/', PublicDownloadCertificateView.as_view(),
         name='public-cert-download'),
    path('verify/<str:token>/', PublicVerifyCertificateView.as_view(),
         name='public-cert-verify'),
]
