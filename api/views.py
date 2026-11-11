from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from operations.models import (
    Agency, Route, Driver, Vehicle, Seat, Trip, Reservation,
    Payment, Ticket, Refund, Luggage,
)
from operations.services import (
    create_reservation, confirm_payment, cancel_reservation,
    refund_reservation, check_ticket, BusinessError,
)
from .serializers import (
    UserSerializer, AgencySerializer, RouteSerializer, DriverSerializer,
    VehicleSerializer, SeatSerializer, TripSerializer, ReservationSerializer,
    PaymentSerializer, TicketSerializer, RefundSerializer, LuggageSerializer,
)

User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)

class ReadWriteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

class AgencyViewSet(ReadWriteViewSet):
    queryset = Agency.objects.all().order_by("name")
    serializer_class = AgencySerializer

class RouteViewSet(ReadWriteViewSet):
    queryset = Route.objects.all().order_by("origin", "destination")
    serializer_class = RouteSerializer

class DriverViewSet(ReadWriteViewSet):
    queryset = Driver.objects.all().order_by("last_name", "first_name")
    serializer_class = DriverSerializer

class VehicleViewSet(ReadWriteViewSet):
    queryset = Vehicle.objects.all().order_by("registration")
    serializer_class = VehicleSerializer

class SeatViewSet(ReadWriteViewSet):
    serializer_class = SeatSerializer
    def get_queryset(self):
        qs = Seat.objects.select_related("vehicle").all()
        vehicle_id = self.request.query_params.get("vehicle")
        return qs.filter(vehicle_id=vehicle_id) if vehicle_id else qs

class TripViewSet(ReadWriteViewSet):
    serializer_class = TripSerializer
    queryset = Trip.objects.select_related("route", "agency", "vehicle", "driver").all().order_by("departure_at")
    def get_queryset(self):
        qs = super().get_queryset()
        route_id = self.request.query_params.get("route")
        status_filter = self.request.query_params.get("status")
        if route_id:
            qs = qs.filter(route_id=route_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        trip = serializer.validated_data
        start = trip["departure_at"]
        end = trip.get("arrival_at") or start
        conflicts = Trip.objects.filter(
            status__in=("PLANNED", "BOARDING", "DEPARTED"),
            departure_at__lt=end,
            arrival_at__gt=start,
        )
        if conflicts.filter(vehicle=trip["vehicle"]).exists():
            raise ValidationError({"vehicle": "Ce véhicule est déjà affecté à un départ sur cette période."})
        if conflicts.filter(driver=trip["driver"]).exists():
            raise ValidationError({"driver": "Ce chauffeur est déjà affecté à un départ sur cette période."})
        obj = serializer.save()
        Seat.objects.bulk_create(
            [Seat(vehicle=obj.vehicle, number=n) for n in range(1, obj.vehicle.capacity + 1)],
            ignore_conflicts=True,
        )

class ReservationViewSet(ReadWriteViewSet):
    serializer_class = ReservationSerializer
    queryset = Reservation.objects.select_related("trip", "seat", "created_by").all()

    def create(self, request, *args, **kwargs):
        required = ("trip", "seat", "passenger_name", "passenger_phone")
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({"detail": "Champs obligatoires manquants.", "fields": missing},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            reservation = create_reservation(
                trip_id=request.data["trip"],
                seat_id=request.data["seat"],
                passenger_name=request.data["passenger_name"],
                passenger_phone=request.data["passenger_phone"],
                user=request.user,
            )
        except (BusinessError, Trip.DoesNotExist, Seat.DoesNotExist) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(reservation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        reservation = self.get_object()
        amount = request.data.get("amount")
        method = request.data.get("method", "CASH")
        if not isinstance(amount, int) or isinstance(amount, bool):
            return Response({"detail": "amount doit être un entier en FCFA."}, status=400)
        if method not in ("CASH", "MOBILE", "CARD"):
            return Response({"detail": "method doit être CASH, MOBILE ou CARD."}, status=400)
        try:
            payment = confirm_payment(reservation_id=reservation.id, amount=amount, method=method, user=request.user)
        except BusinessError as exc:
            return Response({"detail": str(exc)}, status=400)
        reservation.refresh_from_db()
        ticket = Ticket.objects.filter(reservation=reservation).first()
        return Response({
            "payment": PaymentSerializer(payment).data,
            "reservation_status": reservation.status,
            "ticket": TicketSerializer(ticket).data if ticket else None,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            reservation = cancel_reservation(reservation_id=self.get_object().id, user=request.user)
        except BusinessError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(self.get_serializer(reservation).data)

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        amount, reason = request.data.get("amount"), request.data.get("reason", "")
        if not isinstance(amount, int) or isinstance(amount, bool) or not reason:
            return Response({"detail": "Fournir amount (entier FCFA) et reason."}, status=400)
        try:
            refund = refund_reservation(reservation_id=self.get_object().id, amount=amount,
                                        reason=reason, user=request.user)
        except BusinessError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response(RefundSerializer(refund).data, status=201)

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("reservation").all().order_by("-paid_at")
    def get_queryset(self):
        qs = super().get_queryset()
        reservation_id = self.request.query_params.get("reservation")
        return qs.filter(reservation_id=reservation_id) if reservation_id else qs

class TicketViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TicketSerializer
    queryset = Ticket.objects.select_related("reservation").all().order_by("-issued_at")

    @action(detail=False, methods=["post"], url_path="check")
    def check(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"detail": "Le champ code est obligatoire."}, status=400)
        try:
            ticket = check_ticket(ticket_code=code, user=request.user)
        except (BusinessError, Ticket.DoesNotExist, ValueError) as exc:
            return Response({"detail": str(exc) or "Billet introuvable."}, status=400)
        return Response(self.get_serializer(ticket).data)

class LuggageViewSet(ReadWriteViewSet):
    serializer_class = LuggageSerializer
    queryset = Luggage.objects.select_related("reservation").all().order_by("-created_at")
