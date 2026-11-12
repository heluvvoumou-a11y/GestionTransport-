
from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    ROLES = [
        ("AGENT", "Agent de guichet"),
        ("CONTROLEUR", "Contrôleur"),
        ("ADMIN", "Administrateur"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile"
    )

    role = models.CharField(
        max_length=20,
        choices=ROLES,
        default="AGENT"
    )

    agency = models.ForeignKey(
        "operations.Agency",
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"
