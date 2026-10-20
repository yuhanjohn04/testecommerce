from django.db import transaction
from rest_framework import serializers

from .models import Cart, CartItem, Order, OrderItem, Product
from .services import get_or_create_cart


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ("id", "title", "price", "stock", "image_url")


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = ("id", "product", "product_id", "quantity", "subtotal")

    def validate(self, attrs):
        product = attrs.get("product") or getattr(self.instance, "product", None)
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", 1))
        if product and quantity > product.stock:
            raise serializers.ValidationError(
                {"quantity": f"Only {product.stock} item(s) in stock."}
            )
        return attrs

    def create(self, validated_data):
        cart = get_or_create_cart(self.context["request"])
        product = validated_data["product"]
        quantity = validated_data.get("quantity", 1)
        item, created = CartItem.objects.get_or_create(
            cart=cart, product=product, defaults={"quantity": quantity}
        )
        if not created:
            item.quantity += quantity
            if item.quantity > product.stock:
                raise serializers.ValidationError(
                    {"quantity": f"Only {product.stock} item(s) in stock."}
                )
            item.save(update_fields=["quantity"])
        return item


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "total", "updated_at")


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "product", "quantity", "unit_price", "subtotal")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "customer_name",
            "email",
            "address",
            "items",
            "total",
            "created_at",
        )

    def create(self, validated_data):
        request = self.context["request"]
        cart = get_or_create_cart(request)
        items = list(cart.items.select_related("product"))
        if not items:
            raise serializers.ValidationError({"cart": "Cart is empty."})

        with transaction.atomic():
            order = Order.objects.create(**validated_data)
            for item in items:
                product = Product.objects.select_for_update().get(pk=item.product_id)
                if item.quantity > product.stock:
                    raise serializers.ValidationError(
                        {
                            "cart": f"Insufficient stock for {product.title}."
                        }
                    )
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=item.quantity,
                    unit_price=product.price,
                )
                product.stock -= item.quantity
                product.save(update_fields=["stock"])
            cart.items.all().delete()
        return order
