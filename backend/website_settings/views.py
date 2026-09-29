import os
import uuid
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import WebsiteSettings
from .serializers import PublicWebsiteSettingsSerializer, AdminWebsiteSettingsSerializer

ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'}
ALLOWED_BG_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def _is_admin(user):
    return user.is_authenticated and user.role == 'admin'


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ENDPOINT — Safe read-only for login page (no auth required)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_website_settings(request):
    """
    Public read-only endpoint. Returns only safe branding fields needed
    by the login page. No sensitive or admin-only data is exposed.
    """
    settings = WebsiteSettings.get_settings()
    serializer = PublicWebsiteSettingsSerializer(settings, context={'request': request})
    return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN ENDPOINTS — Full read/write, Admin only
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def admin_website_settings(request):
    """
    GET:  Admin reads current website settings.
    PATCH: Admin updates text/config fields (not files).
    """
    if not _is_admin(request.user):
        return Response(
            {'error': 'PERMISSION DENIED: Only Administrators can manage website settings.'},
            status=status.HTTP_403_FORBIDDEN
        )

    settings = WebsiteSettings.get_settings()

    if request.method == 'GET':
        serializer = AdminWebsiteSettingsSerializer(settings, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'PATCH':
        # Only allow safe text/config fields — not file fields
        allowed_fields = {
            'college_name', 'short_name', 'tagline',
            'affiliation_text', 'accreditation_text', 'website_url',
            'address_line_1', 'address_line_2', 'city', 'district',
            'postal_code', 'phone', 'email',
            'background_position', 'background_overlay_opacity',
            'login_title', 'login_subtitle', 'login_description',
            'username_label', 'username_placeholder',
            'password_label', 'password_placeholder',
            'login_button_text', 'footer_text',
            'primary_color', 'secondary_color', 'accent_color',
            'background_color', 'text_color', 'border_color',
            'show_logo', 'show_institutional_info',
            'show_password_toggle', 'show_development_credentials',
        }
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        serializer = AdminWebsiteSettingsSerializer(
            settings, data=data, partial=True, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_logo(request):
    """Admin uploads a new college logo."""
    if not _is_admin(request.user):
        return Response(
            {'error': 'PERMISSION DENIED: Only Administrators can upload logos.'},
            status=status.HTTP_403_FORBIDDEN
        )

    file = request.FILES.get('logo')
    if not file:
        return Response({'error': 'No logo file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = os.path.splitext(file.name)[1].lower()
    allowed_exts = {'.jpg', '.jpeg', '.png', '.webp', '.svg'}
    if file.content_type not in ALLOWED_IMAGE_TYPES or ext not in allowed_exts:
        return Response(
            {'error': f'Invalid file type ({file.content_type}, extension {ext}). Allowed: PNG, JPG, JPEG, WEBP, SVG.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if file.size > MAX_IMAGE_SIZE:
        return Response(
            {'error': f'File too large: {(file.size / (1024*1024)):.2f} MB. Maximum allowed is 5 MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Generate a safe, unique filename
    safe_ext = ext if ext else '.png'
    file.name = f"logo_{uuid.uuid4().hex[:12]}{safe_ext}"

    settings = WebsiteSettings.get_settings()

    # Delete old logo file if it exists
    if settings.logo:
        try:
            old_path = settings.logo.path
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass

    settings.logo = file
    settings.updated_by = request.user
    settings.save()

    serializer = AdminWebsiteSettingsSerializer(settings, context={'request': request})
    return Response({
        'message': 'Logo uploaded successfully.',
        'logo_url': serializer.data['logo_url'],
    })


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_logo(request):
    """Admin removes the custom logo (reverts to default placeholder)."""
    if not _is_admin(request.user):
        return Response(
            {'error': 'PERMISSION DENIED: Only Administrators can remove logos.'},
            status=status.HTTP_403_FORBIDDEN
        )

    settings = WebsiteSettings.get_settings()

    if settings.logo:
        try:
            old_path = settings.logo.path
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass
        settings.logo = None
        settings.updated_by = request.user
        settings.save()

    return Response({'message': 'Logo removed. Default placeholder will be used.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_background(request):
    """Admin uploads a new login page background image."""
    if not _is_admin(request.user):
        return Response(
            {'error': 'PERMISSION DENIED: Only Administrators can upload backgrounds.'},
            status=status.HTTP_403_FORBIDDEN
        )

    file = request.FILES.get('background')
    if not file:
        return Response({'error': 'No background file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = os.path.splitext(file.name)[1].lower()
    if file.content_type not in ALLOWED_BG_TYPES or ext not in ALLOWED_EXTENSIONS:
        return Response(
            {'error': f'Invalid file type ({file.content_type}, extension {ext}). Allowed: PNG, JPG, JPEG, WEBP.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    if file.size > MAX_IMAGE_SIZE:
        return Response(
            {'error': f'File too large: {(file.size / (1024*1024)):.2f} MB. Maximum allowed is 5 MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Generate a safe, unique filename
    safe_ext = ext if ext else '.jpg'
    file.name = f"bg_{uuid.uuid4().hex[:12]}{safe_ext}"

    settings = WebsiteSettings.get_settings()

    # Delete old background
    if settings.login_background:
        try:
            old_path = settings.login_background.path
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass

    settings.login_background = file
    settings.updated_by = request.user
    settings.save()

    serializer = AdminWebsiteSettingsSerializer(settings, context={'request': request})
    return Response({
        'message': 'Login background uploaded successfully.',
        'background_url': serializer.data['background_url'],
    })


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_background(request):
    """Admin removes the custom login background."""
    if not _is_admin(request.user):
        return Response(
            {'error': 'PERMISSION DENIED: Only Administrators can remove backgrounds.'},
            status=status.HTTP_403_FORBIDDEN
        )

    settings = WebsiteSettings.get_settings()

    if settings.login_background:
        try:
            old_path = settings.login_background.path
            if os.path.exists(old_path):
                os.remove(old_path)
        except Exception:
            pass
        settings.login_background = None
        settings.updated_by = request.user
        settings.save()

    return Response({'message': 'Login background removed. Default gradient will be used.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def reset_to_defaults(request):
    """Admin resets all website settings to factory defaults."""
    if not _is_admin(request.user):
        return Response(
            {'error': 'PERMISSION DENIED: Only Administrators can reset website settings.'},
            status=status.HTTP_403_FORBIDDEN
        )

    settings = WebsiteSettings.get_settings()

    # Remove uploaded files
    for field in ['logo', 'login_background']:
        file_field = getattr(settings, field)
        if file_field:
            try:
                path = file_field.path
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass

    # Delete and recreate with defaults
    settings.delete()
    new_settings = WebsiteSettings.objects.create(pk=1, updated_by=request.user)

    serializer = AdminWebsiteSettingsSerializer(new_settings, context={'request': request})
    return Response({
        'message': 'Website settings reset to defaults successfully.',
        'settings': serializer.data,
    })
