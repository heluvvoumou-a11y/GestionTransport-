from datetime import timedelta
from django.utils import timezone
from operations.models import Agency, Route, Driver, Vehicle, Seat, Trip

agency, _ = Agency.objects.get_or_create(
    name="Agence Centrale",
    defaults={
        "city": "Bamako",
        "address": "Centre-ville",
        "phone": "70000000"
    }
)

route, _ = Route.objects.get_or_create(
    origin="Bamako",
    destination="Sikasso",
    defaults={
        "distance_km": 375,
        "estimated_minutes": 360
    }
)

driver, _ = Driver.objects.get_or_create(
    license_number="PERMIS-DEMO-001",
    defaults={
        "first_name": "Mamadou",
        "last_name": "Diallo",
        "phone": "71000000",
        "active": True
    }
)

vehicle, _ = Vehicle.objects.get_or_create(
    registration="DEMO-001",
    defaults={
        "brand": "Mercedes",
        "model": "Bus",
        "capacity": 30,
        "available": True
    }
)

Seat.objects.bulk_create(
    [
        Seat(vehicle=vehicle, number=n)
        for n in range(1, vehicle.capacity + 1)
    ],
    ignore_conflicts=True
)

departure = timezone.now() + timedelta(days=2)

trip, created = Trip.objects.get_or_create(
    route=route,
    agency=agency,
    vehicle=vehicle,
    driver=driver,
    departure_at=departure,
    defaults={
        "arrival_at": departure + timedelta(hours=6),
        "price": 15000,
        "status": "PLANNED",
        "notes": "Voyage de démonstration"
    }
)

print("\n===== DONNEES DE DEMONSTRATION =====")
print("Agence ID :", agency.id)
print("Route ID :", route.id)
print("Chauffeur ID :", driver.id)
print("Véhicule ID :", vehicle.id)
print("Nombre de places :", vehicle.seats.count())
print("Voyage ID :", trip.id)
print("Départ :", trip.departure_at)
print("Prix :", trip.price, "FCFA")
print("Création du voyage :", created)
