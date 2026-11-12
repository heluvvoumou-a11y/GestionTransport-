
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

user = get_user_model().objects.get(username="Solo")

client = APIClient()
client.force_authenticate(user=user)

paths = [
    "/api/",
    "/api/me/",
    "/api/agencies/",
    "/api/routes/",
    "/api/drivers/",
    "/api/vehicles/",
    "/api/seats/",
    "/api/trips/",
    "/api/reservations/",
    "/api/payments/",
    "/api/tickets/",
    "/api/luggage/",
]

for path in paths:
    response = client.options(path)
    print(
        path,
        "->",
        response.status_code,
        "| METHODES :",
        response.get("Allow")
    )

    print("\n===== TEST DES URL DETAIL =====")

    detail_paths = [
        "/api/agencies/1/",
        "/api/routes/1/",
        "/api/drivers/1/",
        "/api/vehicles/1/",
        "/api/seats/1/",
        "/api/trips/1/",
        "/api/reservations/1/",
        "/api/payments/1/",
        "/api/tickets/1/",
        "/api/luggage/1/",
    ]

    for path in detail_paths:
        response = client.options(path)
        print(
            path,
            "->",
            response.status_code,
            "| METHODES :",
            response.get("Allow")
        )

