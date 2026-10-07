from django.urls import path
from .xlsx_views import (
    AttendanceExportXlsxView, AttendanceImportXlsxView, AttendanceTemplateXlsxView,
)

urlpatterns = [
    path('template-xlsx/', AttendanceTemplateXlsxView.as_view(), name='event-attendance-template-xlsx'),
    path('export-xlsx/', AttendanceExportXlsxView.as_view(), name='event-attendance-export-xlsx'),
    path('import-xlsx/', AttendanceImportXlsxView.as_view(), name='event-attendance-import-xlsx'),
]
