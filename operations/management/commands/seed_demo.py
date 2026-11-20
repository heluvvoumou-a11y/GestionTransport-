from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from operations.models import Agency, Route, Vehicle, Seat, Driver, Trip


class Command(BaseCommand):
    help = "Initialise les données de démonstration et les comptes de test."

    DEMO_USERS = [
        ("agent_test", "AGENT", "AgentTest123!"),
        ("controleur_test", "CONTROLEUR", "ControleurTest123!"),
        ("caissier_test", "CAISSIER", "CaissierTest123!"),
        ("exploitation_test", "EXPLOITATION", "ExploitationTest123!"),
        ("responsable_test", "RESPONSABLE", "ResponsableTest123!"),
    ]

    @transaction.atomic
    def handle(self, *args, **kwargs):
        agency, _ = Agency.objects.get_or_create(
            name="Agence Bamako",
            defaults={"city": "Bamako", "address": "Centre-ville"},
        )

        route, _ = Route.objects.get_or_create(
            origin="Bamako",
            destination="Sikasso",
            defaults={"distance_km": 370, "estimated_minutes": 360},
        )

        vehicle, _ = Vehicle.objects.get_or_create(
            registration="ML-DEMO-001",
            defaults={"brand": "Mercedes", "model": "Autocar", "capacity": 30},
        )

        driver, _ = Driver.objects.get_or_create(
            license_number="DEMO-PERMIS-001",
            defaults={
                "first_name": "Moussa",
                "last_name": "Traore",
                "phone": "70000000",
            },
        )

        Seat.objects.bulk_create(
            [
                Seat(vehicle=vehicle, number=n)
                for n in range(1, vehicle.capacity + 1)
            ],
            ignore_conflicts=True,
        )

        trip = Trip.objects.filter(
            route=route,
            agency=agency,
            vehicle=vehicle,
            driver=driver,
            departure_at__gte=timezone.now(),
        ).order_by("departure_at").first()

        if trip is None:
            tomorrow = timezone.localdate() + timedelta(days=1)
            departure = timezone.make_aware(
                datetime.combine(tomorrow, time(8, 0)),
                timezone.get_current_timezone(),
            )
            Trip.objects.create(
                route=route,
                agency=agency,
                vehicle=vehicle,
                driver=driver,
                departure_at=departure,
                price=10000,
            )

        User = get_user_model()

        for username, role, password in self.DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.local",
                    "is_active": True,
                },
            )

            if created:
                user.set_password(password)
                user.save(update_fields=["password"])

            UserProfile.objects.update_or_create(
                user=user,
                defaults={"role": role, "agency": agency},
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"Compte créé : {username} / {password}")
                )
            else:
                self.stdout.write(
                    f"Compte existant conservé : {username} (mot de passe inchangé)"
                )

        admin, admin_created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.local",
                "is_staff": True,
                "is_superuser": True,
            },
        )

        if admin_created:
            admin.set_password("Admin12345!")
            admin.save(update_fields=["password"])
            self.stdout.write(
                self.style.WARNING("Compte créé : admin / Admin12345!")
            )

        self.stdout.write(
            self.style.SUCCESS("Initialisation des données terminée.")
        )
