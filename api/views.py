from django.contrib.auth import get_user_model

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from operations.models import (
    Agency,
    Route,
    Driver,
    Vehicle,
    Seat,
    Trip,
    Reservation,
    Payment,
    Ticket,
    Refund,
    Luggage,
)

from operations.services import (
    create_reservation,
    confirm_payment,
    cancel_reservation,
    request_refund,
    approve_refund,
    reject_refund,
    check_ticket,
    BusinessError,
)

from .serializers import (
    UserSerializer,
    UserManagementSerializer,
    AgencySerializer,
    RouteSerializer,
    DriverSerializer,
    VehicleSerializer,
    SeatSerializer,
    TripSerializer,
    ReservationSerializer,
    PaymentSerializer,
    TicketSerializer,
    RefundSerializer,
    LuggageSerializer,
)

from .permissions import (
    IsResponsable,
    IsResponsableOrExploitation,
    IsAgentOrResponsable,
    IsTripAccess,
    IsReservationAccess,
    IsPaymentReader,
    IsTicketAccess,
    IsRefundAccess,
)

User = get_user_model()


# ==========================================
# INFORMATIONS DE L'UTILISATEUR CONNECTE
# ==========================================

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ==========================================
# GESTION DES UTILISATEURS
# RESPONSABLE UNIQUEMENT
# ==========================================

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related(
        "profile",
        "profile__agency"
    ).all().order_by("username")

    serializer_class = UserManagementSerializer
    permission_classes = [IsAuthenticated, IsResponsable]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        if user.pk == request.user.pk:
            return Response(
                {"detail": "Vous ne pouvez pas supprimer votre propre compte."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.is_superuser:
            return Response(
                {"detail": "La suppression d'un superutilisateur est interdite."},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().destroy(request, *args, **kwargs)


# ==========================================
# GESTION DES AGENCES
# RESPONSABLE UNIQUEMENT
# ==========================================

class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all().order_by("name")
    serializer_class = AgencySerializer
    permission_classes = [IsAuthenticated, IsResponsable]


# ==========================================
# GESTION DES ITINERAIRES
# ==========================================

class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.all().order_by(
        "origin",
        "destination"
    )
    serializer_class = RouteSerializer
    permission_classes = [
        IsAuthenticated,
        IsResponsableOrExploitation
    ]


# ==========================================
# GESTION DES CHAUFFEURS
# ==========================================

class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all().order_by(
        "last_name",
        "first_name"
    )
    serializer_class = DriverSerializer
    permission_classes = [
        IsAuthenticated,
        IsResponsableOrExploitation
    ]


# ==========================================
# GESTION DES VEHICULES
# ==========================================

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("registration")
    serializer_class = VehicleSerializer
    permission_classes = [
        IsAuthenticated,
        IsResponsableOrExploitation
    ]


# ==========================================
# GESTION DES PLACES
# ==========================================

class SeatViewSet(viewsets.ModelViewSet):
    serializer_class = SeatSerializer
    permission_classes = [IsAuthenticated, IsTripAccess]

    def get_queryset(self):
        qs = Seat.objects.select_related("vehicle").all()
        vehicle_id = self.request.query_params.get("vehicle")

        return (
            qs.filter(vehicle_id=vehicle_id)
            if vehicle_id else qs
        )


# ==========================================
# GESTION DES DEPARTS
# ==========================================

class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated, IsTripAccess]

    queryset = Trip.objects.select_related(
        "route",
        "agency",
        "vehicle",
        "driver"
    ).all().order_by("departure_at")

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
            raise ValidationError({
                "vehicle": "Ce véhicule est déjà affecté à un départ sur cette période."
            })

        if conflicts.filter(driver=trip["driver"]).exists():
            raise ValidationError({
                "driver": "Ce chauffeur est déjà affecté à un départ sur cette période."
            })

        obj = serializer.save()

        Seat.objects.bulk_create(
            [
                Seat(vehicle=obj.vehicle, number=n)
                for n in range(1, obj.vehicle.capacity + 1)
            ],
            ignore_conflicts=True,
        )


# ==========================================
# GESTION DES RESERVATIONS
# ==========================================

class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [
        IsAuthenticated,
        IsReservationAccess
    ]

    queryset = Reservation.objects.select_related(
        "trip",
        "seat",
        "created_by"
    ).all()

    def create(self, request, *args, **kwargs):
        required = (
            "trip",
            "seat",
            "passenger_name",
            "passenger_phone"
        )

        missing = [
            field for field in required
            if not request.data.get(field)
        ]

        if missing:
            return Response(
                {
                    "detail": "Champs obligatoires manquants.",
                    "fields": missing
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reservation = create_reservation(
                trip_id=request.data["trip"],
                seat_id=request.data["seat"],
                passenger_name=request.data["passenger_name"],
                passenger_phone=request.data["passenger_phone"],
                user=request.user,
            )

        except (
            BusinessError,
            Trip.DoesNotExist,
            Seat.DoesNotExist
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            self.get_serializer(reservation).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        reservation = self.get_object()

        amount = request.data.get("amount")
        method = request.data.get("method", "CASH")

        if not isinstance(amount, int) or isinstance(amount, bool):
            return Response(
                {"detail": "amount doit être un entier en FCFA."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if method not in ("CASH", "MOBILE", "CARD"):
            return Response(
                {"detail": "method doit être CASH, MOBILE ou CARD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = confirm_payment(
                reservation_id=reservation.id,
                amount=amount,
                method=method,
                user=request.user
            )

        except BusinessError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )

        reservation.refresh_from_db()

        ticket = Ticket.objects.filter(
            reservation=reservation
        ).first()

        return Response(
            {
                "payment": PaymentSerializer(payment).data,
                "reservation_status": reservation.status,
                "ticket": (
                    TicketSerializer(ticket).data
                    if ticket else None
                ),
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            reservation = cancel_reservation(
                reservation_id=self.get_object().id,
                user=request.user
            )

        except BusinessError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            self.get_serializer(reservation).data
        )


# ==========================================
# CONSULTATION DES PAIEMENTS
# ==========================================

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [
        IsAuthenticated,
        IsPaymentReader
    ]

    serializer_class = PaymentSerializer

    queryset = Payment.objects.select_related(
        "reservation"
    ).all().order_by("-paid_at")

    def get_queryset(self):
        qs = super().get_queryset()
        reservation_id = self.request.query_params.get("reservation")

        return (
            qs.filter(reservation_id=reservation_id)
            if reservation_id else qs
        )


# ==========================================
# GESTION DES REMBOURSEMENTS
# CAISSIER ET RESPONSABLE
# ==========================================

class RefundViewSet(viewsets.ModelViewSet):
    serializer_class = RefundSerializer
    permission_classes = [
        IsAuthenticated,
        IsRefundAccess
    ]

    http_method_names = [
        "get",
        "post",
        "head",
        "options"
    ]

    queryset = Refund.objects.select_related(
        "reservation",
        "requested_by",
        "approved_by",
        "refunded_by"
    ).all().order_by("-created_at")

    def create(self, request, *args, **kwargs):
        reservation_id = request.data.get("reservation")
        amount = request.data.get("amount")
        reason = request.data.get("reason", "")

        if not reservation_id or not reason:
            return Response(
                {
                    "detail": "Les champs reservation et reason sont obligatoires."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if (
            not isinstance(amount, int)
            or isinstance(amount, bool)
            or amount <= 0
        ):
            return Response(
                {
                    "detail": "amount doit être un entier positif en FCFA."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refund = request_refund(
                reservation_id=reservation_id,
                amount=amount,
                reason=reason,
                user=request.user
            )

        except (
            BusinessError,
            Reservation.DoesNotExist,
            ValueError,
            TypeError
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            self.get_serializer(refund).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        try:
            refund = approve_refund(
                refund_id=self.get_object().id,
                user=request.user
            )

        except (
            BusinessError,
            Refund.DoesNotExist
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            self.get_serializer(refund).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        try:
            refund = reject_refund(
                refund_id=self.get_object().id,
                user=request.user
            )

        except (
            BusinessError,
            Refund.DoesNotExist
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            self.get_serializer(refund).data,
            status=status.HTTP_200_OK
        )


# ==========================================
# CONSULTATION ET CONTROLE DES BILLETS
# ==========================================

class TicketViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [
        IsAuthenticated,
        IsTicketAccess
    ]

    serializer_class = TicketSerializer

    queryset = Ticket.objects.select_related(
        "reservation"
    ).all().order_by("-issued_at")

    @action(
        detail=False,
        methods=["post"],
        url_path="check"
    )
    def check(self, request):
        code = request.data.get("code")

        if not code:
            return Response(
                {"detail": "Le champ code est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ticket = check_ticket(
                ticket_code=code,
                user=request.user
            )

        except (
            BusinessError,
            Ticket.DoesNotExist,
            ValueError
        ) as exc:
            return Response(
                {"detail": str(exc) or "Billet introuvable."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            self.get_serializer(ticket).data
        )


# ==========================================
# GESTION DES BAGAGES
# ==========================================

class LuggageViewSet(viewsets.ModelViewSet):
    serializer_class = LuggageSerializer
    permission_classes = [
        IsAuthenticated,
        IsAgentOrResponsable
    ]

    queryset = Luggage.objects.select_related(
        "reservation"
    ).all().order_by("-created_at")