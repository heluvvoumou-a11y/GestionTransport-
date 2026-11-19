from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Sum, Q
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
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
    Luggage,
)

from operations.services import (
    create_reservation,
    confirm_payment,
    cancel_reservation,
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
    IsAgencyReader,
)

User = get_user_model()


# =====================================================
# OUTIL : RECUPERATION DU ROLE
# =====================================================

def get_role(user):
    if not user or not user.is_authenticated:
        return None

    if user.is_superuser:
        return "RESPONSABLE"

    profile = getattr(user, "profile", None)

    return profile.role if profile else None


# =====================================================
# OUTIL : CONVERSION DES MONTANTS
# =====================================================

def parse_positive_integer(value, field_name):
    if isinstance(value, bool):
        raise ValueError(
            f"{field_name} doit être un entier positif."
        )

    try:
        if isinstance(value, str):
            value = value.strip()

            if not value.isdigit():
                raise ValueError

        result = int(value)

        if result <= 0:
            raise ValueError

        return result

    except (TypeError, ValueError):
        raise ValueError(
            f"{field_name} doit être un entier positif."
        )


# =====================================================
# OUTIL : VERIFICATION DES CONFLITS DE DEPART
# =====================================================

def get_trip_conflicts(start, end, exclude_pk=None):
    """
    Recherche les départs qui chevauchent la période demandée.
    """

    if end is None:
        end = start + timedelta(seconds=1)

    if end <= start:
        raise ValidationError({
            "arrival_at": (
                "L'heure d'arrivée doit être postérieure "
                "à l'heure de départ."
            )
        })

    conflicts = Trip.objects.filter(
        status__in=[
            "PLANNED",
            "BOARDING",
            "DEPARTED",
        ]
    ).filter(
        Q(
            departure_at__lt=end,
            arrival_at__gt=start,
        )
        |
        Q(
            departure_at__lt=end,
            arrival_at__isnull=True,
        )
    )

    if exclude_pk is not None:
        conflicts = conflicts.exclude(pk=exclude_pk)

    return conflicts


# =====================================================
# TABLEAU DE BORD
# =====================================================

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = get_role(user)
        now = timezone.now()

        departures_count = Trip.objects.count()

        reservation_qs = Reservation.objects.all()

        if role == "AGENT":
            reservation_qs = reservation_qs.filter(
                created_by=user
            )

        reservations_count = reservation_qs.count()

        ticket_qs = Ticket.objects.all()

        if role == "AGENT":
            ticket_qs = ticket_qs.filter(
                reservation__created_by=user
            )

        tickets_count = ticket_qs.count()

        pending_qs = reservation_qs.filter(
            status="HOLD",
            hold_expires_at__gt=now,
        )

        pending_count = 0
        pending_amount = 0

        if role in ("AGENT", "CAISSIER", "RESPONSABLE"):
            pending_count = pending_qs.count()

            pending_amount = (
                pending_qs.aggregate(
                    total=Sum("amount")
                )["total"] or 0
            )

        total_paid = 0

        if role in ("CAISSIER", "RESPONSABLE"):
            total_paid = (
                Payment.objects.aggregate(
                    total=Sum("amount")
                )["total"] or 0
            )

        return Response({
            "role": role,
            "departures_count": departures_count,
            "reservations_count": reservations_count,
            "tickets_count": tickets_count,
            "total_paid": total_paid,
            "pending_payments_count": pending_count,
            "pending_payments_amount": pending_amount,
        })


# =====================================================
# INFORMATIONS DE L'UTILISATEUR CONNECTE
# =====================================================

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserSerializer(request.user).data
        )


