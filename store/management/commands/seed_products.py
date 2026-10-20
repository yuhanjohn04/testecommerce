from django.core.management.base import BaseCommand

from store.models import Product

PRODUCTS = [
    {
        "title": "Canvas Tote",
        "price": "28.00",
        "stock": 24,
        "image_url": "https://picsum.photos/seed/tote/600/600",
    },
    {
        "title": "Wool Beanie",
        "price": "18.00",
        "stock": 40,
        "image_url": "https://picsum.photos/seed/beanie/600/600",
    },
    {
        "title": "Ceramic Mug",
        "price": "14.50",
        "stock": 32,
        "image_url": "https://picsum.photos/seed/mug/600/600",
    },
]


class Command(BaseCommand):
    help = "Create sample products if the catalog is empty."

    def handle(self, *args, **options):
        if Product.objects.exists():
            self.stdout.write("Products already exist; skipping.")
            return
        Product.objects.bulk_create([Product(**item) for item in PRODUCTS])
        self.stdout.write(self.style.SUCCESS(f"Created {len(PRODUCTS)} products."))
