"""
Backfill Gap.town from lat/lng using Nominatim reverse geocoding.

Uses the same formatted address string as LogGap / frontend formatShortAddress
(POI, locality, postcode) so dashboard parsing stays consistent.

Coordinates: uses gap.lat/lng when both set, otherwise venue.lat/lng.

Usage:
  python manage.py backfill_gap_locations
  python manage.py backfill_gap_locations --dry-run
  python manage.py backfill_gap_locations --limit 50
  python manage.py backfill_gap_locations --sync-coords   # copy venue lat/lng onto gap when gap has none
"""
import json
import time
import urllib.request

from django.core.management.base import BaseCommand
from django.db.models import Q

from scout_api.models import Gap, Town


NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&addressdetails=1"
USER_AGENT = "Scout/1.0 (backfill-gap-locations)"


def _pick_locality(address):
    if not address or not isinstance(address, dict):
        return None
    for key in ("suburb", "village", "town", "city", "municipality", "locality", "hamlet"):
        val = address.get(key)
        if val and isinstance(val, str) and val.strip():
            return val.strip()
    return None


def format_short_address(data):
    """
    Match frontend utils/geocode.js formatShortAddress (Nominatim reverse JSON).
    """
    if not isinstance(data, dict):
        return None
    addr = data.get("address")
    if not addr or not isinstance(addr, dict):
        dn = data.get("display_name")
        return dn.strip() if isinstance(dn, str) and dn.strip() else None

    locality = _pick_locality(addr)
    postcode = addr.get("postcode")
    postcode = postcode.strip() if isinstance(postcode, str) and postcode.strip() else None

    if locality and postcode:
        locality_postcode = f"{locality}, {postcode}"
    else:
        locality_postcode = locality or postcode

    name = data.get("name")
    if isinstance(name, str) and name.strip() and locality_postcode:
        return f"{name.strip()}, {locality_postcode}"
    if isinstance(name, str) and name.strip():
        return name.strip()
    return locality_postcode or (data.get("display_name") or "").strip() or None


def fetch_location_label(lat, lng):
    """Reverse geocode; return formatted location string or None."""
    url = NOMINATIM_URL.format(lat=lat, lon=lng)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
    except Exception:
        return None
    try:
        obj = json.loads(raw)
    except Exception:
        return None
    return format_short_address(obj)


def coords_for_gap(gap):
    """(lat, lng) floats or (None, None). Prefer gap, then venue."""
    if gap.lat is not None and gap.lng is not None:
        return float(gap.lat), float(gap.lng)
    v = gap.venue
    if v is not None and v.lat is not None and v.lng is not None:
        return float(v.lat), float(v.lng)
    return None, None


class Command(BaseCommand):
    help = "Backfill Gap.town from coordinates via Nominatim (1 req/sec)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print actions only; do not create towns or save gaps.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max gaps to process (0 = no limit).",
        )
        parser.add_argument(
            "--sync-coords",
            action="store_true",
            help="Before geocoding, set gap.lat/lng from venue when gap has no coordinates.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        limit = options["limit"]
        sync_coords = options["sync_coords"]

        qs = (
            Gap.objects.filter(town__isnull=True)
            .filter(
                Q(lat__isnull=False, lng__isnull=False)
                | Q(venue__lat__isnull=False, venue__lng__isnull=False)
            )
            .select_related("venue", "organisation")
            .order_by("id")
        )

        if limit:
            gap_ids = list(qs.values_list("pk", flat=True)[:limit])
            qs = Gap.objects.filter(pk__in=gap_ids).select_related("venue", "organisation").order_by("id")

        total = qs.count()
        self.stdout.write(f"Found {total} gap(s) with no town and usable coordinates.")

        updated = 0
        failed = 0
        coords_synced = 0

        for i, gap in enumerate(qs):
            lat, lng = coords_for_gap(gap)

            if lat is None:
                failed += 1
                self.stdout.write(self.style.WARNING(f"  [{i + 1}/{total}] id={gap.id} -> no coordinates"))
                continue

            sync_note = ""
            if sync_coords and (gap.lat is None or gap.lng is None) and gap.venue_id:
                v = gap.venue
                if v.lat is not None and v.lng is not None:
                    coords_synced += 1
                    sync_note = "[synced lat/lng from venue] "
                    if not dry_run:
                        gap.lat = v.lat
                        gap.lng = v.lng
                        gap.save(update_fields=["lat", "lng"])

            label = fetch_location_label(lat, lng)
            if label:
                name = label[:255]
                if not dry_run:
                    town_obj, _ = Town.objects.get_or_create(
                        organisation_id=gap.organisation_id,
                        name=name,
                    )
                    gap.town = town_obj
                    gap.save(update_fields=["town"])
                updated += 1
                self.stdout.write(f"  [{i + 1}/{total}] id={gap.id} {sync_note}-> town={name!r}")
            else:
                failed += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"  [{i + 1}/{total}] id={gap.id} {sync_note}-> geocoder returned nothing"
                    )
                )

            if i < total - 1:
                time.sleep(1)

        self.stdout.write("")
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run: would set town on {updated}, failed {failed}, "
                    f"would sync coords on {coords_synced} gap(s)."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Set town on {updated} gap(s), failed {failed}. "
                    f"Synced gap lat/lng from venue: {coords_synced}."
                )
            )
