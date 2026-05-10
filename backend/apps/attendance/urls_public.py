from django.urls import path

from .views import PublicAttendanceView, PublicEventInfoView, PublicEventQRView

urlpatterns = [
    path('events/<slug:slug>/info/', PublicEventInfoView.as_view(), name='public-event-info'),
    path('events/<slug:slug>/qr/', PublicEventQRView.as_view(), name='public-event-qr'),
    path('events/<slug:slug>/attendance/', PublicAttendanceView.as_view(), name='public-attendance'),
]
