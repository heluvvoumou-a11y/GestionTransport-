"""F01/F07: operations and transport data. Reservation and Payment belong to Hawa.

The reservation integration uses a logical reservation reference until the shared
app/model label has been agreed by the team; no duplicate Reservation is defined.
"""
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class Agency(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=150)
    city = models.CharField(max_length=100)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} — {self.name}"


class Route(models.Model):
    origin_city = models.CharField(max_length=100)
    destination_city = models.CharField(max_length=100)
    estimated_duration_minutes = models.PositiveIntegerField()
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=~Q(origin_city=F("destination_city")), name="route_distinct_cities"),
            models.CheckConstraint(condition=Q(estimated_duration_minutes__gt=0), name="route_positive_duration"),
        ]


class Driver(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    license_number = models.CharField(max_length=60, unique=True)
    phone = models.CharField(max_length=30, blank=True)
    license_expiry = models.DateField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Vehicle(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Disponible"
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        OUT_OF_SERVICE = "OUT_OF_SERVICE", "Hors service"

    registration_number = models.CharField(max_length=50, unique=True)
    brand = models.CharField(max_length=80, blank=True)
    model_name = models.CharField(max_length=80, blank=True)
    capacity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(capacity__gt=0), name="vehicle_positive_capacity")]


class Seat(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="seats")
    number = models.PositiveIntegerField()
    label = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["vehicle", "number"], name="seat_vehicle_number_unique"),
            models.CheckConstraint(condition=Q(number__gt=0), name="seat_number_positive"),
        ]

    def clean(self):
        if self.vehicle_id and self.is_active:
            active_count = Seat.objects.filter(vehicle_id=self.vehicle_id, is_active=True).exclude(pk=self.pk).count()
            if active_count >= self.vehicle.capacity:
                raise ValidationError("La capacité du véhicule serait dépassée.")


class Departure(models.Model):
    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planifié"
        OPEN = "OPEN", "Ouvert"
        COMPLETED = "COMPLETED", "Terminé"
        CANCELLED = "CANCELLED", "Annulé"

    route = models.ForeignKey(Route, on_delete=models.PROTECT, related_name="departures")
    agency = models.ForeignKey(Agency, on_delete=models.PROTECT, related_name="departures")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="departures")
    driver = models.ForeignKey(Driver, on_delete=models.PROTECT, related_name="departures")
    departure_at = models.DateTimeField()
    planned_arrival_at = models.DateTimeField()
    preparation_minutes = models.PositiveIntegerField(default=30)
    fare_xof = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(planned_arrival_at__gt=F("departure_at")), name="departure_arrival_after_start"),
        ]
        indexes = [models.Index(fields=["departure_at", "status"])]

    def clean(self):
        if self.departure_at and self.planned_arrival_at and self.planned_arrival_at <= self.departure_at:
            raise ValidationError("L'arrivée doit suivre le départ.")
        if self.vehicle_id and self.vehicle.status != Vehicle.Status.AVAILABLE:
            raise ValidationError("Véhicule indisponible.")
        if self.driver_id and (not self.driver.is_active or self.driver.license_expiry < timezone.localdate()):
            raise ValidationError("Conducteur inactif ou permis expiré.")


class DepartureSeat(models.Model):
    departure = models.ForeignKey(Departure, on_delete=models.PROTECT, related_name="seat_inventory")
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT, related_name="departure_inventory")
    is_sellable = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["departure", "seat"], name="departure_seat_unique")]

    def clean(self):
        if self.departure_id and self.seat_id and self.departure.vehicle_id != self.seat.vehicle_id:
            raise ValidationError("Le siège n'appartient pas au véhicule du départ.")
        if self.seat_id and not self.seat.is_active and self.is_sellable:
            raise ValidationError("Un siège inactif ne peut pas être commercialisable.")


class VehicleReplacement(models.Model):
    class Status(models.TextChoices):
        PROPOSED = "PROPOSED", "Proposé"
        APPROVED = "APPROVED", "Approuvé"
        REJECTED = "REJECTED", "Rejeté"
        EXECUTED = "EXECUTED", "Exécuté"

    departure = models.ForeignKey(Departure, on_delete=models.PROTECT, related_name="replacements")
    old_vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="replacements_out")
    new_vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="replacements_in")
    reason = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PROPOSED)
    proposed_by_id = models.PositiveBigIntegerField(null=True, blank=True)  # user module to integrate
    approved_by_id = models.PositiveBigIntegerField(null=True, blank=True)
    decision_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=~Q(old_vehicle=F("new_vehicle")), name="replacement_distinct_vehicles")]


class BaggageCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    default_supplement_xof = models.PositiveIntegerField(default=0)
    max_weight_kg = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    max_pieces_per_passenger = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)


class Baggage(models.Model):
    class Status(models.TextChoices):
        REGISTERED = "REGISTERED", "Enregistré"
        DEPOSITED = "DEPOSITED", "Déposé"
        DELIVERED = "DELIVERED", "Remis"
        REFUSED = "REFUSED", "Refusé"
        CANCELLED = "CANCELLED", "Annulé"

    reservation_reference = models.CharField(max_length=100, db_index=True)  # replace with FK after Hawa app integration
    category = models.ForeignKey(BaggageCategory, on_delete=models.PROTECT)
    piece_count = models.PositiveIntegerField(default=1)
    measured_weight_kg = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    supplement_xof = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.REGISTERED)
    receipt_reference = models.CharField(max_length=100, unique=True)
    recorded_by_id = models.PositiveBigIntegerField(null=True, blank=True)
    deposited_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(piece_count__gt=0), name="baggage_pieces_positive")]

    def clean(self):
        if self.category_id:
            if self.piece_count > self.category.max_pieces_per_passenger:
                raise ValidationError("Nombre de pièces supérieur à la limite de la catégorie.")
            if self.measured_weight_kg is not None and self.category.max_weight_kg is not None:
                if self.measured_weight_kg > self.category.max_weight_kg:
                    raise ValidationError("Poids supérieur à la limite de la catégorie.")


class BaggageEvent(models.Model):
    baggage = models.ForeignKey(Baggage, on_delete=models.PROTECT, related_name="events")
    event_type = models.CharField(max_length=30)
    occurred_at = models.DateTimeField(default=timezone.now)
    actor_id = models.PositiveBigIntegerField(null=True, blank=True)
    note = models.TextField(blank=True)


class BaggagePaymentLink(models.Model):
    baggage = models.OneToOneField(Baggage, on_delete=models.PROTECT, related_name="payment_link")
    payment_reference = models.CharField(max_length=100)  # reference to Hawa's Payment, NOT a payment ledger
    amount_xof = models.PositiveIntegerField()
    payment_status = models.CharField(max_length=20)
    idempotency_key = models.CharField(max_length=100, unique=True)
