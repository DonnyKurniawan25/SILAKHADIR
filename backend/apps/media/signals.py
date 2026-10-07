"""Prospective, commit-safe cleanup of locally owned model uploads.

Call register_handlers() from AppConfig.ready() after models have loaded. It is
idempotent and returns the registered model tuple. Only managed, concrete local
``apps.*`` models participate; Django/third-party models are never registered.

Storage is not transactional: files written before a failed save/outer rollback
(or a rolled-back nested savepoint) can remain orphaned. There is no rollback
hook; retain endpoint-specific exception cleanup. QuerySet.update/bulk_update,
raw SQL and FieldFile.delete bypass this lifecycle. This is not an orphan purge.
Reference checks use the transaction's DB alias and cannot serialize concurrent
writers of the same name or discover references in a separate database. Upload
names should be unique/immutable. Existing manual endpoint cleanup must apply
these same reference protections independently.
"""
import logging
import os
from pathlib import PurePosixPath

from django.apps import apps
from django.core.files.storage import FileSystemStorage
from django.db import models, transaction
from django.db.models.signals import pre_save, post_save, pre_delete, post_delete

logger = logging.getLogger(__name__)

# Callable upload roots are code-owned constants, never generated from mutable
# instance data (certificate numbers, report/event IDs, XML or user input).
_CALLABLE_PREFIXES = {
    'apps.certificates.models.certificate_pdf_upload': 'certificates/',
    'apps.certificates.models.certificate_qr_upload': 'certificates/qr/',
    'apps.reports.models.report_cover_upload': 'reports/',
    'apps.reports.models.report_photo_upload': 'reports/',
    'apps.reports.models.report_attachment_upload': 'reports/',
    'apps.attendance.models.signature_upload_to': 'signatures/',
    'apps.attendance.models.photo_upload_to': 'photos/',
}
_SAVE_SNAPSHOT = '_media_lifecycle_before_save'
_DELETE_SNAPSHOT = '_media_lifecycle_before_delete'


def _file_models():
    return tuple(model for model in apps.get_models()
                 if model._meta.app_config.name.startswith('apps.')
                 and model._meta.managed and not model._meta.proxy
                 and any(isinstance(field, models.FileField) for field in model._meta.fields))


def _fields(model):
    return tuple(field for field in model._meta.fields if isinstance(field, models.FileField))


def _owned_prefix(field):
    upload = field.upload_to
    if callable(upload):
        return _CALLABLE_PREFIXES.get(f'{upload.__module__}.{upload.__qualname__}')
    # Empty/absolute upload_to is not evidence of ownership of an entire store.
    if not isinstance(upload, str) or not upload or upload.startswith('/'):
        return None
    parts = upload.rstrip('/').split('/')
    if any(part in ('', '.', '..') for part in parts) or any(c in upload for c in '\\:<>\x00'):
        return None
    return upload.rstrip('/') + '/'


def _safe_owned_name(field, name):
    prefix = _owned_prefix(field)
    if not prefix or not isinstance(name, str) or not name.startswith(prefix):
        return False
    if any(ord(c) < 32 or c in '\\:<>"|' for c in name):
        return False
    parts = name.split('/')
    if any(part in ('', '.', '..') for part in parts) or PurePosixPath(name).is_absolute():
        return False
    storage = field.storage
    if isinstance(storage, FileSystemStorage):
        # safe_join alone does not stop a symlink under MEDIA_ROOT escaping it.
        root = os.path.realpath(storage.location)
        target = os.path.realpath(storage.path(name))
        if os.path.commonpath((root, target)) != root or target == root:
            return False
    return True


def _same_namespace(first, second):
    if first is second or first == second:
        return True
    # Distinct aliases may still resolve to the same filesystem namespace.
    if isinstance(first, FileSystemStorage) and isinstance(second, FileSystemStorage):
        return os.path.normcase(os.path.realpath(first.location)) == os.path.normcase(os.path.realpath(second.location))
    return False


def _referenced(storage, name, using):
    for model in _file_models():
        for field in _fields(model):
            if _same_namespace(field.storage, storage):
                if model._base_manager.using(using).filter(**{field.attname: name}).exists():
                    return True
    return False


def _schedule_delete(field, name, using):
    if not name:
        return
    storage = field.storage

    def cleanup():
        try:
            if not _safe_owned_name(field, name):
                logger.warning('Refusing unsafe/unowned upload cleanup for %s.%s: %r',
                               field.model._meta.label, field.name, name)
                return
            if _referenced(storage, name, using):
                return
            # Duplicate callbacks (e.g. shared files in cascades) are harmless.
            if storage.exists(name):
                storage.delete(name)
        except Exception:
            # Reference-query failures also fail closed: never risk shared files.
            logger.exception('Upload cleanup failed for %s.%s: %r',
                             field.model._meta.label, field.name, name)

    transaction.on_commit(cleanup, using=using)


def _snapshot(sender, instance, using, fields):
    if instance.pk is None or not fields:
        return {}
    row = sender._base_manager.using(using).filter(pk=instance.pk).values(
        *(field.attname for field in fields)).first()
    return row or {}


def _before_save(sender, instance, using, raw=False, update_fields=None, **kwargs):
    # Reset per attempt; failed saves must never leak a stale snapshot to a retry.
    setattr(instance, _SAVE_SNAPSHOT, {})
    if raw:
        return
    fields = tuple(field for field in _fields(sender)
                   if update_fields is None or field.name in update_fields or field.attname in update_fields)
    setattr(instance, _SAVE_SNAPSHOT, _snapshot(sender, instance, using, fields))


def _after_save(sender, instance, using, raw=False, **kwargs):
    previous = instance.__dict__.pop(_SAVE_SNAPSHOT, {})
    if raw:
        return
    for field in _fields(sender):
        old = previous.get(field.attname)
        current = getattr(instance, field.attname)
        if old and old != (current.name if current else ''):
            _schedule_delete(field, old, using)


def _before_delete(sender, instance, using, **kwargs):
    # Delete can be called on a dirty instance: use persisted names, not unsaved
    # names that might point at somebody else's file.
    setattr(instance, _DELETE_SNAPSHOT, _snapshot(sender, instance, using, _fields(sender)))


def _after_delete(sender, instance, using, **kwargs):
    previous = instance.__dict__.pop(_DELETE_SNAPSHOT, {})
    for field in _fields(sender):
        _schedule_delete(field, previous.get(field.attname), using)


def register_handlers():
    """Connect strong, sender-scoped, idempotent lifecycle handlers; return models.

    Invoke from ready(), not at import time. Unknown callable upload_to roots
    remain reference-protected but fail closed for deletion until added to the
    code-owned prefix map above. No files or database records are touched here.
    """
    registered = _file_models()
    for model in registered:
        for signal, receiver, suffix in (
            (pre_save, _before_save, 'pre_save'),
            (post_save, _after_save, 'post_save'),
            (pre_delete, _before_delete, 'pre_delete'),
            (post_delete, _after_delete, 'post_delete'),
        ):
            signal.connect(receiver, sender=model, weak=False,
                           dispatch_uid=f'media.lifecycle.{model._meta.label_lower}.{suffix}')
    return registered
