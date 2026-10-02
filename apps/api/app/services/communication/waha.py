import re
import urllib.error
import urllib.parse
import urllib.request
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.communication import (
    CommunicationMessage,
    CommunicationTemplate,
    TenantCommunicationConfig,
)
from app.schemas.communication import WhatsAppQrCodeOut, WhatsAppSessionStatusOut

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATES = [
    {
        "slug": "quote_created",
        "name": "Quotation Notification",
        "category": "sales",
        "whatsapp_body": "Dear {{customer_name}},\n\n*{{company_name}}* has generated Quotation *#{{quote_no}}* for *₹{{amount}}*.\n\nValid until: {{valid_until}}.\nPlease find your quotation attached.",
        "sms_body": "{{company_name}}: Quotation #{{quote_no}} for Rs.{{amount}} generated. Valid until {{valid_until}}.",
        "sample_variables": {"customer_name": "Sri Balaji Constructions", "company_name": "Apex Steels", "quote_no": "QT-2026-0042", "amount": "45,000", "valid_until": "04-Oct-2026"},
    },
    {
        "slug": "invoice_created",
        "name": "Tax Invoice Notification",
        "category": "sales",
        "whatsapp_body": "Dear {{customer_name}},\n\nTax Invoice *#{{invoice_no}}* for *₹{{amount}}* has been issued by *{{company_name}}*.\n\nDue Date: {{due_date}}.\nPlease review the attached invoice PDF.",
        "sms_body": "Invoice #{{invoice_no}} for Rs.{{amount}} issued by {{company_name}}. Due date: {{due_date}}.",
        "sample_variables": {"customer_name": "Prestige Infra", "company_name": "Apex Steels", "invoice_no": "INV-2026-0189", "amount": "1,85,500", "due_date": "15-Oct-2026"},
    },
    {
        "slug": "dispatch_challan",
        "name": "Dispatch Delivery Challan",
        "category": "dispatch",
        "whatsapp_body": "🚚 *Consignment Dispatched!*\n\nDelivery Challan: *#{{challan_no}}*\nDestination Site: *{{site_name}}*\nVehicle Number: *{{vehicle_no}}*\nDriver: {{driver_name}} ({{driver_phone}})\nItems: {{item_summary}}",
        "sms_body": "Challan #{{challan_no}} dispatched to {{site_name}} via {{vehicle_no}}. Driver: {{driver_name}} ({{driver_phone}}).",
        "sample_variables": {"challan_no": "DC-2026-0081", "site_name": "Anandapuram Flyover Pier 40", "vehicle_no": "AP 31 TH 4589", "driver_name": "Ramu", "driver_phone": "9848011223", "item_summary": "120 Bags OPC 53 Cement"},
    },
    {
        "slug": "receipt_confirmed",
        "name": "Payment Receipt Confirmation",
        "category": "sales",
        "whatsapp_body": "✅ *Payment Receipt Confirmed*\n\nDear {{customer_name}},\nWe have received *₹{{amount}}* via *{{payment_mode}}* (Ref: {{reference}}).\nCurrent outstanding balance: *₹{{outstanding_balance}}*.\n\nThank you for your business!",
        "sms_body": "Payment of Rs.{{amount}} received via {{payment_mode}}. Bal: Rs.{{outstanding_balance}}. {{company_name}}",
        "sample_variables": {"customer_name": "Kiran Constructions", "company_name": "Apex Steels", "amount": "50,000", "payment_mode": "UPI / NEFT", "reference": "UTR9948271", "outstanding_balance": "1,20,000"},
    },
    {
        "slug": "student_absent",
        "name": "Student Daily Absence Alert",
        "category": "attendance",
        "whatsapp_body": "⚠️ *Student Absence Notice*\n\nDear Parent/Guardian,\n*{{student_name}}* was marked *ABSENT* on *{{date}}* for *Grade {{class}}-{{section}}* at {{school_name}}.\n\nIf this was not planned, please contact the attendance desk immediately.",
        "sms_body": "Alert: {{student_name}} marked ABSENT today ({{date}}) at {{school_name}}. Contact office if unexpected.",
        "sample_variables": {"student_name": "Aarav Mehta", "date": "27-Sep-2026", "class": "3", "section": "A", "school_name": "Greenwood International"},
    },
    {
        "slug": "fee_invoice",
        "name": "School Fee Challan",
        "category": "fees",
        "whatsapp_body": "📋 *School Fee Invoice*\n\nFee Challan *#{{invoice_no}}* for *{{student_name}}* (Grade {{class}}-{{section}}).\nAmount Due: *₹{{amount}}*\nDue Date: *{{due_date}}*\n\nPay securely via UPI: {{upi_pay_link}}",
        "sms_body": "Fee invoice #{{invoice_no}} for {{student_name}}: Rs.{{amount}} due on {{due_date}}. Pay: {{upi_pay_link}}",
        "sample_variables": {"invoice_no": "FEE-2026-0092", "student_name": "Diya Kapoor", "class": "3", "section": "A", "amount": "18,500", "due_date": "10-Oct-2026", "upi_pay_link": "upi://pay?pa=greenwood@icici&am=18500"},
    },
    {
        "slug": "order_confirmation",
        "name": "Sales Order Confirmation",
        "category": "sales",
        "whatsapp_body": "📦 *Order Confirmation - #{{order_number}}*\n\nDear {{customer_name}},\n\nThank you for your order with *{{company_name}}*! Your order *#{{order_number}}* for *₹{{amount}}* has been confirmed.\n\nStatus: *{{status}}*\nWe will notify you once your order is dispatched.",
        "sms_body": "{{company_name}}: Order #{{order_number}} for Rs.{{amount}} confirmed. Status: {{status}}.",
        "sample_variables": {"customer_name": "Sri Balaji Constructions", "company_name": "Apex Steels", "order_number": "SO-2026-27-000001", "amount": "3,58,130", "status": "Invoiced"},
    },
    {
        "slug": "invoice_share",
        "name": "Tax Invoice Share",
        "category": "sales",
        "whatsapp_body": "Dear {{customer_name}},\n\nTax Invoice *#{{invoice_number}}* for *₹{{total_amount}}* has been issued by *{{company_name}}*.\n\nDue Date: {{due_date}}.\nPlease review the attached invoice PDF.\nPayment Link: {{pay_link}}",
        "sms_body": "Invoice #{{invoice_number}} for Rs.{{total_amount}} issued by {{company_name}}. Due date: {{due_date}}.",
        "sample_variables": {"customer_name": "Prestige Infra", "company_name": "Apex Steels", "invoice_number": "INV-2026-0189", "total_amount": "1,85,500", "due_date": "15-Oct-2026", "pay_link": "https://materialos.app/pay/INV-0189"},
    },
    {
        "slug": "payment_reminder",
        "name": "Payment Reminder",
        "category": "sales",
        "whatsapp_body": "🔔 *Payment Reminder*\n\nDear {{customer_name}},\n\nThis is a friendly reminder from *{{company_name}}* regarding *#{{bill_number}}* for *₹{{amount}}* dated *{{bill_date}}*.\n\nPlease process the payment at your earliest convenience.\nThank you for your business!",
        "sms_body": "{{company_name}}: Friendly reminder for Bill #{{bill_number}} of Rs.{{amount}} dated {{bill_date}}.",
        "sample_variables": {"customer_name": "Valued Partner", "company_name": "Apex Steels", "bill_number": "PB-2026-0045", "amount": "2,45,000", "bill_date": "25-Sep-2026"},
    },
    {
        "slug": "dispatch_alert",
        "name": "Trip Dispatch Notification",
        "category": "dispatch",
        "whatsapp_body": "🚚 *Trip Consignment Dispatched!*\n\nTrip Date: *{{trip_date}}*\nTotal Deliveries: *{{delivery_count}}*\nStatus: *{{status}}*\n\nPlease track your deliveries in real-time.",
        "sms_body": "Trip dispatched on {{trip_date}} with {{delivery_count}} deliveries. Status: {{status}}.",
        "sample_variables": {"trip_date": "02-Oct-2026", "delivery_count": "3", "status": "In Transit"},
    },
    {
        "slug": "admission_status",
        "name": "Admission Application Status",
        "category": "education",
        "whatsapp_body": "🎓 *Admission Application Update*\n\nDear Parent/Guardian,\n\nThe admission application for *{{student_name}}* applied on *{{application_date}}* has been updated.\n\nCurrent Status: *{{status}}*.\nPlease contact the admissions office for further procedures.",
        "sms_body": "Admission update: Application for {{student_name}} is now {{status}}. Contact admissions office.",
        "sample_variables": {"student_name": "Rohan Sharma", "status": "Admitted", "application_date": "28-Sep-2026"},
    },
    {
        "slug": "boq_ra_bill",
        "name": "Contractor RA Bill Approval",
        "category": "contractor",
        "whatsapp_body": "🏗️ *Subcontractor RA Bill Approved*\n\nProject: *{{project_name}}*\nSubcontractor: *{{subcontractor_name}}*\nRA Bill No: *#{{bill_no}}*\nGross Amount: ₹{{gross_amount}}\nRetention Deducted (5%): ₹{{retention}}\n*Net Amount Payable: ₹{{net_payable}}*",
        "sms_body": "RA Bill #{{bill_no}} for {{project_name}} approved. Net payable: Rs.{{net_payable}}.",
        "sample_variables": {"project_name": "NH-16 Elevated Corridor", "subcontractor_name": "Sri Durga Earthworks", "bill_no": "RA-04", "gross_amount": "4,50,000", "retention": "22,500", "net_payable": "4,27,500"},
    },
]


