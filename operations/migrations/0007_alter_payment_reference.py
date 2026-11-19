from django.db import migrations, models


def convert_payment_references(apps, schema_editor):
    Payment = apps.get_model("operations", "Payment")
    database = schema_editor.connection.alias

    payments = (
        Payment.objects.using(database)
        .order_by("id")
        .all()
    )

    for payment in payments.iterator():
        payment.reference = f"PAY-{1000 + payment.pk}"
        payment.save(
            using=database,
            update_fields=["reference"]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("operations", "0006_alter_ticket_code"),
    ]

    operations = [
        migrations.AlterField(
            model_name="payment",
            name="reference",
            field=models.CharField(
                blank=True,
                editable=False,
                max_length=30,
                null=True,
                unique=True,
            ),
        ),

        migrations.RunPython(
            convert_payment_references,
            migrations.RunPython.noop,
        ),
    ]