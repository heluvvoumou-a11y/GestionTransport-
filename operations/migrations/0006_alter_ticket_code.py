from django.db import migrations, models


def convert_ticket_codes(apps, schema_editor):
    Ticket = apps.get_model("operations", "Ticket")
    database = schema_editor.connection.alias

    tickets = Ticket.objects.using(database).order_by("pk")

    for ticket in tickets.iterator():
        ticket.code = f"TG-{1000 + ticket.pk}"

        Ticket.objects.using(database).filter(
            pk=ticket.pk
        ).update(code=ticket.code)


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0005_alter_ticket_code"),
    ]

    operations = [
        migrations.AlterField(
            model_name="ticket",
            name="code",
            field=models.CharField(
                max_length=20,
                unique=True,
                editable=False,
                null=True,
                blank=True,
            ),
        ),
        migrations.RunPython(convert_ticket_codes),
    ]