def clean_phone_number(phone: str) -> str:
    """Normalize phone number to international format without + or spaces."""
    cleaned = re.sub(r"[^\d]", "", phone)
    # If 10 digits (standard Indian mobile format without 91 prefix)
    if len(cleaned) == 10:
        return f"91{cleaned}"
    return cleaned


def ensure_default_templates(db: Session, tenant_id: uuid.UUID) -> None:
    """Ensure all default communication templates exist for the given tenant."""
    existing_slugs = set(
        db.execute(
            select(CommunicationTemplate.slug).filter_by(tenant_id=tenant_id)
        ).scalars().all()
    )
    for tpl in DEFAULT_TEMPLATES:
        if tpl["slug"] not in existing_slugs:
            db.add(CommunicationTemplate(tenant_id=tenant_id, **tpl))
    db.flush()


def is_template_applicable_for_profile(template: CommunicationTemplate, profile_slug: str | None) -> bool:
    """Filter templates wrt business/industry profile."""
    if not profile_slug:
        return True
    slug = template.slug
    cat = template.category

    is_education = profile_slug in ("school_education", "education")
    is_contractor = profile_slug in ("construction_contractor", "civil_contractor")

    # Education-exclusive templates
    if slug in ("student_absent", "fee_invoice", "admission_status") or cat in ("attendance", "fees", "education"):
        return is_education

    # Contractor-exclusive templates
    if slug in ("boq_ra_bill",) or cat in ("contractor",):
        return is_contractor

    # Commercial trade templates hidden from education
    if is_education and slug in ("quote_created", "order_confirmation", "invoice_created", "invoice_share", "dispatch_challan", "dispatch_alert"):
        return False

    # Dispatch templates hidden from pure service/lab profiles
    if slug in ("dispatch_challan", "dispatch_alert") and profile_slug in ("services", "travel", "laboratory"):
        return False

    return True


