"""Private certificate preview cleanup when an item/batch/event is deleted."""
import logging
import os
from pathlib import PurePosixPath
from django.db import transaction
from django.db.models.signals import post_delete

logger = logging.getLogger(__name__)


def _remove_preview(sender, instance, using, **kwargs):
    from apps.certificates.imports import private_storage
    name = instance.private_path
    # Preview names are server-generated: UUID batch folder + PDF basename.
    parts = name.split('/')
    if (len(parts) != 2 or parts[0] != str(instance.batch_id)
            or parts[1] in ('', '.', '..') or PurePosixPath(name).is_absolute()
            or any(ord(c) < 32 or c in '\\:<>"|' for c in name)):
        logger.warning('Refusing unsafe private preview cleanup')
        return
    storage = private_storage()
    def cleanup():
        try:
            root, target = os.path.realpath(storage.location), os.path.realpath(storage.path(name))
            if os.path.commonpath((root, target)) != root or target == root:
                logger.warning('Refusing private preview path outside its storage')
                return
            if not sender.objects.using(using).filter(private_path=name).exists():
                storage.delete(name)
        except Exception:
            logger.exception('Private certificate preview cleanup failed')
    transaction.on_commit(cleanup, using=using)


def register_private_handlers():
    from apps.certificates.models import CertificateImportItem
    post_delete.connect(_remove_preview, sender=CertificateImportItem, weak=False,
                        dispatch_uid='media.private.certificate_import_item')
