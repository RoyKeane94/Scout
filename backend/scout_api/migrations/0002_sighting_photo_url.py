# Generated migration for S3-ready photo_url field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scout_api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='sighting',
            name='photo_url',
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
