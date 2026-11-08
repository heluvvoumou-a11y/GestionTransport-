from django.core.management.base import BaseCommand
from operations.services import expire_reservations
class Command(BaseCommand):
    help = "Expire les réservations temporaires arrivées à échéance."
    def handle(self, *args, **options):
        count = expire_reservations()
        self.stdout.write(self.style.SUCCESS(f"{count} réservation(s) expirée(s)."))
