from rest_framework.routers import DefaultRouter
from .views import (
    MeView, AgencyViewSet, RouteViewSet, DriverViewSet, VehicleViewSet,
    SeatViewSet, TripViewSet, ReservationViewSet, PaymentViewSet,
    TicketViewSet, LuggageViewSet,
)
from django.urls import path, include

router = DefaultRouter()
router.register("agencies", AgencyViewSet)
router.register("routes", RouteViewSet)
router.register("drivers", DriverViewSet)
router.register("vehicles", VehicleViewSet)
router.register("seats", SeatViewSet, basename="seat")
router.register("trips", TripViewSet, basename="trip")
router.register("reservations", ReservationViewSet, basename="reservation")
router.register("payments", PaymentViewSet, basename="payment")
router.register("tickets", TicketViewSet, basename="ticket")
router.register("luggage", LuggageViewSet, basename="luggage")

urlpatterns = [
    path("me/", MeView.as_view(), name="api-me"),
    path("", include(router.urls)),
]
