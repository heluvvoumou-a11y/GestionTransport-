from django.contrib import admin

from .models import (
    Agency,
    Route,
    Driver,
    Vehicle,
    Seat,
    Trip,
    Reservation,
    Payment,
    Ticket,
    Boarding,
    Luggage,
    CashSession,
    CashEntry,
)

admin.site.register([
    Agency,
    Route,
    Driver,
    Vehicle,
    Seat,
    Trip,
    Reservation,
    Payment,
    Ticket,
    Boarding,
    Luggage,
    CashSession,
    CashEntry,
])