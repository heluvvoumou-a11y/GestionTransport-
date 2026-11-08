from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from operations.models import Agency, Route, Vehicle, Seat, Driver, Trip

class Command(BaseCommand):
    help = "Crée des données fictives de démonstration et un compte administrateur de test."
    def handle(self, *args, **kwargs):
        agency, _ = Agency.objects.get_or_create(name="Agence Bamako", defaults={"city":"Bamako","address":"Centre-ville"})
        route, _ = Route.objects.get_or_create(origin="Bamako", destination="Sikasso", defaults={"distance_km":370,"estimated_minutes":360})
        vehicle, _ = Vehicle.objects.get_or_create(registration="ML-DEMO-001", defaults={"brand":"Mercedes","model":"Autocar","capacity":30})
        driver, _ = Driver.objects.get_or_create(license_number="DEMO-PERMIS-001", defaults={"first_name":"Moussa","last_name":"Traore","phone":"70000000"})
        Seat.objects.bulk_create([Seat(vehicle=vehicle, number=n) for n in range(1, vehicle.capacity+1)], ignore_conflicts=True)
        Trip.objects.get_or_create(route=route, agency=agency, vehicle=vehicle, driver=driver,
            departure_at=timezone.now()+timedelta(days=1), defaults={"price":10000})
        User = get_user_model()
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@example.local", "Admin12345!")
            self.stdout.write(self.style.WARNING("Compte créé : admin / Admin12345! (à changer)"))
        self.stdout.write(self.style.SUCCESS("Données de démonstration créées."))
