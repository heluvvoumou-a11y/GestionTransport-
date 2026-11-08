from django.urls import path
from . import views
urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("departures/", views.trip_list, name="trip_list"),
    path("departures/new/", views.trip_create, name="trip_create"),
    path("reservations/", views.reservation_list, name="reservation_list"),
    path("reservations/new/", views.reservation_create, name="reservation_create"),
    path("reservations/<int:pk>/", views.reservation_detail, name="reservation_detail"),
    path("reservations/<int:pk>/payment/", views.payment_create, name="payment_create"),
    path("reservations/<int:pk>/cancel/", views.cancel_view, name="cancel_reservation"),
    path("reservations/<int:pk>/refund/", views.refund_view, name="refund_reservation"),
    path("tickets/", views.ticket_list, name="ticket_list"),
    path("tickets/check/", views.ticket_check, name="ticket_check"),
    path("luggage/", views.luggage_list, name="luggage_list"),
]
