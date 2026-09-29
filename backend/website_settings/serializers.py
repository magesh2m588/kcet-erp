from rest_framework import serializers
from .models import WebsiteSettings


class PublicWebsiteSettingsSerializer(serializers.ModelSerializer):
    """Safe public read-only serializer — used by the login page."""
    logo_url = serializers.SerializerMethodField()
    background_url = serializers.SerializerMethodField()

    class Meta:
        model = WebsiteSettings
        fields = [
            'college_name', 'short_name', 'tagline',
            'affiliation_text', 'accreditation_text',
            'website_url',
            'address_line_1', 'address_line_2', 'city', 'district',
            'postal_code', 'phone', 'email',
            'logo_url', 'background_url',
            'background_position', 'background_overlay_opacity',
            'login_title', 'login_subtitle', 'login_description',
            'username_label', 'username_placeholder',
            'password_label', 'password_placeholder',
            'login_button_text', 'footer_text',
            'primary_color', 'secondary_color', 'accent_color',
            'background_color', 'text_color', 'border_color',
            'show_logo', 'show_institutional_info',
            'show_password_toggle', 'show_development_credentials',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        if obj.logo:
            return obj.logo.url
        return None

    def get_background_url(self, obj):
        request = self.context.get('request')
        if obj.login_background and request:
            return request.build_absolute_uri(obj.login_background.url)
        if obj.login_background:
            return obj.login_background.url
        return None


class AdminWebsiteSettingsSerializer(serializers.ModelSerializer):
    """Full admin serializer — includes all fields for read and write."""
    logo_url = serializers.SerializerMethodField()
    background_url = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WebsiteSettings
        fields = [
            'id',
            'college_name', 'short_name', 'tagline',
            'affiliation_text', 'accreditation_text',
            'website_url',
            'address_line_1', 'address_line_2', 'city', 'district',
            'postal_code', 'phone', 'email',
            'logo_url', 'background_url',
            'background_position', 'background_overlay_opacity',
            'login_title', 'login_subtitle', 'login_description',
            'username_label', 'username_placeholder',
            'password_label', 'password_placeholder',
            'login_button_text', 'footer_text',
            'primary_color', 'secondary_color', 'accent_color',
            'background_color', 'text_color', 'border_color',
            'show_logo', 'show_institutional_info',
            'show_password_toggle', 'show_development_credentials',
            'updated_at', 'updated_by_name',
        ]
        read_only_fields = ['id', 'updated_at', 'updated_by_name', 'logo_url', 'background_url']

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        if obj.logo:
            return obj.logo.url
        return None

    def get_background_url(self, obj):
        request = self.context.get('request')
        if obj.login_background and request:
            return request.build_absolute_uri(obj.login_background.url)
        if obj.login_background:
            return obj.login_background.url
        return None

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.full_name or obj.updated_by.username
        return None
