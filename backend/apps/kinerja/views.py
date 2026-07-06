from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import IsAdminOrSuperAdmin, IsAuthenticatedStaff

from .models import PeriodeKinerja, KinerjaHarian
from .serializers import (
    PeriodeKinerjaSerializer,
    KinerjaHarianSerializer,
    KinerjaHarianCreateSerializer,
    LaporanPegawaiSerializer,
    PublicKinerjaSerializer,
    PublicPeriodeInfoSerializer,
)
from .exports import export_laporan_excel

User = get_user_model()


class PeriodeKinerjaViewSet(viewsets.ModelViewSet):
    """CRUD Periode Kinerja.

    - List/Retrieve: semua user authenticated
    - Create/Update/Delete: admin/superadmin only
    """
    queryset = PeriodeKinerja.objects.select_related('created_by')
    serializer_class = PeriodeKinerjaSerializer
    search_fields = ['nama', 'bidang']
    filterset_fields = ['status', 'bulan', 'tahun']
    ordering_fields = ['tahun', 'bulan', 'created_at']

    def get_permissions(self):
        if self.action in ('create', 'destroy'):
            return [IsAdminOrSuperAdmin()]
        return [IsAuthenticatedStaff()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class KinerjaHarianViewSet(viewsets.ModelViewSet):
    """CRUD Kinerja Harian (admin panel).

    - Operator/pegawai: hanya bisa CRUD kinerja milik sendiri
    - Admin/Superadmin: bisa lihat semua kinerja
    """
    serializer_class = KinerjaHarianSerializer
    permission_classes = [IsAuthenticatedStaff]
    filterset_fields = ['periode', 'tanggal']
    search_fields = ['uraian_kegiatan', 'output', 'nama_pegawai', 'nip_pegawai']
    ordering_fields = ['tanggal', 'created_at']

    def get_queryset(self):
        qs = KinerjaHarian.objects.select_related('periode')
        # Filter by periode if provided
        periode_id = self.request.query_params.get('periode')
        if periode_id:
            qs = qs.filter(periode_id=periode_id)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return KinerjaHarianCreateSerializer
        return KinerjaHarianSerializer

    def perform_create(self, serializer):
        serializer.save(pegawai=self.request.user)


class LaporanKinerjaView(APIView):
    """Laporan kinerja per periode.

    GET /api/kinerja/periodes/{id}/laporan/
    Query params:
        - nip: filter by NIP pegawai tertentu
    """
    permission_classes = [IsAuthenticatedStaff]

    def get(self, request, periode_id):
        try:
            periode = PeriodeKinerja.objects.get(id=periode_id)
        except PeriodeKinerja.DoesNotExist:
            return Response(
                {'detail': 'Periode tidak ditemukan.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        entries = KinerjaHarian.objects.filter(
            periode=periode
        ).order_by('nip_pegawai', 'tanggal', 'created_at')

        # Filter by NIP if provided
        nip = request.query_params.get('nip')
        if nip:
            entries = entries.filter(nip_pegawai=nip)

        # Group by NIP pegawai
        nip_list = entries.order_by().values_list('nip_pegawai', flat=True).distinct()

        laporan = []
        for nip_val in nip_list:
            nip_entries = entries.filter(nip_pegawai=nip_val)
            first = nip_entries.first()
            nama_val = (
                (first.pegawai.get_full_name() or first.pegawai.username)
                if (first and first.pegawai) else (first.nama_pegawai if first else '-')
            )
            laporan.append({
                'nip_pegawai': nip_val,
                'nama_pegawai': nama_val,
                'total_kegiatan': nip_entries.count(),
                'entries': KinerjaHarianSerializer(nip_entries, many=True).data,
            })

        return Response({
            'periode': PeriodeKinerjaSerializer(periode).data,
            'laporan': laporan,
        })


class ExportLaporanView(APIView):
    """Export laporan kinerja ke Excel."""
    permission_classes = [IsAuthenticatedStaff]

    def get(self, request, periode_id):
        try:
            periode = PeriodeKinerja.objects.get(id=periode_id)
        except PeriodeKinerja.DoesNotExist:
            return Response(
                {'detail': 'Periode tidak ditemukan.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        nip = request.query_params.get('nip')

        entries = KinerjaHarian.objects.filter(
            periode=periode
        ).order_by('nip_pegawai', 'tanggal')

        if nip:
            entries = entries.filter(nip_pegawai=nip)

        return export_laporan_excel(periode, entries)


# ============================================================
# PUBLIC ENDPOINTS (tanpa login - untuk form pengisian kinerja)
# ============================================================

class PublicPeriodeInfoView(APIView):
    """Info periode untuk ditampilkan di form publik."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            periode = PeriodeKinerja.objects.get(public_slug=slug)
        except PeriodeKinerja.DoesNotExist:
            return Response(
                {'detail': 'Periode tidak ditemukan.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(PublicPeriodeInfoSerializer(periode).data)


class PublicKinerjaSubmitView(APIView):
    """Submit kinerja harian dari form publik (tanpa login)."""
    permission_classes = [AllowAny]

    def post(self, request, slug):
        try:
            periode = PeriodeKinerja.objects.get(public_slug=slug)
        except PeriodeKinerja.DoesNotExist:
            return Response(
                {'detail': 'Periode tidak ditemukan.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if periode.status != PeriodeKinerja.Status.AKTIF:
            return Response(
                {'detail': 'Periode ini sudah ditutup, tidak bisa menambah kinerja.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublicKinerjaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        nip = data['nip_pegawai']
        user = User.objects.filter(username=nip).first()
        if not user:
            user = User.objects.filter(nip=nip).first()

        if not user:
            user = User.objects.create(
                username=nip,
                nip=nip,
                first_name=data['nama_pegawai'],
                email=data.get('email_pegawai', ''),
                phone=data.get('no_hp_pegawai', ''),
                jabatan=data.get('jabatan_pegawai', ''),
                role=User.Role.OPERATOR
            )
            user.set_password(nip)
            user.save()
        else:
            # Update blank profile fields if provided
            updated = False
            if not user.nip:
                user.nip = nip
                updated = True
            if not user.phone and data.get('no_hp_pegawai'):
                user.phone = data['no_hp_pegawai']
                updated = True
            if not user.jabatan and data.get('jabatan_pegawai'):
                user.jabatan = data['jabatan_pegawai']
                updated = True
            if updated:
                user.save()

        entry = KinerjaHarian.objects.create(
            periode=periode,
            pegawai=user,
            nama_pegawai=data['nama_pegawai'],
            nip_pegawai=nip,
            email_pegawai=data.get('email_pegawai', ''),
            no_hp_pegawai=data.get('no_hp_pegawai', ''),
            jabatan_pegawai=data.get('jabatan_pegawai', ''),
            tanggal=data['tanggal'],
            uraian_kegiatan=data['uraian_kegiatan'],
            volume=1,
            satuan='Kegiatan',
            link_bukti=data.get('link_bukti', ''),
            keterangan=data.get('keterangan', ''),
        )

        return Response(
            {
                'detail': 'Kinerja harian berhasil dicatat.',
                'id': str(entry.id),
                'nama_pegawai': entry.nama_pegawai,
                'periode_nama': periode.nama,
            },
            status=status.HTTP_201_CREATED,
        )


class PublicPegawaiLookupView(APIView):
    """Lookup pegawai details by NIP (from User model or latest KinerjaHarian)."""
    permission_classes = [AllowAny]

    def get(self, request, nip):
        # 1. Check User model
        try:
            user = User.objects.filter(nip=nip).first()
            if user:
                return Response({
                    'nama_pegawai': user.get_full_name() or user.username,
                    'email_pegawai': user.email,
                    'no_hp_pegawai': user.phone or '',
                    'jabatan_pegawai': getattr(user, 'jabatan', '') or '',
                })
        except Exception:
            pass

        # 2. Check latest KinerjaHarian entry
        entry = KinerjaHarian.objects.filter(nip_pegawai=nip).order_by('-created_at').first()
        if entry:
            return Response({
                'nama_pegawai': entry.nama_pegawai,
                'email_pegawai': entry.email_pegawai,
                'no_hp_pegawai': entry.no_hp_pegawai,
                'jabatan_pegawai': entry.jabatan_pegawai,
            })

        return Response({
            'nama_pegawai': '',
            'email_pegawai': '',
            'no_hp_pegawai': '',
            'jabatan_pegawai': '',
        })