def get_or_create_tenant_config(db: Session, tenant_id: uuid.UUID) -> TenantCommunicationConfig:
    config = db.execute(
        select(TenantCommunicationConfig).filter_by(tenant_id=tenant_id)
    ).scalar_one_or_none()

    if not config:
        config = TenantCommunicationConfig(
            tenant_id=tenant_id,
            waha_session_id=f"tenant_{str(tenant_id).replace('-', '')[:16]}",
            session_status="STOPPED",
            auto_reject_calls=True,
            mcp_copilot_enabled=True,
            enabled_channels=["whatsapp"],
        )
        db.add(config)
        db.flush()

    ensure_default_templates(db, tenant_id)
    return config


def _waha_request(
    endpoint: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
    timeout: int = 6,
) -> tuple[bool, Any]:
    url = f"{(base_url or settings.waha_base_url).rstrip('/')}/{endpoint.lstrip('/')}"
    headers = {"Content-Type": "application/json"}
    key = api_key or settings.waha_api_key
    if key:
        headers["X-Api-Key"] = key

    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read().decode("utf-8", errors="ignore")
            if "application/json" in content_type:
                return True, json.loads(raw)
            return True, raw
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="ignore")
        logger.warning("WAHA HTTPError %s on %s: %s", exc.code, url, err_body)
        try:
            return False, json.loads(err_body)
        except Exception:
            return False, {"error": f"HTTP {exc.code}: {err_body}"}
    except Exception as exc:
        logger.info("WAHA connection unavailable on %s: %s", url, exc)
        return False, {"error": f"Connection failed: {str(exc)}"}


