from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from operations.models import Trip, Seat

User = get_user_model()
user = User.objects.get(username="Solo")

trip = Trip.objects.filter(status="PLANNED").first()
if not trip:
    print("ERREUR : aucun voyage planifié.")
else:
    seat = Seat.objects.filter(vehicle=trip.vehicle).order_by("number").first()

    client = APIClient()
    client.force_authenticate(user=user)

    data = {
        "trip": trip.id,
        "seat": seat.id,
        "passenger_name": "Test Passager",
        "passenger_phone": "70000001",
        "passenger_document": "DEMO001"
    }

    response = client.post("/api/reservations/", data, format="json")

    print("\n===== TEST CREATION RESERVATION =====")
    print("Code HTTP :", response.status_code)
    print("Réponse :", response.data)
