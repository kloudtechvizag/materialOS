"""Background job runner (Part E: Redis + Celery). No tasks are
registered yet -- Slice 0 has none. WhatsApp/email/PDF/GST-adapter jobs
land here as their owning slices are built, not before.
"""

from celery import Celery

from app.config import settings

celery_app = Celery("materialos", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json")