class WahaService:
    @staticmethod
    def start_session(
        db: Session, config: TenantCommunicationConfig, force_restart: bool = False
    ) -> WhatsAppSessionStatusOut:
        session_id = config.waha_session_id
        base_url = config.waha_endpoint_url or settings.waha_base_url
        api_key = config.waha_api_key or settings.waha_api_key

        if force_restart:
            _waha_request(f"/api/sessions/{session_id}/stop", method="POST", base_url=base_url, api_key=api_key)

        # 1. Start or initialize session in WAHA
        webhook_url = f"http://api:8000/api/v1/communication/webhooks/waha?tenant_id={config.tenant_id}"
        payload = {
            "name": session_id,
            "config": {
                "webhooks": [
                    {
                        "url": webhook_url,
                        "events": ["message", "session.status", "message.ack"],
                    }
                ],
                "apps": {
                    "calls": {
                        "reject": config.auto_reject_calls,
                        "message": config.auto_reject_message,
                    }
                },
            },
        }

        ok, resp = _waha_request("/api/sessions", method="POST", body=payload, base_url=base_url, api_key=api_key)
        if not ok and isinstance(resp, dict) and "already exists" in str(resp).lower():
            # If session already exists, trigger start
            ok, resp = _waha_request(
                f"/api/sessions/{session_id}/start", method="POST", base_url=base_url, api_key=api_key
            )

        # 2. Query status
        return WahaService.get_status(db, config)

    @staticmethod
    def stop_session(db: Session, config: TenantCommunicationConfig) -> WhatsAppSessionStatusOut:
        session_id = config.waha_session_id
        base_url = config.waha_endpoint_url or settings.waha_base_url
        api_key = config.waha_api_key or settings.waha_api_key

        _waha_request(f"/api/sessions/{session_id}/stop", method="POST", base_url=base_url, api_key=api_key)
        config.session_status = "STOPPED"
        config.qr_code_raw = None
        db.flush()

        return WhatsAppSessionStatusOut(
            session_id=session_id,
            status="STOPPED",
            detail="Session stopped successfully.",
        )

    @staticmethod
    def get_status(db: Session, config: TenantCommunicationConfig) -> WhatsAppSessionStatusOut:
        session_id = config.waha_session_id
        base_url = config.waha_endpoint_url or settings.waha_base_url
        api_key = config.waha_api_key or settings.waha_api_key

        ok, resp = _waha_request(f"/api/sessions/{session_id}", method="GET", base_url=base_url, api_key=api_key)

        status = "STOPPED"
        phone = config.phone_number
        push_name = config.push_name
        qr_code = config.qr_code_raw
        detail = ""

        if ok and isinstance(resp, dict):
            status = resp.get("status", "STOPPED")
            detail = f"Engine: {resp.get('engine', 'NOWEB')}"
            me = resp.get("me", {})
            if me:
                phone = me.get("id", "").split("@")[0] or phone
                push_name = me.get("pushName") or push_name
        else:
            # Fallback when WAHA is not reachable: report STOPPED or NOT_CONFIGURED
            detail = resp.get("error", "WAHA service unreachable") if isinstance(resp, dict) else str(resp)

        # If scanning QR code, fetch QR code from WAHA
        if status in ("SCAN_QR_CODE", "STARTING"):
            qr_ok, qr_resp = _waha_request(
                f"/api/{session_id}/auth/qr", method="GET", base_url=base_url, api_key=api_key
            )
            if qr_ok and isinstance(qr_resp, dict):
                qr_code = qr_resp.get("raw") or qr_resp.get("qr")
            elif qr_ok and isinstance(qr_resp, str) and qr_resp.startswith("data:image"):
                qr_code = qr_resp

        # Update tenant config cache
        config.session_status = status
        config.phone_number = phone
        config.push_name = push_name
        config.qr_code_raw = qr_code
        config.last_synced_at = datetime.now(timezone.utc)
        db.flush()

        return WhatsAppSessionStatusOut(
            session_id=session_id,
            status=status,
            phone_number=phone,
            push_name=push_name,
            qr_available=bool(qr_code),
            qr_code_raw=qr_code,
            detail=detail,
        )

    @staticmethod
    def get_qr(db: Session, config: TenantCommunicationConfig) -> WhatsAppQrCodeOut:
        status_out = WahaService.get_status(db, config)
        return WhatsAppQrCodeOut(
            session_id=config.waha_session_id,
            qr_raw=status_out.qr_code_raw,
            expires_in_seconds=45,
        )

    @staticmethod
    def send_text_message(
        db: Session,
        config: TenantCommunicationConfig,
        recipient_phone: str,
        text: str,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        recipient_name: str | None = None,
        template_slug: str | None = None,
    ) -> CommunicationMessage:
        clean_phone = clean_phone_number(recipient_phone)
        session_id = config.waha_session_id
        base_url = config.waha_endpoint_url or settings.waha_base_url
        api_key = config.waha_api_key or settings.waha_api_key

        payload = {
            "session": session_id,
            "chatId": f"{clean_phone}@c.us",
            "text": text,
        }

        ok, resp = _waha_request("/api/sendText", method="POST", body=payload, base_url=base_url, api_key=api_key)

        status = "sent" if ok else "failed"
        provider_id = None
        error_msg = None

        if ok and isinstance(resp, dict):
            provider_id = resp.get("id") or resp.get("key", {}).get("id")
        else:
            error_msg = resp.get("error", "Failed to dispatch via WAHA") if isinstance(resp, dict) else str(resp)

        msg = CommunicationMessage(
            tenant_id=config.tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            recipient_name=recipient_name,
            recipient_phone=clean_phone,
            channel="whatsapp",
            template_slug=template_slug,
            rendered_text=text,
            status=status,
            provider_message_id=provider_id,
            provider_response=json.dumps(resp) if isinstance(resp, (dict, list)) else str(resp),
            sent_at=datetime.now(timezone.utc) if ok else None,
            error_message=error_msg,
        )
        db.add(msg)
        db.flush()
        return msg

    @staticmethod
    def send_file_message(
        db: Session,
        config: TenantCommunicationConfig,
        recipient_phone: str,
        file_url: str,
        filename: str,
        caption: str | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        recipient_name: str | None = None,
    ) -> CommunicationMessage:
        clean_phone = clean_phone_number(recipient_phone)
        session_id = config.waha_session_id
        base_url = config.waha_endpoint_url or settings.waha_base_url
        api_key = config.waha_api_key or settings.waha_api_key

        payload = {
            "session": session_id,
            "chatId": f"{clean_phone}@c.us",
            "file": {
                "url": file_url,
                "filename": filename,
            },
            "caption": caption or "",
        }

        ok, resp = _waha_request("/api/sendFile", method="POST", body=payload, base_url=base_url, api_key=api_key)

        status = "sent" if ok else "failed"
        provider_id = resp.get("id") if (ok and isinstance(resp, dict)) else None
        error_msg = None if ok else (resp.get("error", "File send failed") if isinstance(resp, dict) else str(resp))

        msg = CommunicationMessage(
            tenant_id=config.tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            recipient_name=recipient_name,
            recipient_phone=clean_phone,
            channel="whatsapp",
            rendered_text=caption or filename,
            media_url=file_url,
            media_filename=filename,
            status=status,
            provider_message_id=provider_id,
            provider_response=json.dumps(resp) if isinstance(resp, (dict, list)) else str(resp),
            sent_at=datetime.now(timezone.utc) if ok else None,
            error_message=error_msg,
        )
        db.add(msg)
        db.flush()
        return msg
