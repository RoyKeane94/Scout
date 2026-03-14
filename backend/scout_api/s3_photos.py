"""
Upload sighting photos to S3. Postgres photo_b64 is kept as backup.
Uses AWS_* from Django settings (from env). If S3 is not configured, we only store in Postgres.
"""
import base64
import logging

from botocore.exceptions import ClientError
from django.conf import settings

logger = logging.getLogger(__name__)


def upload_photo_b64_to_s3(photo_b64: str, organisation_id: int, sighting_id: int) -> str | None:
    """
    Decode base64 image, upload to S3, return public URL or None on failure.
    Key: sightings/{org_id}/{sighting_id}.jpg
    """
    if not getattr(settings, 'S3_PHOTOS_ENABLED', False):
        return None
    if not photo_b64 or not photo_b64.strip():
        return None
    raw = photo_b64.strip()
    if ',' in raw and raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    try:
        data = base64.b64decode(raw, validate=False)
    except Exception as e:
        logger.warning("S3 upload: invalid base64: %s", e)
        return None
    if not data:
        return None
    try:
        import boto3
        s3 = boto3.client(
            's3',
            region_name=settings.AWS_S3_REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        key = f"sightings/{organisation_id}/{sighting_id}.jpg"
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        put_kwargs = {
            'Bucket': bucket,
            'Key': key,
            'Body': data,
            'ContentType': 'image/jpeg',
            'CacheControl': 'max-age=86400',
        }
        # Use ACL only if bucket allows it; otherwise use a bucket policy for public read
        try:
            s3.put_object(**put_kwargs, ACL='public-read')
        except ClientError as err:
            code = err.response.get('Error', {}).get('Code', '')
            if code in ('AccessControlListNotSupported', 'InvalidArgument'):
                s3.put_object(**put_kwargs)
            else:
                raise
        domain = settings.AWS_S3_CUSTOM_DOMAIN
        if domain:
            url = f"https://{domain}/{key}"
        else:
            url = f"https://{bucket}.s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com/{key}"
        return url
    except Exception as e:
        logger.warning("S3 upload failed for sighting %s: %s", sighting_id, e)
        return None
