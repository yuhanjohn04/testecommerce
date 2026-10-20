from .models import Cart

CART_ID_SESSION_KEY = "cart_id"
CART_ID_HEADER = "HTTP_X_CART_ID"


def _existing_cart(request):
    cart_id = request.META.get(CART_ID_HEADER) or request.session.get(CART_ID_SESSION_KEY)
    if not cart_id:
        return None
    cart = Cart.objects.filter(pk=cart_id).first()
    if cart:
        request.session[CART_ID_SESSION_KEY] = cart.pk
    return cart


def get_cart(request):
    return _existing_cart(request)


def get_or_create_cart(request):
    cart = _existing_cart(request)
    if cart is None:
        cart = Cart.objects.create()
        request.session[CART_ID_SESSION_KEY] = cart.pk
    return cart