# =====================================================
# GESTION DES UTILISATEURS
# =====================================================

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related(
        "profile",
        "profile__agency",
    ).all().order_by("username")

    serializer_class = UserManagementSerializer

    permission_classes = [
        IsAuthenticated,
        IsResponsable,
    ]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        if user.pk == request.user.pk:
            return Response(
                {
                    "detail": (
                        "Vous ne pouvez pas supprimer "
                        "votre propre compte."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_superuser:
            return Response(
                {
                    "detail": (
                        "La suppression d'un superutilisateur "
                        "est interdite."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().destroy(request, *args, **kwargs)


# =====================================================
# GESTION DES AGENCES
# =====================================================

class AgencyViewSet(viewsets.ModelViewSet):
    queryset = Agency.objects.all().order_by("name")
    serializer_class = AgencySerializer

    permission_classes = [
        IsAuthenticated,
        IsAgencyReader,
    ]


# =====================================================
# GESTION DES ITINERAIRES
# =====================================================

class RouteViewSet(viewsets.ModelViewSet):
    queryset = Route.objects.all().order_by(
        "origin",
        "destination",
    )

    serializer_class = RouteSerializer

    permission_classes = [
        IsAuthenticated,
        IsResponsableOrExploitation,
    ]


# =====================================================
# GESTION DES CHAUFFEURS
# =====================================================

class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all().order_by(
        "last_name",
        "first_name",
    )

    serializer_class = DriverSerializer

    permission_classes = [
        IsAuthenticated,
        IsResponsableOrExploitation,
    ]


# =====================================================
# GESTION DES VEHICULES
# =====================================================

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by(
        "registration",
    )

    serializer_class = VehicleSerializer

    permission_classes = [
        IsAuthenticated,
        IsResponsableOrExploitation,
    ]


# =====================================================
# GESTION DES PLACES
# =====================================================

class SeatViewSet(viewsets.ModelViewSet):
    serializer_class = SeatSerializer

    permission_classes = [
        IsAuthenticated,
        IsTripAccess,
    ]

    def get_queryset(self):
        qs = Seat.objects.select_related(
            "vehicle",
        ).all()

        vehicle_id = self.request.query_params.get("vehicle")

        if vehicle_id:
            qs = qs.filter(
                vehicle_id=vehicle_id,
            )

        return qs


# =====================================================
# GESTION DES DEPARTS
# =====================================================

class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer

    permission_classes = [
        IsAuthenticated,
        IsTripAccess,
    ]

    queryset = Trip.objects.select_related(
        "route",
        "agency",
        "vehicle",
        "driver",
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
        data = serializer.validated_data

        start = data["departure_at"]
        end = data.get("arrival_at")

        vehicle = data["vehicle"]
        driver = data["driver"]

        conflicts = get_trip_conflicts(start, end)

        if conflicts.filter(vehicle=vehicle).exists():
            raise ValidationError({
                "vehicle": (
                    "Ce véhicule est déjà affecté à "
                    "un autre départ sur cette période."
                )
            })

        if conflicts.filter(driver=driver).exists():
            raise ValidationError({
                "driver": (
                    "Ce chauffeur est déjà affecté à "
                    "un autre départ sur cette période."
                )
            })

        trip = serializer.save()

        Seat.objects.bulk_create(
            [
                Seat(
                    vehicle=trip.vehicle,
                    number=number,
                )
                for number in range(
                    1,
                    trip.vehicle.capacity + 1,
                )
            ],
            ignore_conflicts=True,
        )

    def perform_update(self, serializer):
        trip = serializer.instance
        data = serializer.validated_data

        if trip.status != "PLANNED":
            raise ValidationError({
                "detail": (
                    "Seuls les départs planifiés "
                    "peuvent être modifiés."
                )
            })

        protected_fields = (
            "route",
            "agency",
            "vehicle",
            "driver",
            "departure_at",
            "arrival_at",
            "price",
        )

        if trip.reservations.exists():
            for field in protected_fields:
                if field in data:
                    new_value = data[field]
                    old_value = getattr(trip, field)

                    if new_value != old_value:
                        raise ValidationError({
                            field: (
                                "Impossible de modifier ce champ : "
                                "ce départ possède déjà des réservations."
                            )
                        })

        start = data.get(
            "departure_at",
            trip.departure_at,
        )

        end = data.get(
            "arrival_at",
            trip.arrival_at,
        )

        vehicle = data.get("vehicle", trip.vehicle)
        driver = data.get("driver", trip.driver)

        conflicts = get_trip_conflicts(
            start,
            end,
            exclude_pk=trip.pk,
        )

        if conflicts.filter(vehicle=vehicle).exists():
            raise ValidationError({
                "vehicle": (
                    "Ce véhicule est déjà affecté à "
                    "un autre départ sur cette période."
                )
            })

        if conflicts.filter(driver=driver).exists():
            raise ValidationError({
                "driver": (
                    "Ce chauffeur est déjà affecté à "
                    "un autre départ sur cette période."
                )
            })

        old_vehicle_id = trip.vehicle_id

        updated_trip = serializer.save()

        if updated_trip.vehicle_id != old_vehicle_id:
            Seat.objects.bulk_create(
                [
                    Seat(
                        vehicle=updated_trip.vehicle,
                        number=number,
                    )
                    for number in range(
                        1,
                        updated_trip.vehicle.capacity + 1,
                    )
                ],
                ignore_conflicts=True,
            )


# =====================================================
# GESTION DES RESERVATIONS
# =====================================================

class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer

    permission_classes = [
        IsAuthenticated,
        IsReservationAccess,
    ]

    queryset = Reservation.objects.select_related(
        "trip",
        "seat",
        "created_by",
    ).all()

    def get_queryset(self):
        qs = super().get_queryset()
        role = get_role(self.request.user)

        if role == "AGENT":
            qs = qs.filter(
                created_by=self.request.user,
            )

        return qs.order_by("-created_at")

    def create(self, request, *args, **kwargs):
        required = (
            "trip",
            "seat",
            "passenger_name",
            "passenger_phone",
        )

        missing = [
            field
            for field in required
            if not request.data.get(field)
        ]

        if missing:
            return Response(
                {
                    "detail": "Champs obligatoires manquants.",
                    "fields": missing,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reservation = create_reservation(
                trip_id=request.data["trip"],
                seat_id=request.data["seat"],
                passenger_name=request.data["passenger_name"],
                passenger_phone=request.data["passenger_phone"],
                user=request.user,
            )

            document = request.data.get(
                "passenger_document",
                "",
            )

            if document:
                reservation.passenger_document = document
                reservation.save(
                    update_fields=["passenger_document"],
                )

        except (
            BusinessError,
            Trip.DoesNotExist,
            Seat.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            self.get_serializer(reservation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        reservation = self.get_object()

        try:
            amount = parse_positive_integer(
                request.data.get("amount"),
                "Le montant",
            )
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        method = request.data.get("method", "CASH")

        if method not in ("CASH", "MOBILE", "CARD"):
            return Response(
                {
                    "detail": (
                        "method doit être CASH, MOBILE ou CARD."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = confirm_payment(
                reservation_id=reservation.id,
                amount=amount,
                method=method,
                user=request.user,
            )

        except BusinessError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reservation.refresh_from_db()

        ticket = Ticket.objects.filter(
            reservation=reservation,
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
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reservation = self.get_object()

        try:
            reservation = cancel_reservation(
                reservation_id=reservation.id,
                user=request.user,
            )

        except BusinessError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            self.get_serializer(reservation).data,
            status=status.HTTP_200_OK,
        )


# =====================================================
# CONSULTATION DES PAIEMENTS
# =====================================================

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [
        IsAuthenticated,
        IsPaymentReader,
    ]

    serializer_class = PaymentSerializer

    queryset = Payment.objects.select_related(
        "reservation",
    ).all().order_by("-paid_at")

    def get_queryset(self):
        qs = super().get_queryset()

        reservation_id = self.request.query_params.get(
            "reservation",
        )

        if reservation_id:
            qs = qs.filter(
                reservation_id=reservation_id,
            )

        return qs


# =====================================================
# CONSULTATION ET CONTROLE DES BILLETS
# =====================================================

class TicketViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [
        IsAuthenticated,
        IsTicketAccess,
    ]

    serializer_class = TicketSerializer

    queryset = Ticket.objects.select_related(
        "reservation",
        "reservation__created_by",
    ).all().order_by("-issued_at")

    def get_queryset(self):
        qs = super().get_queryset()
        role = get_role(self.request.user)

        if role == "AGENT":
            qs = qs.filter(
                reservation__created_by=self.request.user,
            )

        return qs

    @action(
        detail=False,
        methods=["post"],
        url_path="check",
    )
    def check(self, request):
        code = request.data.get("code")

        if not code:
            return Response(
                {"detail": "Le champ code est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ticket = check_ticket(
                ticket_code=code,
                user=request.user,
            )

        except BusinessError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            self.get_serializer(ticket).data,
            status=status.HTTP_200_OK,
        )


# =====================================================
# GESTION DES BAGAGES
# =====================================================

class LuggageViewSet(viewsets.ModelViewSet):
    serializer_class = LuggageSerializer

    permission_classes = [
        IsAuthenticated,
        IsAgentOrResponsable,
    ]

    queryset = Luggage.objects.select_related(
        "reservation",
        "reservation__created_by",
    ).all().order_by("-created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        role = get_role(self.request.user)

        if role == "AGENT":
            qs = qs.filter(
                reservation__created_by=self.request.user,
            )

        return qs

    def perform_create(self, serializer):
        role = get_role(self.request.user)
        reservation = serializer.validated_data.get("reservation")

        if (
            role == "AGENT"
            and reservation.created_by_id != self.request.user.id
        ):
            raise PermissionDenied(
                "Vous ne pouvez ajouter des bagages "
                "qu'à vos propres réservations."
            )

        serializer.save()