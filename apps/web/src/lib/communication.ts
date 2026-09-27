import { apiFetch } from "@/lib/api";

export interface TenantCommunicationConfig {
  id: string;
  tenant_id: string;
  waha_session_id: string;
  waha_endpoint_url: string | null;
  session_status: "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED";
  phone_number: string | null;
  push_name: string | null;
  battery_level: number | null;
  is_plugged: boolean | null;
  qr_code_raw: string | null;
  auto_reject_calls: boolean;
  auto_reject_message: string;
  mcp_copilot_enabled: boolean;
  sms_provider: string | null;
  enabled_channels: string[];
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantCommunicationConfigUpdate {
  waha_endpoint_url?: string | null;
  waha_api_key?: string | null;
  auto_reject_calls?: boolean;
  auto_reject_message?: string;
  mcp_copilot_enabled?: boolean;
  sms_provider?: string | null;
  sms_credentials?: Record<string, unknown>;
  enabled_channels?: string[];
}

export interface WhatsAppSessionStatus {
  session_id: string;
  status: "STOPPED" | "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED";
  phone_number?: string | null;
  push_name?: string | null;
  battery_level?: number | null;
  is_plugged?: boolean | null;
  qr_available: boolean;
  qr_code_raw?: string | null;
  detail: string;
}

export interface WhatsAppQrCode {
  session_id: string;
  qr_raw: string | null;
  qr_data_url: string | null;
  expires_in_seconds: number;
}

export interface CommunicationTemplate {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  category: string;
  whatsapp_body: string;
  sms_body: string | null;
  dlt_template_id: string | null;
  sample_variables: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunicationTemplateCreate {
  slug: string;
  name: string;
  category?: string;
  whatsapp_body: string;
  sms_body?: string | null;
  dlt_template_id?: string | null;
  sample_variables?: Record<string, string>;
  is_active?: boolean;
}

export interface SendWhatsAppMessageRequest {
  recipient_phone: string;
  recipient_name?: string;
  template_slug?: string;
  message_text?: string;
  variables?: Record<string, unknown>;
  media_url?: string;
  media_filename?: string;
  entity_type?: string;
  entity_id?: string;
}

export interface CommunicationMessage {
  id: string;
  tenant_id: string;
  entity_type: string | null;
  entity_id: string | null;
  recipient_name: string | null;
  recipient_phone: string;
  channel: string;
  template_slug: string | null;
  rendered_text: string;
  media_url: string | null;
  media_filename: string | null;
  status: "pending" | "queued" | "sent" | "delivered" | "read" | "failed";
  provider_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

export async function fetchCommunicationConfig(): Promise<TenantCommunicationConfig> {
  return apiFetch<TenantCommunicationConfig>("/communication/config");
}

export async function updateCommunicationConfig(
  payload: TenantCommunicationConfigUpdate
): Promise<TenantCommunicationConfig> {
  return apiFetch<TenantCommunicationConfig>("/communication/config", {
    method: "PUT",
    body: payload,
  });
}

export async function startWhatsAppSession(forceRestart = false): Promise<WhatsAppSessionStatus> {
  return apiFetch<WhatsAppSessionStatus>("/communication/whatsapp/session/start", {
    method: "POST",
    body: { force_restart: forceRestart },
  });
}

export async function fetchWhatsAppSessionStatus(): Promise<WhatsAppSessionStatus> {
  return apiFetch<WhatsAppSessionStatus>("/communication/whatsapp/session/status");
}

export async function fetchWhatsAppQrCode(): Promise<WhatsAppQrCode> {
  return apiFetch<WhatsAppQrCode>("/communication/whatsapp/session/qr");
}

export async function stopWhatsAppSession(): Promise<WhatsAppSessionStatus> {
  return apiFetch<WhatsAppSessionStatus>("/communication/whatsapp/session/stop", {
    method: "POST",
  });
}

export async function fetchCommunicationTemplates(category?: string): Promise<CommunicationTemplate[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<CommunicationTemplate[]>(`/communication/templates${query}`);
}

export async function createCommunicationTemplate(
  payload: CommunicationTemplateCreate
): Promise<CommunicationTemplate> {
  return apiFetch<CommunicationTemplate>("/communication/templates", {
    method: "POST",
    body: payload,
  });
}

export async function sendWhatsAppMessage(
  payload: SendWhatsAppMessageRequest
): Promise<CommunicationMessage> {
  return apiFetch<CommunicationMessage>("/communication/whatsapp/send", {
    method: "POST",
    body: payload,
  });
}

export async function fetchCommunicationMessages(
  recipientPhone?: string,
  limit = 50
): Promise<CommunicationMessage[]> {
  const params = new URLSearchParams();
  if (recipientPhone) params.set("recipient_phone", recipientPhone);
  if (limit) params.set("limit", limit.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<CommunicationMessage[]>(`/communication/messages${qs}`);
}
