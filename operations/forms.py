from django import forms
from .models import Reservation, Trip, Seat, Vehicle, Driver, Route, Agency

class ReservationForm(forms.Form):
    trip = forms.ModelChoiceField(queryset=Trip.objects.filter(status="PLANNED"))
    seat = forms.ModelChoiceField(queryset=Seat.objects.none())
    passenger_name = forms.CharField(max_length=160)
    passenger_phone = forms.CharField(max_length=30)
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.data.get("trip"):
            try:
                trip = Trip.objects.get(pk=self.data.get("trip"))
                self.fields["seat"].queryset = Seat.objects.filter(vehicle=trip.vehicle)
            except (Trip.DoesNotExist, ValueError):
                pass

class PaymentForm(forms.Form):
    amount = forms.IntegerField(min_value=1, label="Montant (FCFA)")
    method = forms.ChoiceField(choices=[("CASH","Espèces"),("MOBILE","Mobile money (simulation)"),("CARD","Carte (simulation)")])

class TicketCheckForm(forms.Form):
    ticket_code = forms.UUIDField(label="Code du billet")

class RefundForm(forms.Form):
    amount = forms.IntegerField(min_value=1)
    reason = forms.CharField(max_length=255)

class TripForm(forms.ModelForm):
    class Meta:
        model = Trip
        fields = ["route","agency","vehicle","driver","departure_at","arrival_at","price","notes"]
        widgets = {"departure_at": forms.DateTimeInput(attrs={"type":"datetime-local"}),
                   "arrival_at": forms.DateTimeInput(attrs={"type":"datetime-local"})}
