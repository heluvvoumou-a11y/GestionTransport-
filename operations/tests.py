from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Agency, Route, Vehicle, Seat, Driver, Trip, Reservation, Payment, Ticket
from .services import create_reservation, confirm_payment, cancel_reservation, refund_reservation, check_ticket, BusinessError

class TransportWorkflowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="agent", password="Test12345!")
        self.agency = Agency.objects.create(name="Agence Bamako", city="Bamako")
        self.route = Route.objects.create(origin="Bamako", destination="Sikasso")
        self.vehicle = Vehicle.objects.create(registration="ML-001-AA", capacity=2)
        self.driver = Driver.objects.create(first_name="Moussa", last_name="Traore", license_number="PERMIS-001")
        self.seat1 = Seat.objects.create(vehicle=self.vehicle, number=1)
        self.seat2 = Seat.objects.create(vehicle=self.vehicle, number=2)
        self.trip = Trip.objects.create(route=self.route, agency=self.agency, vehicle=self.vehicle,
            driver=self.driver, departure_at=timezone.now()+timedelta(days=1), price=10000)

    def test_reserve_last_seat_once(self):
        r = create_reservation(trip_id=self.trip.id, seat_id=self.seat1.id,
            passenger_name="Awa", passenger_phone="70000000", user=self.user)
        with self.assertRaises(BusinessError):
            create_reservation(trip_id=self.trip.id, seat_id=self.seat1.id,
                passenger_name="Mariam", passenger_phone="71111111", user=self.user)
        self.assertEqual(r.status, "HOLD")

    def test_full_payment_issues_one_ticket(self):
        r = create_reservation(trip_id=self.trip.id, seat_id=self.seat1.id,
            passenger_name="Awa", passenger_phone="70000000", user=self.user)
        confirm_payment(reservation_id=r.id, amount=10000, method="CASH", user=self.user)
        r.refresh_from_db()
        self.assertEqual(r.status, "CONFIRMED")
        self.assertEqual(Ticket.objects.filter(reservation=r).count(), 1)

    def test_overpayment_rejected(self):
        r = create_reservation(trip_id=self.trip.id, seat_id=self.seat1.id,
            passenger_name="Awa", passenger_phone="70000000", user=self.user)
        with self.assertRaises(BusinessError):
            confirm_payment(reservation_id=r.id, amount=10001, method="CASH", user=self.user)

    def test_ticket_cannot_be_boarded_twice(self):
        r = create_reservation(trip_id=self.trip.id, seat_id=self.seat1.id,
            passenger_name="Awa", passenger_phone="70000000", user=self.user)
        confirm_payment(reservation_id=r.id, amount=10000, method="CASH", user=self.user)
        ticket = Ticket.objects.get(reservation=r)
        check_ticket(ticket_code=ticket.code, user=self.user)
        with self.assertRaises(BusinessError):
            check_ticket(ticket_code=ticket.code, user=self.user)

    def test_refund_cannot_exceed_paid_amount(self):
        r = create_reservation(trip_id=self.trip.id, seat_id=self.seat1.id,
            passenger_name="Awa", passenger_phone="70000000", user=self.user)
        confirm_payment(reservation_id=r.id, amount=5000, method="CASH", user=self.user)
        cancel_reservation(reservation_id=r.id, user=self.user)
        with self.assertRaises(BusinessError):
            refund_reservation(reservation_id=r.id, amount=5001, reason="Test", user=self.user)
