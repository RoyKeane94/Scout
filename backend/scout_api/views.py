import base64
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from .models import Organisation, User, Venue, Brand, FieldConfig, Sighting, ErrorLog, Gap
from .serializers import (
    RegisterOrgSerializer, RegisterMemberSerializer, UserSerializer, UserListSerializer,
    VenueSerializer, VenueCreateSerializer, BrandSerializer, FieldConfigSerializer, FieldConfigBulkSerializer,
    BrandBulkSerializer, SightingSerializer, SightingCreateSerializer, SightingUpdateSerializer,
    GapSerializer, GapCreateSerializer,
)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


@api_view(['POST'])
@permission_classes([AllowAny])
def register_org(request):
    ser = RegisterOrgSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    tokens = get_tokens_for_user(user)
    return Response({'token': tokens['access'], 'org_code': user.organisation.unique_code})


@api_view(['POST'])
@permission_classes([AllowAny])
def register_member(request):
    ser = RegisterMemberSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    tokens = get_tokens_for_user(user)
    return Response({'token': tokens['access']})


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get('email')
    password = request.data.get('password')
    user = authenticate(username=email, password=password)
    if not user:
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    tokens = get_tokens_for_user(user)
    return Response({'access': tokens['access'], 'refresh': tokens['refresh']})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    # Refetch with select_related to avoid N+1 when serializer accesses organisation
    user = User.objects.select_related('organisation').get(pk=request.user.pk)
    data = UserSerializer(user).data
    if user.organisation_id:
        data['scout_count'] = User.objects.filter(organisation_id=user.organisation_id).count()
    else:
        data['scout_count'] = 0
    return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
