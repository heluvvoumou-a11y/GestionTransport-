from rest_framework.routers import DefaultRouter
from django.urls import path, include

from .views import (
    MeView,
    UserViewSet,
    AgencyViewSet,
    RouteViewSet,
    DriverViewSet,
    VehicleViewSet,
    SeatViewSet,
    TripViewSet,
    ReservationViewSet,
    PaymentViewSet,
    RefundViewSet,
    TicketViewSet,
    LuggageViewSet,
)


router = DefaultRouter()

# Gestion des utilisateurs
router.register("users", UserViewSet, basename="user")

# Gestion des agences
router.register("agencies", AgencyViewSet)

# Gestion des itinéraires
router.register("routes", RouteViewSet)

# Gestion des chauffeurs
router.register("drivers", DriverViewSet)

# Gestion des véhicules
router.register("vehicles", VehicleViewSet)

# Gestion des places
router.register("seats", SeatViewSet, basename="seat")

# Gestion des départs
router.register("trips", TripViewSet, basename="trip")

# Gestion des réservations
router.register("reservations", ReservationViewSet, basename="reservation")

# Gestion des paiements
router.register("payments", PaymentViewSet, basename="payment")

# Gestion des remboursements
router.register("refunds", RefundViewSet, basename="refund")

# Gestion des billets
router.register("tickets", TicketViewSet, basename="ticket")

# Gestion des bagages
router.register("luggage", LuggageViewSet, basename="luggage")


urlpatterns = [
    path("me/", MeView.as_view(), name="api-me"),
    path("", include(router.urls)),
]