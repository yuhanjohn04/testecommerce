from django.db.models import ProtectedError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CartItem, Order, Product
from .serializers import CartItemSerializer, CartSerializer, OrderSerializer, ProductSerializer
from .services import get_cart, get_or_create_cart


class ProductViewSet(viewsets.ModelViewSet):
    """GET, POST, PUT, PATCH, and DELETE for products."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete a product that belongs to an existing order."},
                status=status.HTTP_409_CONFLICT,
            )


class CartItemViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CartItemSerializer

    def get_queryset(self):
        cart = get_cart(self.request)
        if cart is None:
            return CartItem.objects.none()
        return CartItem.objects.filter(cart=cart).select_related("product")

    def _with_cart_header(self, response, request):
        cart = get_cart(request)
        if cart:
            response["X-Cart-Id"] = str(cart.pk)
        return response

    def list(self, request, *args, **kwargs):
        cart = get_cart(request)
        if cart is None:
            return Response({"id": None, "items": [], "total": "0.00", "updated_at": None})
        serializer = CartSerializer(cart, context={"request": request})
        return self._with_cart_header(Response(serializer.data), request)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return self._with_cart_header(response, request)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return self._with_cart_header(response, request)

    def destroy(self, request, *args, **kwargs):
        response = super().destroy(request, *args, **kwargs)
        return self._with_cart_header(response, request)


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Order.objects.prefetch_related("items__product")
    serializer_class = OrderSerializer

    @action(detail=False, methods=["post"], url_path="checkout")
    def checkout(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
