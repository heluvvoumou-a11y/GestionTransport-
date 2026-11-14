from datetime import timedelta

from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.utils import timezone

from .models import (
    Reservation,
    Payment,
    Ticket,
    Boarding,
    Refund,
    Trip,
)

HOLD_MINUTES = 15


class BusinessError(Exception):
    pass


# =====================================================
# 1. CREATION D'UNE RESERVATION
# =====================================================

@transaction.atomic
def create_reservation(
    *,
    trip_id,
    seat_id,
    passenger_name,
    passenger_phone,
    user=None,
    hold_minutes=HOLD_MINUTES
):
    trip = Trip.objects.select_for_update().select_related("vehicle").get(
        pk=trip_id
    )

    if trip.status != "PLANNED":
        raise BusinessError(
            "Ce départ n'accepte plus de réservations."
        )

    from .models import Seat

    seat = Seat.objects.select_for_update().get(
        pk=seat_id,
        vehicle=trip.vehicle
    )

    now = timezone.now()

    Reservation.objects.filter(
        trip=trip,
        seat=seat,
        status="HOLD",
        hold_expires_at__lte=now
    ).update(status="EXPIRED")

    if Reservation.objects.filter(
        trip=trip,
        seat=seat,
        status__in=["HOLD", "CONFIRMED"]
    ).exists():
        raise BusinessError(
            "Cette place est déjà réservée."
        )

    try:
        return Reservation.objects.create(
            trip=trip,
            seat=seat,
            passenger_name=passenger_name.strip(),
            passenger_phone=passenger_phone.strip(),
            amount=trip.price,
            status="HOLD",
            hold_expires_at=now + timedelta(minutes=hold_minutes),
            created_by=user
        )

    except IntegrityError:
        raise BusinessError(
            "Conflit : cette place vient d'être réservée par un autre agent."
        )


# =====================================================
# 2. CONFIRMATION DU PAIEMENT
# =====================================================

@transaction.atomic
def confirm_payment(
    *,
    reservation_id,
    amount,
    method,
    user=None
):
    reservation = Reservation.objects.select_for_update().get(
        pk=reservation_id
    )

    now = timezone.now()

    if (
        reservation.status == "HOLD"
        and reservation.hold_expires_at <= now
    ):
        reservation.status = "EXPIRED"
        reservation.save(update_fields=["status"])

        raise BusinessError(
            "La réservation a expiré. Recommencez la réservation."
        )

    if reservation.status not in ["HOLD", "CONFIRMED"]:
        raise BusinessError(
            "Cette réservation ne peut pas être payée."
        )

    paid = reservation.payments.aggregate(
        total=Sum("amount")
    )["total"] or 0

    if amount <= 0 or paid + amount > reservation.amount:
        raise BusinessError(
            "Montant invalide : le paiement dépasse le montant dû."
        )

    payment = Payment.objects.create(
        reservation=reservation,
        amount=amount,
        method=method,
        received_by=user
    )

    paid += amount

    if paid == reservation.amount:
        reservation.status = "CONFIRMED"
        reservation.save(update_fields=["status"])

        Ticket.objects.get_or_create(
            reservation=reservation
        )

    return payment


# =====================================================
# 3. ANNULATION D'UNE RESERVATION
# =====================================================

@transaction.atomic
def cancel_reservation(
    *,
    reservation_id,
    reason="Annulation",
    user=None
):
    reservation = Reservation.objects.select_for_update().get(
        pk=reservation_id
    )

    if reservation.status not in ["HOLD", "CONFIRMED"]:
        raise BusinessError(
            "Cette réservation n'est plus annulable."
        )

    reservation.status = "CANCELLED"
    reservation.save(update_fields=["status"])

    return reservation


# =====================================================
# 4. DEMANDE DE REMBOURSEMENT
# =====================================================

@transaction.atomic
def request_refund(
    *,
    reservation_id,
    amount,
    reason,
    user=None
):
    reservation = Reservation.objects.select_for_update().get(
        pk=reservation_id
    )

    if reservation.status not in ["CANCELLED", "CONFIRMED"]:
        raise BusinessError(
            "Annulez ou confirmez la réservation avant de demander un remboursement."
        )

    paid = reservation.payments.aggregate(
        total=Sum("amount")
    )["total"] or 0

    reserved = reservation.refunds.filter(
        status__in=["PENDING", "APPROVED"]
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    if amount <= 0 or reserved + amount > paid:
        raise BusinessError(
            "Le montant demandé dépasse le montant disponible à rembourser."
        )

    refund = Refund.objects.create(
        reservation=reservation,
        amount=amount,
        reason=reason,
        status="PENDING",
        requested_by=user
    )

    return refund


# =====================================================
# 5. APPROBATION D'UN REMBOURSEMENT
# =====================================================

@transaction.atomic
def approve_refund(
    *,
    refund_id,
    user=None
):
    refund = Refund.objects.select_for_update().get(
        pk=refund_id
    )

    reservation = Reservation.objects.select_for_update().get(
        pk=refund.reservation_id
    )

    if refund.status != "PENDING":
        raise BusinessError(
            "Cette demande a déjà été traitée."
        )

    paid = reservation.payments.aggregate(
        total=Sum("amount")
    )["total"] or 0

    approved = reservation.refunds.filter(
        status="APPROVED"
    ).exclude(
        pk=refund.pk
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    if approved + refund.amount > paid:
        raise BusinessError(
            "Le montant approuvé dépasse le montant réellement encaissé."
        )

    refund.status = "APPROVED"
    refund.approved_by = user
    refund.refunded_by = user
    refund.reviewed_at = timezone.now()

    refund.save(
        update_fields=[
            "status",
            "approved_by",
            "refunded_by",
            "reviewed_at"
        ]
    )

    if approved + refund.amount == paid and paid > 0:
        reservation.status = "REFUNDED"
        reservation.save(update_fields=["status"])

    return refund


# =====================================================
# 6. REFUS D'UN REMBOURSEMENT
# =====================================================

@transaction.atomic
def reject_refund(
    *,
    refund_id,
    user=None
):
    refund = Refund.objects.select_for_update().get(
        pk=refund_id
    )

    if refund.status != "PENDING":
        raise BusinessError(
            "Cette demande a déjà été traitée."
        )

    refund.status = "REJECTED"
    refund.approved_by = user
    refund.reviewed_at = timezone.now()

    refund.save(
        update_fields=[
            "status",
            "approved_by",
            "reviewed_at"
        ]
    )

    return refund


# =====================================================
# 7. CONTROLE D'UN BILLET
# =====================================================

@transaction.atomic
def check_ticket(
    *,
    ticket_code,
    user=None
):
    ticket = Ticket.objects.select_for_update().select_related(
        "reservation"
    ).get(
        code=ticket_code
    )

    if ticket.reservation.status != "CONFIRMED":
        raise BusinessError(
            "Billet non valide : réservation non confirmée."
        )

    if hasattr(ticket, "boarding"):
        raise BusinessError(
            "Ce billet a déjà été contrôlé."
        )

    Boarding.objects.create(
        ticket=ticket,
        checked_by=user
    )

    ticket.checked = True
    ticket.save(update_fields=["checked"])

    return ticket


# =====================================================
# 8. EXPIRATION DES RESERVATIONS
# =====================================================

def expire_reservations():
    return Reservation.objects.filter(
        status="HOLD",
        hold_expires_at__lte=timezone.now()
    ).update(
        status="EXPIRED"
    )