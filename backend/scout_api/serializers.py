from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Organisation, User, Venue, Brand, FieldConfig, Sighting


class RegisterOrgSerializer(serializers.Serializer):
    brand_name = serializers.CharField(max_length=255)
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def create(self, validated_data):
        org = Organisation.objects.create(name=validated_data['brand_name'])
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['name'].split()[0] if validated_data['name'] else '',
            last_name=' '.join(validated_data['name'].split()[1:]) if len(validated_data['name'].split()) > 1 else '',
            organisation=org,
            role='admin'
        )
        Brand.objects.create(name=validated_data['brand_name'], organisation=org, is_own_brand=True)
        for i, fid in enumerate(FieldConfig.FIELD_IDS):
            FieldConfig.objects.create(
                organisation=org,
                field_id=fid,
                is_active=i < 5,
                display_order=i + 1
            )
        return user


class RegisterMemberSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_code(self, value):
        value = value.upper().strip()
        if not Organisation.objects.filter(unique_code=value).exists():
            raise serializers.ValidationError("Invalid code")
        return value

    def create(self, validated_data):
        org = Organisation.objects.get(unique_code=validated_data['code'].upper())
        return User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data.get('last_name') or '',
            organisation=org,
            role='member'
        )


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organisation
        fields = ['id', 'name', 'unique_code']


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    organisation = OrganisationSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'role', 'organisation']


    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email


class UserListSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(format='%Y-%m-%d')


    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'role', 'date_joined']

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email


class VenueSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venue
        fields = ['id', 'name', 'venue_type', 'lat', 'lng', 'created_at']


class VenueCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)
    venue_type = serializers.ChoiceField(choices=Venue.VENUE_TYPES)
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)

    def create(self, validated_data):
        org = self.context.get('organisation')
        if not org:
            raise serializers.ValidationError('Organisation required')
        from decimal import Decimal
        data = {
            'name': validated_data['name'],
            'venue_type': validated_data['venue_type'],
        }
        if validated_data.get('lat') is not None:
            data['lat'] = Decimal(str(validated_data['lat']))
        if validated_data.get('lng') is not None:
            data['lng'] = Decimal(str(validated_data['lng']))
        return Venue.objects.create(organisation=org, **data)


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'is_own_brand', 'created_at']


class FieldConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = FieldConfig
        fields = ['id', 'field_id', 'is_active', 'display_order']


class FieldConfigBulkSerializer(serializers.Serializer):
    field_id = serializers.CharField()
    is_active = serializers.BooleanField()
    display_order = serializers.IntegerField()


class BrandBulkSerializer(serializers.Serializer):
    name = serializers.CharField()
    is_own_brand = serializers.BooleanField()


class SightingSerializer(serializers.ModelSerializer):
    venue = VenueSerializer(read_only=True)
    brand = BrandSerializer(read_only=True)
    submitted_by = UserListSerializer(read_only=True)

    class Meta:
        model = Sighting
        fields = ['id', 'venue', 'brand', 'photo_b64', 'lat', 'lng', 'data', 'created_at', 'submitted_by']


class SightingCreateSerializer(serializers.Serializer):
    venue_id = serializers.IntegerField()
    brand_id = serializers.IntegerField()
    photo_b64 = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)
    data = serializers.JSONField(required=False, default=dict)

    def create(self, validated_data):
        from decimal import Decimal
        org = self.context['request'].user.organisation
        user = self.context['request'].user
        venue = Venue.objects.get(pk=validated_data['venue_id'], organisation=org)
        brand = Brand.objects.get(pk=validated_data['brand_id'], organisation=org)
        create_kwargs = {
            'organisation': org,
            'submitted_by': user,
            'venue': venue,
            'brand': brand,
            'photo_b64': validated_data.get('photo_b64'),
            'data': validated_data.get('data', {}),
        }
        if validated_data.get('lat') is not None:
            create_kwargs['lat'] = Decimal(str(validated_data['lat']))
        if validated_data.get('lng') is not None:
            create_kwargs['lng'] = Decimal(str(validated_data['lng']))
        return Sighting.objects.create(**create_kwargs)
