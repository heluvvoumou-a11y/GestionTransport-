import re
from datetime import timedelta

from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.utils import timezone

from .models import (
    Reservation,
    Payment,
    Ticket,
    Boarding,
    Trip,
    Seat,
)


HOLD_MINUTES = 15


class BusinessError(Exception):
    """Erreur liée aux règles métier de TransitGo."""
    pass


def _validate_amount(amount, label="montant"):
    """Convertit un montant entier ou une chaîne entière en int."""

    if isinstance(amount, bool):
        raise BusinessError(
            f"Le {label} doit être un entier positif."
        )

    try:
        if isinstance(amount, str):
            amount = amount.strip()

            if not amount or not amount.isdigit():
                raise ValueError

            amount = int(amount)

        elif not isinstance(amount, int):
            raise ValueError

    except (TypeError, ValueError):
        raise BusinessError(
            f"Le {label} doit être un entier positif."
        )

    if amount <= 0:
        raise BusinessError(
            f"Le {label} doit être un entier positif."
        )

    return amount


# =====================================================
# GENERATION ET NORMALISATION DES REFERENCES BILLETS
# =====================================================

def _ticket_code(ticket):
    """
    Retourne la référence officielle du billet.
    Exemple : billet ID 1 -> TG-1001.
    """

    expected_code = f"TG-{1000 + ticket.pk}"

    if ticket.code != expected_code:
        ticket.code = expected_code
        ticket.save(update_fields=["code"])

    return expected_code


def _find_ticket_by_code(code):
    """
    Recherche un billet par sa référence officielle.
    Compatible avec les anciens billets TG-1001, TG-1002...
    """

    match = re.fullmatch(r"TG-(\d+)", code)

    if not match:
        return None

    sequence_number = int(match.group(1))

    if sequence_number <= 1000:
        return None

    ticket_id = sequence_number - 1000

    ticket = (
        Ticket.objects
        .select_for_update()
        .select_related("reservation")
        .filter(pk=ticket_id)
        .first()
    )

    if not ticket:
        return None

    expected_code = f"TG-{1000 + ticket.pk}"

    # Vérifie que la référence correspond réellement au billet.
    if code != expected_code:
        return None

    return ticket


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
    if hold_minutes <= 0:
        raise BusinessError(
            "La durée de réservation doit être positive."
        )

    passenger_name = (passenger_name or "").strip()
    passenger_phone = (passenger_phone or "").strip()

    if not passenger_name:
        raise BusinessError(
            "Le nom du voyageur est obligatoire."
        )

    if not passenger_phone:
        raise BusinessError(
            "Le numéro de téléphone est obligatoire."
        )

    try:
        trip = Trip.objects.select_for_update().select_related(
            "vehicle"
        ).get(pk=trip_id)

    except Trip.DoesNotExist:
        raise BusinessError(
            "Ce départ n'existe pas."
        )

    if trip.status != "PLANNED":
        raise BusinessError(
            "Ce départ n'accepte plus de réservations."
        )

    try:
        seat = Seat.objects.select_for_update().get(
            pk=seat_id,
            vehicle=trip.vehicle
        )

    except Seat.DoesNotExist:
        raise BusinessError(
            "Cette place n'appartient pas au véhicule de ce départ."
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
        status__in=("HOLD", "CONFIRMED")
    ).exists():
        raise BusinessError(
            "Cette place est déjà réservée."
        )

    try:
        with transaction.atomic():
            reservation = Reservation.objects.create(
                trip=trip,
                seat=seat,
                passenger_name=passenger_name,
                passenger_phone=passenger_phone,
                amount=trip.price,
                status="HOLD",
                hold_expires_at=now + timedelta(
                    minutes=hold_minutes
                ),
                created_by=user
            )

    except IntegrityError:
        raise BusinessError(
            "Conflit : cette place vient d'être réservée "
            "par un autre agent."
        )

    return reservation


# =====================================================
# 2. CONFIRMATION DU PAIEMENT INTEGRAL
# =====================================================

