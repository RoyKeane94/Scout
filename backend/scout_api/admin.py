from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Organisation, User, Venue, Brand, FieldConfig, Sighting, ErrorLog, Gap


@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'slug', 'unique_code', 'created_at')
    search_fields = ('name', 'unique_code')
    readonly_fields = ('unique_code',)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'organisation', 'role', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_staff', 'organisation')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    filter_horizontal = ()
    fieldsets = BaseUserAdmin.fieldsets + (
        (None, {'fields': ('organisation', 'role')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (None, {'fields': ('organisation', 'role')}),
    )


@admin.register(Venue)
class VenueAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'venue_type', 'organisation', 'created_at')
    list_filter = ('venue_type', 'organisation')
    search_fields = ('name',)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'organisation', 'is_own_brand', 'created_at')
    list_filter = ('is_own_brand', 'organisation')
    search_fields = ('name',)


@admin.register(FieldConfig)
class FieldConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'organisation', 'field_id', 'is_active', 'display_order')
    list_filter = ('organisation', 'is_active')
    ordering = ('organisation', 'display_order')


@admin.register(Gap)
class GapAdmin(admin.ModelAdmin):
    list_display = ('id', 'organisation', 'venue', 'submitted_by', 'created_at')
    list_filter = ('organisation', 'created_at')
    search_fields = ('venue__name',)
    raw_id_fields = ('venue', 'submitted_by')
    readonly_fields = ('created_at',)


@admin.register(Sighting)
class SightingAdmin(admin.ModelAdmin):
    list_display = ('id', 'organisation', 'brand', 'venue', 'submitted_by', 'created_at')
    list_filter = ('organisation', 'created_at')
    search_fields = ('venue__name', 'brand__name')
    raw_id_fields = ('venue', 'brand', 'submitted_by')
    readonly_fields = ('created_at',)


@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'source', 'url', 'user_id', 'created_at')
    list_filter = ('source', 'created_at')
    search_fields = ('message', 'url')
    readonly_fields = ('message', 'stack', 'source', 'url', 'user_agent', 'user_id', 'extra', 'created_at')
    ordering = ('-created_at',)
