"""
Backfill Sighting.town from lat/lng using Nominatim reverse geocoding.
Usage: python manage.py backfill_sighting_towns
       python manage.py backfill_sighting_towns --dry-run
       python manage.py backfill_sighting_towns --limit 50
"""
import time
import urllib.parse
import urllib.request

from django.core.management.base import BaseCommand
from django.db.models import Q

from scout_api.models import Sighting


NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1"
USER_AGENT = "Scout/1.0 (backfill-script)"


def get_town_from_address(address):
    """Extract town/locality from Nominatim address dict (same logic as frontend getTownFromAddress)."""
    if not address or not isinstance(address, dict):
        return None
    for key in ("suburb", "village", "town", "city", "municipality", "locality", "hamlet"):
        val = address.get(key)
        if val and isinstance(val, str) and val.strip():
            return val.strip()
    return None


def fetch_town_for_coords(lat, lng):
    """Reverse geocode lat/lng via Nominatim; return town string or None."""
    url = NOMINATIM_URL.format(lat=lat, lon=lng)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read().decode("utf-8")
    except Exception:
        return None
    try:
        import json
        obj = json.loads(data)
    except Exception:
        return None
    addr = obj.get("address") if isinstance(obj, dict) else None
    return get_town_from_address(addr)


class Command(BaseCommand):
    help = "Backfill Sighting.town from lat/lng using Nominatim (1 req/sec)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only print what would be updated, do not save.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max number of sightings to process (0 = no limit).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        limit = options["limit"]

        qs = Sighting.objects.filter(
            lat__isnull=False,
            lng__isnull=False,
        ).filter(Q(town="") | Q(town__isnull=True))

        if limit:
            qs = qs[:limit]

        total = qs.count()
        self.stdout.write(f"Found {total} sighting(s) with lat/lng and no town.")

        updated = 0
        failed = 0
        for i, sighting in enumerate(qs):
            lat = float(sighting.lat)
            lng = float(sighting.lng)
            town = fetch_town_for_coords(lat, lng)
            if town:
                if not dry_run:
                    sighting.town = town[:255]  # match max_length
                    sighting.save(update_fields=["town"])
                updated += 1
                self.stdout.write(f"  [{i + 1}/{total}] id={sighting.id} -> town={town!r}")
            else:
                failed += 1
                self.stdout.write(self.style.WARNING(f"  [{i + 1}/{total}] id={sighting.id} -> no town from geocode"))

            # Nominatim usage policy: max 1 request per second
            if i < total - 1:
                time.sleep(1)

        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"Dry run: would update {updated}, failed {failed}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated {updated}, failed {failed}"))