def log_error(request):
    """Log client-side errors for debugging. No auth required."""
    data = request.data or {}
    message = data.get('message', '') or str(data.get('error', 'Unknown error'))
    if not message:
        return Response({'detail': 'message required'}, status=status.HTTP_400_BAD_REQUEST)
    user_id = request.user.id if request.user.is_authenticated else None
    user_agent = request.META.get('HTTP_USER_AGENT', '')[:500] if request.META else ''
    ErrorLog.objects.create(
        message=message[:2000],
        stack=(data.get('stack') or '')[:8000] or None,
        source=data.get('source', '')[:50] or None,
        url=(data.get('url') or request.build_absolute_uri() or '')[:500] or None,
        user_agent=user_agent or None,
        user_id=user_id,
        extra=data.get('extra') or {},
    )
    return Response({'ok': True}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def validate_code(request):
    code = request.GET.get('code', '').upper().strip()
    org = Organisation.objects.filter(unique_code=code).first()
    if not org:
        return Response({'valid': False})
    return Response({'valid': True, 'brand_name': org.name})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def field_config_list(request):
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        configs = FieldConfig.objects.filter(organisation=org).order_by('display_order')
        return Response(FieldConfigSerializer(configs, many=True).data)

    if request.user.role != 'admin':
        return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    if not isinstance(data, list):
        return Response({'detail': 'Expected list'}, status=status.HTTP_400_BAD_REQUEST)

    active_count = sum(1 for x in data if x.get('is_active'))
    if active_count > 5:
        return Response({'detail': 'Max 5 active fields'}, status=status.HTTP_400_BAD_REQUEST)

    FieldConfig.objects.filter(organisation=org).delete()
    for i, item in enumerate(data):
        FieldConfig.objects.create(
            organisation=org,
            field_id=item['field_id'],
            is_active=item.get('is_active', False),
            display_order=item.get('display_order', i + 1)
        )
    configs = FieldConfig.objects.filter(organisation=org).order_by('display_order')
    return Response(FieldConfigSerializer(configs, many=True).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def brand_list(request):
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        brands = Brand.objects.filter(organisation=org).order_by('-is_own_brand', 'name')
        return Response(BrandSerializer(brands, many=True).data)

    if request.user.role != 'admin':
        return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    if not isinstance(data, list):
        return Response({'detail': 'Expected list'}, status=status.HTTP_400_BAD_REQUEST)

    own_brand = Brand.objects.filter(organisation=org, is_own_brand=True).first()
    if not own_brand:
        has_own = any(x.get('is_own_brand') for x in data)
        if not has_own:
            return Response({'detail': 'Must have one own brand'}, status=status.HTTP_400_BAD_REQUEST)

    Brand.objects.filter(organisation=org).exclude(is_own_brand=True).delete()
    for item in data:
        if item.get('is_own_brand') and own_brand:
            own_brand.name = item.get('name', own_brand.name)
            own_brand.save()
        elif not item.get('is_own_brand'):
            Brand.objects.create(organisation=org, name=item['name'], is_own_brand=False)

    brands = Brand.objects.filter(organisation=org).order_by('-is_own_brand', 'name')
    return Response(BrandSerializer(brands, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def brand_create(request):
    """Add a competitor brand (any authenticated user, e.g. when logging)."""
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'detail': 'Name required'}, status=status.HTTP_400_BAD_REQUEST)
    brand = Brand.objects.create(organisation=org, name=name, is_own_brand=False)
    return Response(BrandSerializer(brand).data, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def venue_list(request):
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        search = request.GET.get('search', '').strip()
        qs = Venue.objects.filter(organisation=org)
        if search:
            qs = qs.filter(name__icontains=search)
        qs = qs.order_by('name')[:20]
        return Response(VenueSerializer(qs, many=True).data)

    ser = VenueCreateSerializer(data=request.data, context={'organisation': org})
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    venue = ser.save()
    return Response(VenueSerializer(venue).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    org = request.user.organisation
    if not org:
        return Response([])
    users = User.objects.filter(organisation=org).order_by('date_joined')
    return Response(UserListSerializer(users, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def user_update_role(request, user_id):
    if request.user.role != 'admin':
        return Response({'detail': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)
    role = request.data.get('role')
    if role not in ('admin', 'member'):
        return Response({'detail': 'role must be "admin" or "member"'}, status=status.HTTP_400_BAD_REQUEST)
    target = User.objects.filter(pk=user_id, organisation=org).first()
    if not target:
        return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    target.role = role
    target.save()
    return Response(UserListSerializer(target).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def sighting_list(request):
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        sightings = Sighting.objects.filter(organisation=org).select_related('venue', 'brand', 'submitted_by').order_by('-created_at')
        return Response(SightingSerializer(sightings, many=True, context={'request': request}).data)

    ser = SightingCreateSerializer(data=request.data, context={'request': request})
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    sighting = ser.save()
    return Response(SightingSerializer(sighting, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def sighting_detail(request, sighting_id):
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        sighting = Sighting.objects.select_related('venue', 'brand', 'submitted_by').get(
            pk=sighting_id, organisation=org
        )
    except Sighting.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        sighting.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    if request.method == 'PATCH':
        ser = SightingUpdateSerializer(sighting, data=request.data, partial=True, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        sighting = ser.save()
        return Response(SightingSerializer(sighting, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sighting_photo(request, sighting_id):
    """Return sighting photo as image/jpeg for authenticated users in the same org."""
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_404_NOT_FOUND)
    try:
        # Only load fields needed for photo response (avoids pulling venue, brand, data, etc.)
        sighting = Sighting.objects.only('id', 'organisation_id', 'photo_url', 'photo_b64').get(
            pk=sighting_id, organisation=org
        )
    except Sighting.DoesNotExist:
        return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
    # S3: if photo_url is set, redirect to it so the same endpoint works for both storage backends
    if sighting.photo_url:
        from django.shortcuts import redirect
        return redirect(sighting.photo_url)
    if not sighting.photo_b64:
        return Response({'detail': 'No photo'}, status=status.HTTP_404_NOT_FOUND)
    # Strip whitespace/newlines that can break base64 decode (e.g. from JSON or DB)
    b64_clean = (sighting.photo_b64 or '').replace('\n', '').replace('\r', '').replace(' ', '').strip()
    # Strip data URL prefix if present (frontend sends "data:image/jpeg;base64,..." from readAsDataURL)
    if ',' in b64_clean and b64_clean.startswith('data:'):
        b64_clean = b64_clean.split(',', 1)[1]
    if not b64_clean:
        return Response({'detail': 'No photo'}, status=status.HTTP_404_NOT_FOUND)
    try:
        raw = base64.b64decode(b64_clean, validate=False)
    except Exception:
        return Response({'detail': 'Invalid photo'}, status=status.HTTP_400_BAD_REQUEST)
    if not raw:
        return Response({'detail': 'Invalid photo'}, status=status.HTTP_400_BAD_REQUEST)
    return HttpResponse(raw, content_type='image/jpeg')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def gap_list(request):
    """List gaps for the org, or create a new gap (venue from location or venue_id)."""
    org = request.user.organisation
    if not org:
        return Response({'detail': 'No organisation'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'GET':
        gaps = Gap.objects.filter(organisation=org).select_related('venue', 'submitted_by').order_by('-created_at')
        return Response(GapSerializer(gaps, many=True).data)

    ser = GapCreateSerializer(data=request.data, context={'request': request})
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    gap = ser.save()
    return Response(GapSerializer(gap).data, status=status.HTTP_201_CREATED)
