from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from accounts.models import UserProfile
from operations.models import (
    Agency, Route, Driver, Vehicle, Seat, Trip, Reservation,
    Payment, Ticket, Refund, Luggage,
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
            "id", "username", "first_name", "last_name",
            "email", "role", "agency_id"
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
        write_only=True
    )

    agency_id = serializers.PrimaryKeyRelatedField(
        queryset=Agency.objects.all(),
        required=False,
        allow_null=True,
        write_only=True
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        required=False
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
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({
                "password": "Le mot de passe est obligatoire à la création."
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role", "AGENT")
        agency = validated_data.pop("agency_id", None)
        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        UserProfile.objects.create(
            user=user,
            role=role,
            agency=agency
        )

        return user

    @transaction.atomic
    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        agency = validated_data.pop("agency_id", serializers.empty)
        password = validated_data.pop("password", None)

        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)

        if password:
            instance.set_password(password)

        instance.save()

        profile, created = UserProfile.objects.get_or_create(
            user=instance,
            defaults={"role": "AGENT"}
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
# GESTION DES VÉHICULES
# ==========================================

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"


class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = "__all__"


# ==========================================
# GESTION DES DÉPARTS
# ==========================================

class TripSerializer(serializers.ModelSerializer):
    route_detail = RouteSerializer(source="route", read_only=True)
    agency_detail = AgencySerializer(source="agency", read_only=True)
    vehicle_detail = VehicleSerializer(source="vehicle", read_only=True)
    driver_detail = DriverSerializer(source="driver", read_only=True)

    available_seats = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = "__all__"
        read_only_fields = ("created_at",)

    def get_available_seats(self, obj):
        occupied = obj.reservations.filter(
            status__in=("HOLD", "CONFIRMED")
        ).values_list("seat_id", flat=True)

        return obj.vehicle.seats.exclude(
            id__in=occupied
        ).count()


# ==========================================
# GESTION DES RÉSERVATIONS
# ==========================================

class ReservationSerializer(serializers.ModelSerializer):
    trip_detail = TripSerializer(source="trip", read_only=True)
    seat_detail = SeatSerializer(source="seat", read_only=True)

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


# ==========================================
# GESTION DES PAIEMENTS
# ==========================================

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id", "reservation", "amount", "method",
            "reference", "paid_at"
        )
        read_only_fields = ("id", "reference", "paid_at")


# ==========================================
# GESTION DES BILLETS
# ==========================================

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ("id", "reservation", "code", "issued_at", "checked")
        read_only_fields = fields


# ==========================================
# GESTION DES REMBOURSEMENTS
# ==========================================

class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = (
            "id",
            "reservation",
            "amount",
            "reason",
            "reference",
            "status",
            "requested_by",
            "approved_by",
            "refunded_by",
            "created_at",
            "reviewed_at",
        )

        read_only_fields = (
            "id",
            "reference",
            "status",
            "requested_by",
            "approved_by",
            "refunded_by",
            "created_at",
            "reviewed_at",
        )


# ==========================================
# GESTION DES BAGAGES
# ==========================================

class LuggageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Luggage
        fields = "__all__"
        read_only_fields = ("tag", "created_at")