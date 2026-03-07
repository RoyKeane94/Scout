# Generated migration for promo_details field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scout_api', '0002_sighting_photo_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='sighting',
            name='promo_details',
            field=models.TextField(blank=True, null=True),
        ),
    ]
