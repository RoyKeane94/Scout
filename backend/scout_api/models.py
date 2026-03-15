import random
import string
from django.db import models
from django.contrib.auth.models import AbstractUser


def generate_unique_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Organisation.objects.filter(unique_code=code).exists():
            return code


class Organisation(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    unique_code = models.CharField(max_length=6, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.unique_code:
            self.unique_code = generate_unique_code()
        if not self.slug:
            base = self.name.lower().replace(' ', '-')[:50]
            self.slug = base
            n = 1
            while Organisation.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug = f"{base}-{n}"
                n += 1
        super().save(*args, **kwargs)


class User(AbstractUser):
    ROLE_CHOICES = [('admin', 'admin'), ('member', 'member')]
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')


class Venue(models.Model):
    VENUE_TYPES = [
        ('cafe', 'cafe'), ('pub', 'pub'), ('bar', 'bar'), ('deli', 'deli'),
        ('gym', 'gym'), ('restaurant', 'restaurant'), ('shop', 'shop'), ('other', 'other'),
    ]
    name = models.CharField(max_length=255)
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    venue_type = models.CharField(max_length=20, choices=VENUE_TYPES)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Brand(models.Model):
    name = models.CharField(max_length=255)
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    is_own_brand = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class FieldConfig(models.Model):
    FIELD_IDS = ['brand', 'placement', 'price', 'obs', 'promo', 'notes', 'unit']
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    field_id = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)


class Town(models.Model):
    """Locality from geocode; one per (organisation, name) for search/filter."""
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = [('organisation', 'name')]
        ordering = ['name']

    def __str__(self):
        return self.name


class ErrorLog(models.Model):
    """Client-side and runtime errors logged for debugging."""
    message = models.TextField()
    stack = models.TextField(blank=True, null=True)
    source = models.CharField(max_length=50, blank=True)  # e.g. 'error_boundary', 'unhandled', 'api'
    url = models.CharField(max_length=500, blank=True)
    user_agent = models.TextField(blank=True, null=True)
    user_id = models.IntegerField(null=True, blank=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Gap(models.Model):
    """A venue where there are no direct competitors (gap opportunity)."""
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Sighting(models.Model):
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE)
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    venue = models.ForeignKey(Venue, on_delete=models.CASCADE)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE)
    photo_b64 = models.TextField(null=True, blank=True)  # legacy / Postgres-backed; use photo_url when S3
    photo_url = models.URLField(max_length=500, null=True, blank=True)  # S3 (or CDN) URL when set
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    town = models.ForeignKey('Town', on_delete=models.SET_NULL, null=True, blank=True, related_name='sightings')
    data = models.JSONField(default=dict)
    promo_details = models.TextField(blank=True, null=True)  # details when a promotion is logged
    created_at = models.DateTimeField(auto_now_add=True)
