from django.db import models
from django.utils import timezone


class WebsiteSettings(models.Model):
    """
    Singleton model storing all customizable website/branding settings.
    Only one row should ever exist (pk=1). Use WebsiteSettings.get_settings().
    """

    # ── College Identity ──────────────────────────────────────────────────
    college_name = models.CharField(
        max_length=200,
        default="Krishnasamy College of Engineering & Technology"
    )
    short_name = models.CharField(max_length=50, default="KCET")
    tagline = models.CharField(max_length=300, default="Excellence in Engineering Education")
    affiliation_text = models.CharField(
        max_length=300, default="Affiliated to Anna University"
    )
    accreditation_text = models.CharField(
        max_length=300, default="Accredited by NAAC • Approved by AICTE"
    )
    website_url = models.URLField(max_length=200, default="https://www.kcet.in", blank=True)

    # ── Contact / Address ────────────────────────────────────────────────
    address_line_1 = models.CharField(max_length=200, default="Anand Nagar, Nellikuppam Main Road")
    address_line_2 = models.CharField(max_length=200, default="S. Kumarapuram", blank=True)
    city = models.CharField(max_length=100, default="Cuddalore")
    district = models.CharField(max_length=100, default="Cuddalore", blank=True)
    postal_code = models.CharField(max_length=20, default="607 109")
    phone = models.CharField(max_length=100, default="04142-285601 to 285604")
    email = models.EmailField(max_length=200, default="info@kcet.in", blank=True)

    # ── Branding Assets ──────────────────────────────────────────────────
    logo = models.ImageField(upload_to='branding/logos/', null=True, blank=True)
    login_background = models.ImageField(
        upload_to='branding/backgrounds/', null=True, blank=True
    )
    background_position = models.CharField(
        max_length=50, default="center center", blank=True
    )
    background_overlay_opacity = models.FloatField(default=0.55)  # 0.0 to 1.0

    # ── Login Page Text ──────────────────────────────────────────────────
    login_title = models.CharField(max_length=200, default="KCET ERP")
    login_subtitle = models.CharField(
        max_length=300, default="Academic Management System"
    )
    login_description = models.CharField(
        max_length=500,
        default="Sign in to access the KCET Academic ERP Portal",
        blank=True
    )
    username_label = models.CharField(
        max_length=200, default="Email / Staff Code / Register Number"
    )
    username_placeholder = models.CharField(
        max_length=200, default="Enter your email or register number"
    )
    password_label = models.CharField(max_length=100, default="Password")
    password_placeholder = models.CharField(max_length=100, default="Enter your password")
    login_button_text = models.CharField(max_length=100, default="Sign In to KCET ERP")
    footer_text = models.CharField(
        max_length=500,
        default="© 2026 Krishnasamy College of Engineering & Technology. All rights reserved.",
        blank=True
    )

    # ── Color Tokens ─────────────────────────────────────────────────────
    primary_color = models.CharField(max_length=30, default="hsl(215, 72%, 43%)")
    secondary_color = models.CharField(max_length=30, default="hsl(222, 36%, 14%)")
    accent_color = models.CharField(max_length=30, default="hsl(215, 75%, 60%)")
    background_color = models.CharField(max_length=30, default="hsl(210, 24%, 97%)")
    text_color = models.CharField(max_length=30, default="hsl(222, 30%, 14%)")
    border_color = models.CharField(max_length=30, default="hsl(214, 18%, 84%)")

    # ── Visibility Flags ─────────────────────────────────────────────────
    show_logo = models.BooleanField(default=True)
    show_institutional_info = models.BooleanField(default=True)
    show_password_toggle = models.BooleanField(default=True)
    show_development_credentials = models.BooleanField(default=False)

    # ── Meta ─────────────────────────────────────────────────────────────
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='website_settings_updates'
    )

    class Meta:
        verbose_name = "Website Settings"
        verbose_name_plural = "Website Settings"

    def __str__(self):
        return f"Website Settings — {self.college_name}"

    @classmethod
    def get_settings(cls):
        """Return the singleton settings row, creating it with defaults if it doesn't exist."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
