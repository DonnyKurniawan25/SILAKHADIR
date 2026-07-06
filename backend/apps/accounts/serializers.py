from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .captcha import verify_captcha

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'nip', 'jabatan', 'phone', 'institution',
            'is_active', 'date_joined',
        )
        read_only_fields = ('id', 'date_joined')


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'nip', 'jabatan', 'phone', 'institution', 'password',
        )

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT login yang juga mengembalikan profil user."""

    captcha_token = serializers.CharField(write_only=True, required=True)
    captcha_answer = serializers.CharField(write_only=True, required=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        return token

    def validate(self, attrs):
        # Pop captcha dulu sebelum parent validate (biar tidak dianggap field auth)
        captcha_token = attrs.pop('captcha_token', None)
        captcha_answer = attrs.pop('captcha_answer', None)
        if not verify_captcha(captcha_token, captcha_answer):
            raise serializers.ValidationError({
                'captcha': 'Jawaban verifikasi tidak sesuai. Muat ulang dan coba lagi.',
            })
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
