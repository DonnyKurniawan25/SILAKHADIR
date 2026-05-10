from django.urls import path
from .views import LatestNewsView

urlpatterns = [
    path('latest/', LatestNewsView.as_view(), name='news-latest'),
]
