from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsSuperAdmin
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
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Blacklist refresh token jika blacklist app diaktifkan.
    Default: sekedar endpoint yes-response (JWT stateless).
    """
    refresh = request.data.get('refresh')
    if refresh:
        try:
            RefreshToken(refresh)  # validasi
        except Exception:
            pass
    return Response({'detail': 'Logged out'}, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """Manajemen user - hanya super admin."""
    queryset = User.objects.all()
    permission_classes = [IsSuperAdmin]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    filterset_fields = ['role', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer
