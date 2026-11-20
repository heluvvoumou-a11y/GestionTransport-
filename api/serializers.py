import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone

from rest_framework import serializers

from accounts.models import UserProfile
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

User = get_user_model()


# ==========================================
# GESTION DES UTILISATEURS
# ==========================================

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    agency_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "agency_id",
        )

    def get_role(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.role if profile else None

    def get_agency_id(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.agency_id if profile else None


class UserManagementSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(
        choices=UserProfile.ROLES,
        required=False,
        write_only=True,
    )

    agency_id = serializers.PrimaryKeyRelatedField(
        queryset=Agency.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    password = serializers.CharField(
    write_only=True,
    min_length=12,
    required=False,
)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "agency_id",
            "password",
            "is_active",
        )
        read_only_fields = ("id",)

    def to_representation(self, instance):
        data = super().to_representation(instance)

        profile = getattr(instance, "profile", None)

        data["role"] = profile.role if profile else None
        data["agency_id"] = profile.agency_id if profile else None

        return data

    def validate(self, attrs):
        password = attrs.get("password")

        if self.instance is None and not password:
            raise serializers.ValidationError({
                "password": "Le mot de passe est obligatoire à la création."
            })

        if password:
            if self.instance is None:
                candidate = User(**{
                    key: value
                    for key, value in attrs.items()
                    if key in ("username", "first_name", "last_name", "email")
                })
            else:
                candidate = copy.copy(self.instance)
                for key, value in attrs.items():
                    if key not in ("password", "role", "agency_id"):
                        setattr(candidate, key, value)

            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as error:
                raise serializers.ValidationError({
                    "password": list(error.messages)
                })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role", "AGENT")
        agency = validated_data.pop("agency_id", None)
        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        UserProfile.objects.create(
            user=user,
            role=role,
            agency=agency,
        )

        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        agency = validated_data.pop(
            "agency_id",
            serializers.empty,
        )
        password = validated_data.pop("password", None)

        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)

        if password:
            instance.set_password(password)

        instance.save()

        profile, created = UserProfile.objects.get_or_create(
            user=instance,
            defaults={"role": "AGENT"},
        )

        if role is not None:
            profile.role = role

        if agency is not serializers.empty:
            profile.agency = agency

        profile.save()

        return instance


# ==========================================
# GESTION DES AGENCES
# ==========================================

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = "__all__"


# ==========================================
# GESTION DES TRAJETS
# ==========================================

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = "__all__"


# ==========================================
# GESTION DES CHAUFFEURS
# ==========================================

class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = "__all__"


# ==========================================
# GESTION DES VEHICULES
# ==========================================

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"


# ==========================================
# GESTION DES PLACES
# ==========================================

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = "__all__"


# ==========================================
# GESTION DES DEPARTS
# ==========================================

class TripSerializer(serializers.ModelSerializer):
    route_detail = RouteSerializer(
        source="route",
        read_only=True,
    )

    agency_detail = AgencySerializer(
        source="agency",
        read_only=True,
    )

    vehicle_detail = VehicleSerializer(
        source="vehicle",
        read_only=True,
    )

    driver_detail = DriverSerializer(
        source="driver",
        read_only=True,
    )

    available_seats = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = ("created_at",)

    def get_available_seats(self, obj):
        now = timezone.now()

        occupied_seats = obj.reservations.filter(
            Q(status="CONFIRMED") |
            Q(
                status="HOLD",
                hold_expires_at__gt=now,
            )
        ).values_list("seat_id", flat=True)

        return obj.vehicle.seats.exclude(
            id__in=occupied_seats
        ).count()


# ==========================================
# GESTION DES RESERVATIONS
# ==========================================

class ReservationSerializer(serializers.ModelSerializer):
    trip_detail = TripSerializer(
        source="trip",
        read_only=True,
    )

    seat_detail = SeatSerializer(
        source="seat",
        read_only=True,
    )

    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = "__all__"
        read_only_fields = (
            "amount",
            "status",
            "hold_expires_at",
            "created_by",
            "created_at",
        )

    def get_paid_amount(self, obj):
        total = obj.payments.aggregate(
            total=Sum("amount")
        )["total"]

        return total or 0

    def get_remaining_amount(self, obj):
        paid = self.get_paid_amount(obj)

        return max(obj.amount - paid, 0)


# ==========================================
# GESTION DES PAIEMENTS
# ==========================================

class PaymentSerializer(serializers.ModelSerializer):
    reservation_detail = ReservationSerializer(
        source="reservation",
        read_only=True,
    )

    passenger_name = serializers.CharField(
        source="reservation.passenger_name",
        read_only=True,
    )

    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = (
            "id",
            "reservation",
            "reservation_detail",
            "passenger_name",
            "amount",
            "method",
            "reference",
            "paid_at",
            "received_by",
            "received_by_name",
        )

        read_only_fields = (
            "id",
            "reference",
            "paid_at",
            "received_by",
            "received_by_name",
        )

    def get_received_by_name(self, obj):
        user = obj.received_by

        if not user:
            return "Non renseigné"

        full_name = (
            f"{user.first_name or ''} "
            f"{user.last_name or ''}"
        ).strip()

        return full_name or user.username


# ==========================================
# GESTION DES BILLETS
# ==========================================

class TicketSerializer(serializers.ModelSerializer):
    reservation_detail = ReservationSerializer(
        source="reservation",
        read_only=True,
    )

    code = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = (
            "id",
            "reservation",
            "reservation_detail",
            "code",
            "issued_at",
            "checked",
        )

        read_only_fields = fields

    def get_code(self, obj):
        return obj.code


# ==========================================
# GESTION DES BAGAGES
# ==========================================

class LuggageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Luggage
        fields = "__all__"
        read_only_fields = (
            "tag",
            "created_at",
        )