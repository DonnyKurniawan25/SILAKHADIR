from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsSuperAdmin, IsAdminOrSuperAdmin
from .serializers import (
    MyTokenObtainPairSerializer,
    UserCreateSerializer,
    UserSerializer,
)

User = get_user_model()


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    permission_classes = [AllowAny]


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
def logout_view(request):
    refresh = request.data.get('refresh')
    if refresh:
        try:
            RefreshToken(refresh)  # validasi
        except Exception:
            pass
    return Response({'detail': 'Logged out'}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """Manajemen user - super admin, admin, dan self-service bagi operator."""
    queryset = User.objects.all()
    permission_classes = [IsAdminOrSuperAdmin]
    search_fields = ['username', 'email', 'first_name', 'last_name', 'nip']
    filterset_fields = ['role', 'is_active']

    def get_permissions(self):
        # Allow any authenticated user to view or modify their own account profile/password.
        if self.action in ('retrieve', 'update', 'partial_update', 'change_password'):
            return [IsAuthenticated()]
        return [IsAdminOrSuperAdmin()]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Non-admin users can only view or modify their own user object
        if not request.user.is_admin_role() and obj.id != request.user.id:
            self.permission_denied(
                request,
                message="Anda tidak memiliki izin untuk mengakses atau mengelola akun ini."
            )

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @action(detail=True, methods=['post'], url_path='change-password')
    def change_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password or len(password) < 6:
            return Response(
                {'detail': 'Password minimal harus 6 karakter.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save()
        return Response({'detail': 'Password berhasil diperbarui.'})
