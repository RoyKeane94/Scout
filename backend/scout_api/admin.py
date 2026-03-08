from django.contrib import admin
from .models import ErrorLog


@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'source', 'url', 'user_id', 'created_at')
    list_filter = ('source', 'created_at')
    search_fields = ('message', 'url')
    readonly_fields = ('message', 'stack', 'source', 'url', 'user_agent', 'user_id', 'extra', 'created_at')
    ordering = ('-created_at',)
