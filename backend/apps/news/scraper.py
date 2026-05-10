"""
Scraper berita dari diskominfo.lombokbaratkab.go.id

Hasil di-cache 15 menit via Django cache agar tidak membebani situs sumber.
"""
import logging
import warnings
from urllib.parse import urljoin

from django.core.cache import cache

warnings.filterwarnings('ignore', message='Unverified HTTPS request')

log = logging.getLogger(__name__)

BASE_URL = 'https://diskominfo.lombokbaratkab.go.id'
LIST_URL = f'{BASE_URL}/list/berita/terbaru?page=1'
CACHE_KEY = 'news:diskominfo_lombokbarat:latest'
CACHE_TTL = 15 * 60  # 15 menit
REQUEST_TIMEOUT = 12

USER_AGENT = 'Mozilla/5.0 (compatible; SILAKHADIR-News-Bot/1.0)'


def fetch_latest_news(limit: int = 5, force: bool = False) -> list[dict]:
    """
    Ambil daftar berita terbaru. Return list berisi dict dengan key:
      title, url, image, category, author, date_label

    Error (network, parse) ditangani dan mengembalikan list kosong atau
    data cache lama (jika ada).
    """
    if not force:
        cached = cache.get(CACHE_KEY)
        if cached is not None:
            return cached[:limit]

    try:
        import requests
        from bs4 import BeautifulSoup

        resp = requests.get(
            LIST_URL,
            timeout=REQUEST_TIMEOUT,
            verify=False,
            headers={'User-Agent': USER_AGENT},
        )
        resp.raise_for_status()
    except Exception as exc:
        log.warning(f'Gagal mengambil berita: {exc}')
        # Jangan cache error; coba lagi nanti
        stale = cache.get(CACHE_KEY + ':stale')
        return stale[:limit] if stale else []

    try:
        soup = BeautifulSoup(resp.content, 'html.parser')

        # Hapus menu agar link berita di menu tidak ikut
        for tag in soup.select('header, nav, .menu, .menu-mobile, .menu-desktop, footer'):
            tag.decompose()

        items = []
        for card in soup.select('div.m-b-45'):
            link_tag = card.select_one('a.wrap-pic-w') or card.find('a', href=True)
            title_tag = card.select_one('h5 a') or card.select_one('h5')
            if not link_tag or not title_tag:
                continue

            href = link_tag.get('href', '').strip()
            if not href or '/berita/' not in href:
                continue

            title = title_tag.get_text(strip=True)
            if not title or len(title) < 10:
                continue

            img_tag = card.find('img')
            img_url = ''
            if img_tag:
                img_url = (
                    img_tag.get('data-src')
                    or img_tag.get('src')
                    or ''
                ).strip()
                if img_url.startswith('/'):
                    img_url = urljoin(BASE_URL, img_url)

            # Metadata dari span.cl8
            meta = card.select_one('span.cl8')
            category, author, date_label = '', '', ''
            if meta:
                parts = [
                    p.get_text(strip=True)
                    for p in meta.find_all(['a', 'span'])
                    if p.get_text(strip=True) and p.get_text(strip=True) != '-'
                ]
                if len(parts) >= 3:
                    category, author, date_label = parts[0], parts[1], parts[2]
                elif len(parts) == 2:
                    category, date_label = parts[0], parts[1]
                elif len(parts) == 1:
                    date_label = parts[0]

            items.append({
                'title': title,
                'url': urljoin(BASE_URL, href),
                'image': img_url,
                'category': category,
                'author': author,
                'date_label': date_label,
            })

        # Jika tidak ketemu card, fallback: cari link saja
        if not items:
            for a in soup.find_all('a', href=True):
                href = a['href']
                text = a.get_text(strip=True)
                if '/berita/' not in href or len(text) < 20:
                    continue
                items.append({
                    'title': text,
                    'url': urljoin(BASE_URL, href),
                    'image': '',
                    'category': '',
                    'author': '',
                    'date_label': '',
                })
                if len(items) >= 10:
                    break

        # Deduplikasi berdasarkan URL
        seen, dedup = set(), []
        for i in items:
            if i['url'] in seen:
                continue
            seen.add(i['url'])
            dedup.append(i)

        cache.set(CACHE_KEY, dedup, CACHE_TTL)
        cache.set(CACHE_KEY + ':stale', dedup, 24 * 3600)  # jaga-jaga
        return dedup[:limit]
    except Exception as exc:
        log.warning(f'Gagal parsing berita: {exc}')
        stale = cache.get(CACHE_KEY + ':stale')
        return stale[:limit] if stale else []
