from django.contrib import admin
from .models import *
admin.site.register([Agency, Route, Driver, Vehicle, Seat, Trip, Reservation, Payment, Ticket, Boarding, Refund, Luggage, CashSession, CashEntry])
