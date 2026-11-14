import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

class Agency(models.Model):
    name = models.CharField(max_length=120, unique=True)
    city = models.CharField(max_length=100)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    def __str__(self): return f"{self.name} ({self.city})"

class Route(models.Model):
    origin = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)
    distance_km = models.PositiveIntegerField(default=0)
    estimated_minutes = models.PositiveIntegerField(default=0)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["origin","destination"], name="unique_route_direction")]
    def __str__(self): return f"{self.origin} - {self.destination}"

class Driver(models.Model):
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    phone = models.CharField(max_length=30, blank=True)
    license_number = models.CharField(max_length=80, unique=True)
    active = models.BooleanField(default=True)
    def __str__(self): return f"{self.first_name} {self.last_name}"

class Vehicle(models.Model):
    registration = models.CharField(max_length=30, unique=True)
    brand = models.CharField(max_length=80, blank=True)
    model = models.CharField(max_length=80, blank=True)
    capacity = models.PositiveIntegerField()
    available = models.BooleanField(default=True)
    def __str__(self): return f"{self.registration} ({self.capacity} places)"

class Seat(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="seats")
    number = models.PositiveIntegerField()
    class Meta:
        constraints = [models.UniqueConstraint(fields=["vehicle","number"], name="unique_vehicle_seat")]
        ordering = ["number"]
    def __str__(self): return f"{self.vehicle.registration} - {self.number}"

class Trip(models.Model):
    STATUS = [("PLANNED","Planifié"),("BOARDING","Embarquement"),("DEPARTED","Parti"),("ARRIVED","Arrivé"),("CANCELLED","Annulé")]
    route = models.ForeignKey(Route, on_delete=models.PROTECT, related_name="trips")
    agency = models.ForeignKey(Agency, on_delete=models.PROTECT, related_name="trips")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="trips")
    driver = models.ForeignKey(Driver, on_delete=models.PROTECT, related_name="trips")
    departure_at = models.DateTimeField()
    arrival_at = models.DateTimeField(null=True, blank=True)
    price = models.PositiveIntegerField(help_text="Prix en FCFA")
    status = models.CharField(max_length=15, choices=STATUS, default="PLANNED")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f"{self.route} - {self.departure_at:%d/%m/%Y %H:%M}"
    @property
    def active_reservations(self):
        return self.reservations.filter(status__in=["HOLD","CONFIRMED"]).count()

class Reservation(models.Model):
    STATUS = [("HOLD","En attente"),("CONFIRMED","Confirmée"),("CANCELLED","Annulée"),("EXPIRED","Expirée"),("REFUNDED","Remboursée")]
    trip = models.ForeignKey(Trip, on_delete=models.PROTECT, related_name="reservations")
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT, related_name="reservations")
    passenger_name = models.CharField(max_length=160)
    passenger_phone = models.CharField(max_length=30)
    passenger_document = models.CharField(max_length=80, blank=True)
    amount = models.PositiveIntegerField()
    status = models.CharField(max_length=15, choices=STATUS, default="HOLD")
    hold_expires_at = models.DateTimeField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["trip","seat"],
            condition=models.Q(status__in=["HOLD","CONFIRMED"]),
            name="unique_active_trip_seat",
        )]
        ordering = ["-created_at"]
    def __str__(self): return f"Réservation #{self.pk} - {self.passenger_name}"

class Payment(models.Model):
    METHOD = [("CASH","Espèces"),("MOBILE","Mobile money (simulation)"),("CARD","Carte (simulation)")]
    reservation = models.ForeignKey(Reservation, on_delete=models.PROTECT, related_name="payments")
    amount = models.PositiveIntegerField()
    method = models.CharField(max_length=10, choices=METHOD, default="CASH")
    reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    paid_at = models.DateTimeField(default=timezone.now)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    def __str__(self): return f"Paiement {self.reference} - {self.amount} FCFA"

class Ticket(models.Model):
    reservation = models.OneToOneField(Reservation, on_delete=models.PROTECT, related_name="ticket")
    code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    issued_at = models.DateTimeField(auto_now_add=True)
    checked = models.BooleanField(default=False)
    def __str__(self): return f"Billet {self.code}"

class Boarding(models.Model):
    ticket = models.OneToOneField(Ticket, on_delete=models.PROTECT, related_name="boarding")
    checked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    checked_at = models.DateTimeField(auto_now_add=True)

class Refund(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "En attente"),
        ("APPROVED", "Approuvé"),
        ("REJECTED", "Refusé"),
    ]

    reservation = models.ForeignKey(
        Reservation,
        on_delete=models.PROTECT,
        related_name="refunds"
    )

    amount = models.PositiveIntegerField()
    reason = models.CharField(max_length=255)

    reference = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False
    )

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="PENDING"
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="refund_requests"
    )

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="refunds_approved"
    )

    refunded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="refunds_executed"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

class Luggage(models.Model):
    reservation = models.ForeignKey(Reservation, on_delete=models.PROTECT, related_name="luggages")
    description = models.CharField(max_length=180)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    supplement = models.PositiveIntegerField(default=0)
    tag = models.UUIDField(default=uuid.uuid4, unique=True)
    delivered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class CashSession(models.Model):
    agency = models.ForeignKey(Agency, on_delete=models.PROTECT)
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cash_sessions_opened")
    opened_at = models.DateTimeField(auto_now_add=True)
    opening_amount = models.PositiveIntegerField(default=0)
    closed_at = models.DateTimeField(null=True, blank=True)
    closing_amount = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

class CashEntry(models.Model):
    session = models.ForeignKey(CashSession, on_delete=models.PROTECT, related_name="entries")
    payment = models.ForeignKey(Payment, null=True, blank=True, on_delete=models.PROTECT)
    label = models.CharField(max_length=180)
    amount = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
