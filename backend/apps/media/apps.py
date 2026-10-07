from django.apps import AppConfig


class MediaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.media'

    def ready(self):
        from .signals import register_handlers
        register_handlers()
        from .private import register_private_handlers
        register_private_handlers()
