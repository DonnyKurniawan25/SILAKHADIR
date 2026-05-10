from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .scraper import BASE_URL, fetch_latest_news


class LatestNewsView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request):
        try:
            limit = int(request.GET.get('limit', 5))
        except ValueError:
            limit = 5
        limit = max(1, min(limit, 20))

        force = request.GET.get('refresh') == '1'
        items = fetch_latest_news(limit=limit, force=force)
        return Response({
            'source': 'Diskominfo Kabupaten Lombok Barat',
            'source_url': BASE_URL,
            'all_url': f'{BASE_URL}/list/berita/terbaru?page=1',
            'count': len(items),
            'items': items,
        })
