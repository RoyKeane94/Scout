# Migration: Town model + Sighting.town as FK (data preserved from CharField)

from django.db import migrations, models
import django.db.models.deletion


def migrate_town_data(apps, schema_editor):
    Sighting = apps.get_model('scout_api', 'Sighting')
    Town = apps.get_model('scout_api', 'Town')
    for s in Sighting.objects.all():
        legacy = getattr(s, 'town_legacy', None) or getattr(s, 'town', None)
        if legacy and str(legacy).strip():
            town, _ = Town.objects.get_or_create(
                organisation_id=s.organisation_id,
                name=str(legacy).strip()[:255],
            )
            s.town_id = town.id
            s.save(update_fields=['town_id'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('scout_api', '0006_sighting_town'),
    ]

    operations = [
        migrations.CreateModel(
            name='Town',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('organisation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='scout_api.organisation')),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('organisation', 'name')},
            },
        ),
        migrations.RenameField(
            model_name='sighting',
            old_name='town',
            new_name='town_legacy',
        ),
        migrations.AddField(
            model_name='sighting',
            name='town',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sightings', to='scout_api.town'),
        ),
        migrations.RunPython(migrate_town_data, noop),
        migrations.RemoveField(
            model_name='sighting',
            name='town_legacy',
        ),
    ]
