from django.urls import path
from .views import AppSettingView

urlpatterns = [
    path('', AppSettingView.as_view(), name='app-setting'),
]
