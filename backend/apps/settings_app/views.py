from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrSuperAdmin

from .models import AppSetting
from .serializers import AppSettingSerializer


class AppSettingView(APIView):
    """
    GET publik: menampilkan branding untuk landing page.
    PUT admin: update pengaturan.
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminOrSuperAdmin()]

    def get(self, request):
        setting = AppSetting.get_instance()
        return Response(AppSettingSerializer(setting, context={'request': request}).data)

    def put(self, request):
        setting = AppSetting.get_instance()
        serializer = AppSettingSerializer(
            setting, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
