"""Transactional application services. PostgreSQL DB exclusion constraint is a separate integration step."""
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from .models import Baggage, BaggageEvent, Departure, DepartureSeat, Seat, Vehicle, VehicleReplacement


def operational_window(departure):
    return (departure.departure_at - timedelta(minutes=departure.preparation_minutes), departure.planned_arrival_at)


def validate_no_overlap(departure):
    """Friendly validation only; not safe against concurrent transactions without DB constraint."""
    if departure.status == Departure.Status.CANCELLED:
        return
    start, end = operational_window(departure)
    qs = Departure.objects.exclude(pk=departure.pk).exclude(status=Departure.Status.CANCELLED)
    for other in qs.filter(vehicle_id=departure.vehicle_id) | qs.filter(driver_id=departure.driver_id):
        other_start, other_end = operational_window(other)
        if start < other_end and other_start < end:
            raise ValidationError("Chevauchement véhicule ou conducteur avec un autre départ.")


@transaction.atomic
def create_departure_with_inventory(**data):
    vehicle = Vehicle.objects.select_for_update().get(pk=data["vehicle"].pk)
    seats = list(Seat.objects.select_for_update().filter(vehicle=vehicle, is_active=True))
    if len(seats) > vehicle.capacity:
        raise ValidationError("Nombre de sièges actifs supérieur à la capacité.")
    departure = Departure(**data)
    departure.full_clean()
    validate_no_overlap(departure)
    departure.save()
    DepartureSeat.objects.bulk_create([DepartureSeat(departure=departure, seat=s) for s in seats])
    return departure


@transaction.atomic
def execute_vehicle_replacement(replacement_id, *, confirmed_reservation_count, seat_mapping, approved_by_id):
    """Requires caller to atomically update Hawa's reservations BEFORE commit.

    Until a shared reservation adapter exists, execution is deliberately blocked;
    it is unsafe to silently change vehicle and leave booked seat IDs unchanged.
    """
    replacement = VehicleReplacement.objects.select_for_update().select_related("departure").get(pk=replacement_id)
    departure = Departure.objects.select_for_update().get(pk=replacement.departure_id)
    old_vehicle = Vehicle.objects.select_for_update().get(pk=replacement.old_vehicle_id)
    new_vehicle = Vehicle.objects.select_for_update().get(pk=replacement.new_vehicle_id)
    if departure.vehicle_id != old_vehicle.pk:
        raise ValidationError("Le véhicule actuel ne correspond pas à la demande.")
    if confirmed_reservation_count > new_vehicle.capacity:
        raise ValidationError("Capacité insuffisante pour les billets confirmés.")
    if len(seat_mapping) < confirmed_reservation_count:
        raise ValidationError("Correspondance de sièges incomplète.")
    if replacement.status != VehicleReplacement.Status.APPROVED or not approved_by_id:
        raise ValidationError("Remplacement non approuvé.")
    raise ValidationError("Intégration des réservations de Hawa requise avant exécution sécurisée.")


@transaction.atomic
def change_baggage_status(baggage_id, *, new_status, actor_id=None, note=""):
    baggage = Baggage.objects.select_for_update().get(pk=baggage_id)
    transitions = {
        Baggage.Status.REGISTERED: {Baggage.Status.DEPOSITED, Baggage.Status.REFUSED, Baggage.Status.CANCELLED},
        Baggage.Status.DEPOSITED: {Baggage.Status.DELIVERED},
    }
    if new_status not in transitions.get(baggage.status, set()):
        raise ValidationError("Transition de statut bagage non autorisée.")
    baggage.status = new_status
    if new_status == Baggage.Status.DEPOSITED:
        baggage.deposited_at = timezone.now()
    if new_status == Baggage.Status.DELIVERED:
        baggage.delivered_at = timezone.now()
    baggage.save()
    BaggageEvent.objects.create(baggage=baggage, event_type=new_status, actor_id=actor_id, note=note)
    return baggage
