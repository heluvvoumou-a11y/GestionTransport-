from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from .models import Trip, Reservation, Payment, Ticket, Boarding, Luggage
from .forms import ReservationForm, PaymentForm, TicketCheckForm, RefundForm, TripForm
from .services import create_reservation, confirm_payment, cancel_reservation, refund_reservation, check_ticket, BusinessError

@login_required
def dashboard(request):
    context = {
        "trip_count": Trip.objects.filter(status="PLANNED").count(),
        "reservation_count": Reservation.objects.filter(status__in=["HOLD","CONFIRMED"]).count(),
        "payment_total": Payment.objects.aggregate(total=Sum("amount"))["total"] or 0,
        "recent_trips": Trip.objects.select_related("route","vehicle").order_by("departure_at")[:8],
    }
    return render(request, "operations/dashboard.html", context)

@login_required
def trip_list(request):
    trips = Trip.objects.select_related("route","vehicle","driver","agency").order_by("departure_at")
    return render(request, "operations/trips.html", {"trips": trips})

@login_required
def trip_create(request):
    if request.method == "POST":
        form = TripForm(request.POST)
        if form.is_valid():
            trip = form.save(commit=False)
            # Contrôle métier de chevauchement : même véhicule ou conducteur sur des périodes qui se recouvrent.
            start, end = trip.departure_at, trip.arrival_at or trip.departure_at
            conflicts = Trip.objects.filter(status__in=["PLANNED","BOARDING","DEPARTED"]).filter(
                departure_at__lt=end, arrival_at__gt=start
            )
            if conflicts.filter(vehicle=trip.vehicle).exists() or conflicts.filter(driver=trip.driver).exists():
                messages.error(request, "Conflit : véhicule ou conducteur déjà affecté à un autre départ.")
            else:
                trip.save()
                from .models import Seat
                Seat.objects.bulk_create([Seat(vehicle=trip.vehicle, number=n) for n in range(1, trip.vehicle.capacity+1)],
                                         ignore_conflicts=True)
                messages.success(request, "Départ créé.")
                return redirect("trip_list")
    else:
        form = TripForm()
    return render(request, "operations/form.html", {"form": form, "title":"Créer un départ"})

@login_required
def reservation_create(request):
    form = ReservationForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            r = create_reservation(trip_id=form.cleaned_data["trip"].id, seat_id=form.cleaned_data["seat"].id,
                passenger_name=form.cleaned_data["passenger_name"], passenger_phone=form.cleaned_data["passenger_phone"],
                user=request.user)
            messages.success(request, f"Réservation #{r.id} créée. Elle expire dans 15 minutes.")
            return redirect("reservation_detail", pk=r.pk)
        except BusinessError as e:
            messages.error(request, str(e))
    return render(request, "operations/form.html", {"form":form,"title":"Nouvelle réservation"})

@login_required
def reservation_list(request):
    items = Reservation.objects.select_related("trip","trip__route","seat").order_by("-created_at")
    return render(request, "operations/reservations.html", {"items":items})

@login_required
def reservation_detail(request, pk):
    r = get_object_or_404(Reservation.objects.select_related("trip","trip__route","seat"), pk=pk)
    return render(request, "operations/reservation_detail.html", {"r":r, "payments":r.payments.all()})

@login_required
def payment_create(request, pk):
    r = get_object_or_404(Reservation, pk=pk)
    form = PaymentForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            confirm_payment(reservation_id=r.id, amount=form.cleaned_data["amount"], method=form.cleaned_data["method"], user=request.user)
            messages.success(request, "Paiement enregistré. Si le montant total est atteint, le billet est émis.")
            return redirect("reservation_detail", pk=r.pk)
        except BusinessError as e:
            messages.error(request, str(e))
    return render(request, "operations/form.html", {"form":form,"title":f"Paiement réservation #{r.pk}"})

@login_required
def cancel_view(request, pk):
    r = get_object_or_404(Reservation, pk=pk)
    if request.method == "POST":
        try:
            cancel_reservation(reservation_id=r.id, user=request.user)
            messages.success(request, "Réservation annulée.")
        except BusinessError as e: messages.error(request, str(e))
    return redirect("reservation_detail", pk=pk)

@login_required
def refund_view(request, pk):
    r = get_object_or_404(Reservation, pk=pk)
    form = RefundForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            refund_reservation(reservation_id=r.id, amount=form.cleaned_data["amount"], reason=form.cleaned_data["reason"], user=request.user)
            messages.success(request, "Remboursement enregistré.")
            return redirect("reservation_detail", pk=pk)
        except BusinessError as e: messages.error(request, str(e))
    return render(request, "operations/form.html", {"form":form,"title":f"Rembourser réservation #{pk}"})

@login_required
def ticket_list(request):
    tickets = Ticket.objects.select_related("reservation","reservation__trip","reservation__trip__route").order_by("-issued_at")
    return render(request, "operations/tickets.html", {"tickets":tickets})

@login_required
def ticket_check(request):
    form = TicketCheckForm(request.POST or None)
    result = None
    if request.method == "POST" and form.is_valid():
        try:
            result = check_ticket(ticket_code=form.cleaned_data["ticket_code"], user=request.user)
            messages.success(request, "Embarquement enregistré.")
        except (BusinessError, Ticket.DoesNotExist) as e:
            messages.error(request, str(e) if isinstance(e, BusinessError) else "Billet introuvable.")
    return render(request, "operations/form.html", {"form":form,"title":"Contrôle d'un billet","result":result})

@login_required
def luggage_list(request):
    items = Luggage.objects.select_related("reservation","reservation__trip").order_by("-created_at")
    return render(request, "operations/luggage.html", {"items":items})
