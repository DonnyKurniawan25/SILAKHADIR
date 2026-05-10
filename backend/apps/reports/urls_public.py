from django.urls import path
from .report_views import PublicEventReportView

urlpatterns = [
    path('events/<slug:slug>/report/', PublicEventReportView.as_view(),
         name='public-event-report'),
]
