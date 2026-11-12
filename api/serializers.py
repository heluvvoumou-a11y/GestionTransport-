from django.contrib.auth import get_user_model
from rest_framework import serializers
from accounts.models import UserProfile
from operations.models import (
    Agency, Route, Driver, Vehicle, Seat, Trip, Reservation,
    Payment, Ticket, Refund, Luggage,
)

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    agency_id = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "role", "agency_id")
    def get_role(self, obj):
        return getattr(getattr(obj, "profile", None), "role", None)
    def get_agency_id(self, obj):
        return getattr(getattr(obj, "profile", None), "agency_id", None)

class AgencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Agency
        fields = "__all__"

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = "__all__"

class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = "__all__"

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = "__all__"

class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = "__all__"

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
        occupied = obj.reservations.filter(status__in=("HOLD", "CONFIRMED")).values_list("seat_id", flat=True)
        return obj.vehicle.seats.exclude(id__in=occupied).count()

class ReservationSerializer(serializers.ModelSerializer):
    trip_detail = TripSerializer(source="trip", read_only=True)
    seat_detail = SeatSerializer(source="seat", read_only=True)
    class Meta:
        model = Reservation
        fields = "__all__"
        read_only_fields = ("amount", "status", "hold_expires_at", "created_by", "created_at")

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "reservation", "amount", "method", "reference", "paid_at")
        read_only_fields = ("id", "reference", "paid_at")

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ("id", "reservation", "code", "issued_at", "checked")
        read_only_fields = fields

class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = (
            "id",
            "reservation",
            "amount",
            "reason",
            "reference",
            "refunded_by",
            "created_at",
        )
        read_only_fields = (
            "id",
            "reference",
            "refunded_by",
            "created_at",
        )

class LuggageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Luggage
        fields = "__all__"
        read_only_fields = ("tag", "created_at")
