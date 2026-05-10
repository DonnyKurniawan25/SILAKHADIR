from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .captcha import CaptchaView
from .views import (
    MyTokenObtainPairView,
    UserViewSet,
    logout_view,
    me_view,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', me_view, name='me'),
    path('logout/', logout_view, name='logout'),
    path('captcha/', CaptchaView.as_view(), name='captcha'),
    path('', include(router.urls)),
]