@transaction.atomic
def confirm_payment(
    *,
    reservation_id,
    amount,
    method,
    user=None
):
    amount = _validate_amount(
        amount,
        "montant du paiement"
    )

    allowed_methods = {
        choice[0] for choice in Payment.METHOD
    }

    if method not in allowed_methods:
        raise BusinessError(
            "Mode de paiement invalide."
        )

    try:
        reservation = Reservation.objects.select_for_update().get(
            pk=reservation_id
        )

    except Reservation.DoesNotExist:
        raise BusinessError(
            "Réservation introuvable."
        )

    now = timezone.now()

    if (
        reservation.status == "HOLD"
        and (
            reservation.hold_expires_at is None
            or reservation.hold_expires_at <= now
        )
    ):
        reservation.status = "EXPIRED"
        reservation.save(update_fields=["status"])

        raise BusinessError(
            "La réservation a expiré. "
            "Veuillez recommencer la réservation."
        )

    if reservation.status != "HOLD":
        raise BusinessError(
            "Cette réservation ne peut pas être payée."
        )

    paid = reservation.payments.aggregate(
        total=Sum("amount")
    )["total"] or 0

    if paid > 0:
        raise BusinessError(
            "Cette réservation possède déjà un paiement."
        )

    if amount != reservation.amount:
        raise BusinessError(
            f"Le paiement doit correspondre au montant total : "
            f"{reservation.amount} FCFA."
        )

    payment = Payment.objects.create(
        reservation=reservation,
        amount=reservation.amount,
        method=method,
        received_by=user
    )

    reservation.status = "CONFIRMED"
    reservation.save(update_fields=["status"])

    # Le billet est créé uniquement après le paiement intégral.
    ticket, created = Ticket.objects.get_or_create(
        reservation=reservation
    )

    # Garantit que le billet possède sa référence officielle.
    _ticket_code(ticket)

    return payment


# =====================================================
# 3. ANNULATION D'UNE RESERVATION NON PAYEE
# =====================================================

@transaction.atomic
def cancel_reservation(
    *,
    reservation_id,
    reason="Annulation",
    user=None
):
    try:
        reservation = Reservation.objects.select_for_update().get(
            pk=reservation_id
        )

    except Reservation.DoesNotExist:
        raise BusinessError(
            "Réservation introuvable."
        )

    if reservation.status != "HOLD":
        raise BusinessError(
            "Seules les réservations non payées peuvent être annulées."
        )

    reservation.status = "CANCELLED"
    reservation.save(update_fields=["status"])

    return reservation


# =====================================================
# 4. CONTROLE D'UN BILLET
# =====================================================

@transaction.atomic
def check_ticket(
    *,
    ticket_code,
    user=None
):
    if not ticket_code:
        raise BusinessError(
            "Veuillez saisir la référence du billet."
        )

    code = str(ticket_code).strip().upper()

    # Recherche par référence exacte.
    ticket = (
        Ticket.objects
        .select_for_update()
        .select_related("reservation")
        .filter(code=code)
        .first()
    )

    # Compatibilité avec les références TG-1001, TG-1002...
    if ticket is None:
        ticket = _find_ticket_by_code(code)

    if ticket is None:
        raise BusinessError(
            "Billet introuvable. Vérifiez sa référence."
        )

    reservation = ticket.reservation

    if reservation.status != "CONFIRMED":
        raise BusinessError(
            "Billet non valide : réservation non confirmée."
        )

    if ticket.checked or Boarding.objects.filter(ticket=ticket).exists():
        raise BusinessError(
            "Ce billet a déjà été contrôlé."
        )

    # Vérifie et normalise la référence.
    _ticket_code(ticket)

    # Enregistrement du contrôle.
    Boarding.objects.create(
        ticket=ticket,
        checked_by=user
    )

    ticket.checked = True
    ticket.save(update_fields=["checked"])

    return ticket


# =====================================================
# 5. EXPIRATION DES RESERVATIONS
# =====================================================

def expire_reservations():
    """
    Expire toutes les réservations HOLD dont le délai est dépassé.
    Retourne le nombre de réservations expirées.
    """

    return Reservation.objects.filter(
        status="HOLD",
        hold_expires_at__lte=timezone.now()
    ).update(
        status="EXPIRED"
    )