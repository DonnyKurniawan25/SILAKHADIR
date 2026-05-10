from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_superadmin()
        )


class IsAdminOrSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_admin_role()
        )


class IsAuthenticatedStaff(BasePermission):
    """Semua role terautentikasi (admin, superadmin, operator)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsEventOwnerOrAdmin(BasePermission):
    """
    Operator hanya dapat mengelola event yang mereka buat.
    Admin & Superadmin memiliki akses penuh.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_admin_role():
            return True
        if request.method in SAFE_METHODS:
            return True
        # Operator hanya jika event miliknya
        created_by = getattr(obj, 'created_by', None)
        if created_by is None and hasattr(obj, 'event'):
            created_by = getattr(obj.event, 'created_by', None)
        return created_by_id_matches(created_by, user)


def created_by_id_matches(created_by, user):
    if created_by is None:
        return False
    return getattr(created_by, 'id', None) == user.id
