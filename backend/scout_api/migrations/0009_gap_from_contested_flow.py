from django.db import migrations, models


def backfill_contested_flow(apps, schema_editor):
    """Mark gaps at venues that only have competitor sightings (no own-brand) as contested-flow triage."""
    Gap = apps.get_model('scout_api', 'Gap')
    Sighting = apps.get_model('scout_api', 'Sighting')
    own_venue_ids = set(
        Sighting.objects.filter(brand__is_own_brand=True).values_list('venue_id', flat=True).distinct()
    )
    contested_venue_ids = set(
        Sighting.objects.filter(brand__is_own_brand=False)
        .exclude(venue_id__in=own_venue_ids)
        .values_list('venue_id', flat=True)
        .distinct()
    )
    if contested_venue_ids:
        Gap.objects.filter(venue_id__in=contested_venue_ids).update(from_contested_flow=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('scout_api', '0008_gap_status_stage_town'),
    ]

    operations = [
        migrations.AddField(
            model_name='gap',
            name='from_contested_flow',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill_contested_flow, noop_reverse),
    ]
