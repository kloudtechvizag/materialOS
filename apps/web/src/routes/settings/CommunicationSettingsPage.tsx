import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Smartphone,
  QrCode,
  CheckCircle2,
  RefreshCw,
  PowerOff,
  PhoneOff,
  Sparkles,
  Bot,
  ShieldCheck,
  Zap,
  Loader2,
  Battery,
  BatteryCharging,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { QrCanvas } from "@/components/communication/QrCanvas";
import {
  fetchCommunicationConfig,
  updateCommunicationConfig,
  startWhatsAppSession,
  fetchWhatsAppSessionStatus,
  stopWhatsAppSession,
} from "@/lib/communication";

export function CommunicationSettingsPage() {
  const queryClient = useQueryClient();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pollInterval, setPollInterval] = useState<number | false>(false);

  // Queries
  const { data: config } = useQuery({
    queryKey: ["communication-config"],
    queryFn: fetchCommunicationConfig,
  });

  const { data: sessionStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["whatsapp-session-status"],
    queryFn: fetchWhatsAppSessionStatus,
    refetchInterval: pollInterval,
  });

  // Local form state
  const [autoRejectCalls, setAutoRejectCalls] = useState(true);
  const [autoRejectMessage, setAutoRejectMessage] = useState("");
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [smsProvider, setSmsProvider] = useState("msg91");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("");

  useEffect(() => {
    if (config) {
      setAutoRejectCalls(config.auto_reject_calls);
      setAutoRejectMessage(config.auto_reject_message);
      setMcpEnabled(config.mcp_copilot_enabled);
      setSmsProvider(config.sms_provider || "msg91");
    }
  }, [config]);

  // Start Session Mutation
  const startMutation = useMutation({
    mutationFn: () => startWhatsAppSession(),
    onSuccess: (data) => {
      queryClient.setQueryData(["whatsapp-session-status"], data);
      setQrModalOpen(true);
      setPollInterval(2500); // Start polling while QR is open
      toast.success("WhatsApp pairing initiated. Please scan the QR code.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to start WhatsApp session");
    },
  });

  // Stop Session Mutation
  const stopMutation = useMutation({
    mutationFn: () => stopWhatsAppSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-session-status"] });
      queryClient.invalidateQueries({ queryKey: ["communication-config"] });
      setQrModalOpen(false);
      setPollInterval(false);
      toast.info("WhatsApp session stopped.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to stop WhatsApp session");
    },
  });

  // Update Config Mutation
  const updateConfigMutation = useMutation({
    mutationFn: () =>
      updateCommunicationConfig({
        auto_reject_calls: autoRejectCalls,
        auto_reject_message: autoRejectMessage,
        mcp_copilot_enabled: mcpEnabled,
        sms_provider: smsProvider,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-config"] });
      toast.success("Communication settings saved successfully.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save settings");
    },
  });

  // Watch status changes in modal: auto-close and celebrate on WORKING
  useEffect(() => {
    if (sessionStatus?.status === "WORKING" && qrModalOpen) {
      setPollInterval(false);
      setQrModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["communication-config"] });
      toast.success("🎉 WhatsApp connected successfully!");
    }
  }, [sessionStatus?.status, qrModalOpen, queryClient]);

  const isWorking = sessionStatus?.status === "WORKING" || config?.session_status === "WORKING";
  const isQrRequired = sessionStatus?.status === "SCAN_QR_CODE" || sessionStatus?.qr_available;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-emerald-400" />
          WhatsApp & Omnichannel Communication
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Configure WAHA WhatsApp sessions, automated call deflection, AI Copilot WhatsApp bridge, and transactional SMS gateways.
        </p>
      </div>

      {/* 1. Primary WAHA WhatsApp Connection Card */}
      <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-emerald-400" />
                  WAHA WhatsApp Business Session
                </CardTitle>
                {isWorking ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected & Active
                  </Badge>
                ) : isQrRequired ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Scan QR to Pair
                  </Badge>
                ) : (
                  <Badge className="bg-zinc-800 text-zinc-400 border-white/10 flex items-center gap-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                    Disconnected
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-zinc-400">
                Direct integration with WAHA (WhatsApp HTTP API by devlike.pro). Send official invoices, receipts, and challans with 1-click.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {isWorking ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchStatus()}
                    className="border-white/10 bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check Health
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                    className="text-xs shadow-sm bg-rose-600 hover:bg-rose-700"
                  >
                    {stopMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PowerOff className="h-3.5 w-3.5 mr-1.5" />}
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <QrCode className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Connect WhatsApp
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs">
            <div>
              <span className="text-zinc-400">Linked WhatsApp Number:</span>
              <p className="mt-1 font-mono text-sm font-semibold text-white">
                {sessionStatus?.phone_number || config?.phone_number ? (
                  `+${sessionStatus?.phone_number || config?.phone_number}`
                ) : (
                  <span className="text-zinc-500 italic">Not linked yet</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Device / Profile Name:</span>
              <p className="mt-1 text-sm font-medium text-white truncate">
                {sessionStatus?.push_name || config?.push_name || (
                  <span className="text-zinc-500 italic">Not available</span>
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-400">Engine / Battery Status:</span>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-zinc-300">
                {sessionStatus?.battery_level !== undefined && sessionStatus.battery_level !== null ? (
                  <span className="flex items-center gap-1">
                    {sessionStatus.is_plugged ? <BatteryCharging className="h-4 w-4 text-emerald-400" /> : <Battery className="h-4 w-4 text-zinc-400" />}
                    {sessionStatus.battery_level}%
                  </span>
                ) : (
                  <span className="text-emerald-400 font-mono text-xs">WAHA (NOWEB Core)</span>
                )}
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400 text-xs">Auto-Reconnecting</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. WAHA Modern Apps Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reject Calls App */}
        <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <PhoneOff className="h-4 w-4 text-amber-400" />
                Reject Calls App (Call Deflection)
              </CardTitle>
              <Switch
                checked={autoRejectCalls}
                onCheckedChange={setAutoRejectCalls}
              />
            </div>
            <CardDescription className="text-xs text-zinc-400">
              WAHA automatically rejects incoming WhatsApp voice and video calls, immediately sending a text deflection reply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs text-zinc-300 font-medium">Automated WhatsApp Reply Message</Label>
            <Textarea
              rows={3}
              value={autoRejectMessage}
              onChange={(e) => setAutoRejectMessage(e.target.value)}
              placeholder="Enter automated WhatsApp response sent to callers..."
              className="border-white/10 bg-white/5 text-xs text-zinc-200 resize-none focus:border-amber-500"
            />
            <p className="text-[11px] text-zinc-500 leading-snug">
              Prevents customer service disruptions while ensuring prospective clients receive your official portal link instantly.
            </p>
          </CardContent>
        </Card>

        {/* MCP AI Copilot Integration */}
        <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-400" />
                MCP & AI Copilot WhatsApp Bridge
              </CardTitle>
              <Switch
                checked={mcpEnabled}
                onCheckedChange={setMcpEnabled}
              />
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Allows the MaterialOS AI Copilot to securely answer customer questions (order status, invoice balance, circulars) over WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-zinc-300">
            <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 space-y-1.5">
              <div className="flex items-center gap-2 text-violet-300 font-semibold text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Zero-Leakage Security (RLS Protected)</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                The Copilot identifies incoming messages by phone number and strictly queries data belonging to that customer or parent using Postgres Row-Level Security.
              </p>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 text-[11px]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Two-way Interactive Workflows Enabled</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Transactional SMS Gateway (Pluggable Future Architecture) */}
      <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-sky-400" />
                Transactional SMS Gateway & DLT (India Regulatory Ready)
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Configure fallback SMS delivery for critical alerts when recipients are not on WhatsApp.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-sky-500/30 text-sky-300 bg-sky-950/30 text-[10px]">
              Omnichannel Fallback
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">SMS Provider</Label>
              <select
                value={smsProvider}
                onChange={(e) => setSmsProvider(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="msg91" className="bg-zinc-900">MSG91 (India DLT)</option>
                <option value="fast2sms" className="bg-zinc-900">Fast2SMS (Quick OTP/Transactional)</option>
                <option value="twilio" className="bg-zinc-900">Twilio (Global SMS)</option>
                <option value="aws_sns" className="bg-zinc-900">AWS SNS</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">Sender ID / DLT Header</Label>
              <Input
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value)}
                placeholder="e.g. BALAJI or APEXCL"
                className="border-white/10 bg-white/5 text-xs text-white focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">Provider API Key / Auth Token</Label>
              <Input
                type="password"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="border-white/10 bg-white/5 text-xs text-white focus:border-sky-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => updateConfigMutation.mutate()}
          disabled={updateConfigMutation.isPending}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-6 shadow-lg shadow-violet-600/20"
        >
          {updateConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Save Communication Settings
        </Button>
      </div>

      {/* QR Pairing Dialog */}
      <Dialog
        open={qrModalOpen}
        onOpenChange={(open) => {
          setQrModalOpen(open);
          if (!open) setPollInterval(false);
        }}
      >
        <DialogContent className="max-w-md border-white/15 bg-[#0F1424] text-white backdrop-blur-2xl">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-lg font-bold text-white flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-400" />
              Link WhatsApp to MaterialOS
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Open WhatsApp on your phone and scan this code to link your business number.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            {sessionStatus?.qr_code_raw || config?.qr_code_raw ? (
              <QrCanvas
                value={sessionStatus?.qr_code_raw || config?.qr_code_raw || ""}
                size={240}
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-60 h-60 rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center">
                <Loader2 className="h-8 w-8 text-emerald-400 animate-spin mb-3" />
                <span className="text-xs font-medium text-zinc-300">Generating Pairing QR...</span>
                <span className="text-[11px] text-zinc-500 mt-1">Starting WAHA engine</span>
              </div>
            )}

            <div className="w-full space-y-2 rounded-xl bg-white/[0.04] p-3 text-xs border border-white/5 text-zinc-300">
              <span className="font-semibold text-white block">Instructions:</span>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-[11px]">
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Tap <strong>Settings</strong> or <strong>Menu (⋮)</strong> &rarr; <strong>Linked Devices</strong></li>
                <li>Tap <strong>Link a device</strong> and point your camera at this QR code</li>
              </ol>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
              <span>Listening for pairing confirmation...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
