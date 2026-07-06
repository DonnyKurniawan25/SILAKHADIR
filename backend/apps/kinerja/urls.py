from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PeriodeKinerjaViewSet,
    KinerjaHarianViewSet,
    LaporanKinerjaView,
    ExportLaporanView,
)

router = DefaultRouter()
router.register(r'periodes', PeriodeKinerjaViewSet, basename='periode-kinerja')
router.register(r'entries', KinerjaHarianViewSet, basename='kinerja-harian')

urlpatterns = [
    path('', include(router.urls)),
    path(
        'periodes/<uuid:periode_id>/laporan/',
        LaporanKinerjaView.as_view(),
        name='laporan-kinerja',
    ),
    path(
        'periodes/<uuid:periode_id>/export/',
        ExportLaporanView.as_view(),
        name='export-laporan-kinerja',
    ),
]
