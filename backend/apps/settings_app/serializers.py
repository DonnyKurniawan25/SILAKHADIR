from rest_framework import serializers
from .models import AppSetting


class AppSettingSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = AppSetting
        fields = '__all__'

    def get_logo_url(self, obj):
        if not obj.institution_logo:
            return None
        request = self.context.get('request')
        url = obj.institution_logo.url
        if request:
            return request.build_absolute_uri(url)
        from django.conf import settings
        return f'{settings.BACKEND_URL}{url}'
