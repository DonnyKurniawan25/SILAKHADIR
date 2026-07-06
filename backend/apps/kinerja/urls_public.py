from django.urls import path

from .views import PublicPeriodeInfoView, PublicKinerjaSubmitView, PublicPegawaiLookupView

urlpatterns = [
    path(
        'kinerja/<slug:slug>/info/',
        PublicPeriodeInfoView.as_view(),
        name='public-kinerja-info',
    ),
    path(
        'kinerja/<slug:slug>/submit/',
        PublicKinerjaSubmitView.as_view(),
        name='public-kinerja-submit',
    ),
    path(
        'kinerja/pegawai/<str:nip>/',
        PublicPegawaiLookupView.as_view(),
        name='public-pegawai-lookup',
    ),
]
