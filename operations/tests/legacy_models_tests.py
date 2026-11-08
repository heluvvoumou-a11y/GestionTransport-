from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from operations.models import Agency, Route, Vehicle, Seat, Driver, Departure, DepartureSeat, BaggageCategory, Baggage
from operations.services import validate_no_overlap, create_departure_with_inventory


class OperationsTests(TestCase):
    def setUp(self):
        self.agency = Agency.objects.create(code="BKO", name="Agence Bamako", city="Bamako")
        self.route = Route.objects.create(origin_city="Bamako", destination_city="Sikasso", estimated_duration_minutes=240)
        self.vehicle = Vehicle.objects.create(registration_number="TEST-001", capacity=2)
        self.driver = Driver.objects.create(first_name="Test", last_name="Driver", license_number="PERMIS-001", license_expiry=timezone.localdate() + timedelta(days=365))
        self.start = timezone.now() + timedelta(days=2)

    def departure_data(self):
        return dict(route=self.route, agency=self.agency, vehicle=self.vehicle, driver=self.driver,
                    departure_at=self.start, planned_arrival_at=self.start + timedelta(hours=4), fare_xof=5000)

    def test_duplicate_seat_rejected_by_database(self):
        Seat.objects.create(vehicle=self.vehicle, number=1)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Seat.objects.create(vehicle=self.vehicle, number=1)

    def test_capacity_validation(self):
        Seat.objects.create(vehicle=self.vehicle, number=1)
        Seat.objects.create(vehicle=self.vehicle, number=2)
        with self.assertRaises(ValidationError):
            Seat(vehicle=self.vehicle, number=3).full_clean()

    def test_wrong_vehicle_seat_rejected(self):
        other = Vehicle.objects.create(registration_number="TEST-002", capacity=3)
        seat = Seat.objects.create(vehicle=other, number=1)
        departure = Departure.objects.create(**self.departure_data())
        with self.assertRaises(ValidationError):
            DepartureSeat(departure=departure, seat=seat).full_clean()

    def test_arrival_before_departure_rejected(self):
        data = self.departure_data()
        data["planned_arrival_at"] = data["departure_at"] - timedelta(minutes=1)
        with self.assertRaises(ValidationError):
            Departure(**data).full_clean()

    def test_overlapping_vehicle_rejected_in_service(self):
        Departure.objects.create(**self.departure_data())
        second_driver = Driver.objects.create(first_name="Autre", last_name="Driver", license_number="PERMIS-002", license_expiry=timezone.localdate() + timedelta(days=365))
        data = self.departure_data()
        data["driver"] = second_driver
        data["departure_at"] += timedelta(hours=1)
        data["planned_arrival_at"] += timedelta(hours=1)
        with self.assertRaises(ValidationError):
            validate_no_overlap(Departure(**data))

    def test_departure_inventory(self):
        Seat.objects.create(vehicle=self.vehicle, number=1)
        Seat.objects.create(vehicle=self.vehicle, number=2)
        departure = create_departure_with_inventory(**self.departure_data())
        self.assertEqual(departure.seat_inventory.count(), 2)

    def test_baggage_category_limit(self):
        category = BaggageCategory.objects.create(name="Standard", max_pieces_per_passenger=2)
        baggage = Baggage(category=category, reservation_reference="HAWA-REF-1", receipt_reference="BAG-1", piece_count=3)
        with self.assertRaises(ValidationError):
            baggage.full_clean()

    def test_vehicle_protected_from_deletion(self):
        Departure.objects.create(**self.departure_data())
        from django.db.models.deletion import ProtectedError
        with self.assertRaises(ProtectedError):
            self.vehicle.delete()
