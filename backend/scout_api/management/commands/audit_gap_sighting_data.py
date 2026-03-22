"""
Report how existing data splits between Gaps vs Sightings, and sanity-check gap flags.

Do you need this?
-----------------
**Usually no.** In Scout, categorisation is already structural:
  - **Sighting** rows always have a `brand` (own or competitor via `Brand.is_own_brand`).
  - **Gap** rows are a separate model (venue opportunity, no brand on the record).

There are no mixed/ambiguous rows that must be "classified" after the fact.

This command is **optional** — useful for audits, exports prep, or checking that
`Gap.from_contested_flow` matches your expectations after a restore or manual edits.

Usage:
  python manage.py audit_gap_sighting_data
  python manage.py audit_gap_sighting_data --org-id 1
  python manage.py audit_gap_sighting_data --json
"""
import json

from django.core.management.base import BaseCommand
from scout_api.models import Gap, Organisation, Sighting


def contested_venue_ids_for_org(org):
    """Venues with competitor sightings and no own-brand sighting at that venue (same idea as dashboard)."""
    own_venue_ids = set(
        Sighting.objects.filter(organisation=org, brand__is_own_brand=True).values_list(
            "venue_id", flat=True
        )
    )
    return set(
        Sighting.objects.filter(organisation=org, brand__is_own_brand=False)
        .exclude(venue_id__in=own_venue_ids)
        .values_list("venue_id", flat=True)
        .distinct()
    )


class Command(BaseCommand):
    help = "Report Gap vs Sighting counts and optional gap-flag sanity hints (read-only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-id",
            type=int,
            default=None,
            help="Limit to one organisation (default: all orgs).",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Machine-readable output.",
        )

    def handle(self, *args, **options):
        org_id = options["org_id"]
        as_json = options["json"]

        qs = Organisation.objects.all().order_by("id")
        if org_id is not None:
            qs = qs.filter(pk=org_id)

        out = {"organisations": []}

        for org in qs:
            sightings = Sighting.objects.filter(organisation=org)
            gaps = Gap.objects.filter(organisation=org)

            sighting_total = sightings.count()
            own_count = sightings.filter(brand__is_own_brand=True).count()
            comp_count = sightings.filter(brand__is_own_brand=False).count()

            gap_total = gaps.count()
            gap_market = gaps.filter(from_contested_flow=False).count()
            gap_contested = gaps.filter(from_contested_flow=True).count()

            contested_venues = contested_venue_ids_for_org(org)
            # Hints: not automatic fixes — manual review if non-zero
            gaps_at_contested = gaps.filter(from_contested_flow=False, venue_id__in=contested_venues).count()
            if contested_venues:
                gaps_contested_flag_but_venue_not = gaps.filter(from_contested_flow=True).exclude(
                    venue_id__in=contested_venues
                ).count()
            else:
                # No "contested-only" venues in this org — skip (otherwise every contested-flag gap would match)
                gaps_contested_flag_but_venue_not = None

            block = {
                "organisation_id": org.id,
                "organisation_name": org.name,
                "sightings": {
                    "total": sighting_total,
                    "own_brand": own_count,
                    "competitor": comp_count,
                },
                "gaps": {
                    "total": gap_total,
                    "from_contested_flow_false": gap_market,
                    "from_contested_flow_true": gap_contested,
                },
                "sanity_hints": {
                    "gaps_flagged_market_but_venue_is_contested_dashboard_sense": gaps_at_contested,
                    "gaps_flagged_contested_but_venue_not_in_contested_set": gaps_contested_flag_but_venue_not,
                },
            }
            if as_json and block["sanity_hints"]["gaps_flagged_contested_but_venue_not_in_contested_set"] is None:
                block["sanity_hints"]["gaps_flagged_contested_but_venue_not_in_contested_set"] = (
                    "n/a (no contested-only venues)"
                )
            out["organisations"].append(block)

            if not as_json:
                self.stdout.write(self.style.NOTICE(f"\n=== Org {org.id}: {org.name} ==="))
                self.stdout.write(
                    f"  Sightings: {sighting_total} total "
                    f"({own_count} own brand, {comp_count} competitor)"
                )
                self.stdout.write(
                    f"  Gaps:      {gap_total} total "
                    f"({gap_market} market / log-a-gap, {gap_contested} contested-flow)"
                )
                self.stdout.write(
                    "  Hints (non-zero may deserve a quick look in admin):\n"
                    f"    - Market gaps at ‘contested’ venues (no own brand, comp present): {gaps_at_contested}\n"
                    f"    - Contested-flag gaps where venue isn’t in contested set: "
                    f"{gaps_contested_flag_but_venue_not if gaps_contested_flag_but_venue_not is not None else 'n/a'}"
                )

        if as_json:
            self.stdout.write(json.dumps(out, indent=2))

        if not as_json:
            self.stdout.write(
                self.style.SUCCESS(
                    "\nNote: Rows are already either Gap or Sighting in the database; "
                    "this command only summarises and flags possible inconsistencies."
                )
            )
