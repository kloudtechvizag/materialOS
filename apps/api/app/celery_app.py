"""Background job runner (Part E: Redis + Celery). ADR-013 is the
first real usage: backup (app.services.backup_tasks) and notification
delivery/retry (app.services.notification_delivery). `include` is
required -- without it the worker process (`celery -A app.celery_app
worker`) never imports these modules and so never registers their
`@celery_app.task`-decorated functions, silently accepting jobs it
doesn't know how to run.
"""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "materialos",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.services.backup_tasks", "app.services.notification_delivery", "app.services.billing_tasks", "app.services.webhooks"],
)
celery_app.conf.update(task_serializer="json", accept_content=["json"], result_serializer="json")

# sec3's own default recommendation: daily full backup. Requires a
# `celery -A app.celery_app beat` process running alongside the worker
# (see docker-compose.yml's `beat` service) -- the worker alone only
# executes tasks it's handed, it doesn't schedule anything itself.
celery_app.conf.beat_schedule = {
    "daily-tenant-backups": {
        "task": "app.services.backup_tasks.run_scheduled_backups_task",
        "schedule": crontab(hour=2, minute=0),  # 02:00 server time, matching sec2's own example
    },
    # ADR-014: trial/grace/expiry progression and renewal invoice
    # generation -- runs after backups so a tenant's own backup exists
    # before anything billing-related touches their data.
    "daily-subscription-lifecycle": {
        "task": "app.services.billing_tasks.run_subscription_lifecycle_task",
        "schedule": crontab(hour=3, minute=0),
    },
}
