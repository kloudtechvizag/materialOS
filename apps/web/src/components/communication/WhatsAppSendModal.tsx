import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  FileText,
  CheckCircle2,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  fetchCommunicationTemplates,
  sendWhatsAppMessage,
} from "@/lib/communication";

interface WhatsAppSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPhone: string;
  recipientName?: string;
  defaultTemplateSlug?: string;
  defaultVariables?: Record<string, string>;
  mediaUrl?: string;
  mediaFilename?: string;
  entityType?: string;
  entityId?: string;
  onSuccess?: () => void;
}

export function WhatsAppSendModal({
  open,
  onOpenChange,
  recipientPhone: initialPhone,
  recipientName = "",
  defaultTemplateSlug,
  defaultVariables = {},
  mediaUrl,
  mediaFilename,
  entityType,
  entityId,
  onSuccess,
}: WhatsAppSendModalProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(initialPhone);
  const [selectedSlug, setSelectedSlug] = useState(defaultTemplateSlug || "");
  const [variables, setVariables] = useState<Record<string, string>>(defaultVariables);
  const [customText, setCustomText] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    setPhone(initialPhone);
  }, [initialPhone]);

  useEffect(() => {
    if (defaultTemplateSlug) setSelectedSlug(defaultTemplateSlug);
    if (defaultVariables) setVariables(defaultVariables);
  }, [defaultTemplateSlug, defaultVariables]);

  const { data: templates } = useQuery({
    queryKey: ["communication-templates"],
    queryFn: () => fetchCommunicationTemplates(),
    enabled: open,
  });

  const selectedTemplate = templates?.find((t) => t.slug === selectedSlug);

  // Compute rendered preview
  const renderedMessage = (() => {
    if (useCustom) return customText;
    if (!selectedTemplate) return customText;
    let text = selectedTemplate.whatsapp_body;
    for (const [key, val] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val || "");
    }
    return text;
  })();

  const sendMutation = useMutation({
    mutationFn: () =>
      sendWhatsAppMessage({
        recipient_phone: phone,
        recipient_name: recipientName,
        template_slug: useCustom ? undefined : selectedSlug,
        message_text: useCustom ? customText : undefined,
        variables,
        media_url: mediaUrl,
        media_filename: mediaFilename,
        entity_type: entityType,
        entity_id: entityId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
      toast.success(`Message dispatched to ${phone} via WhatsApp!`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send WhatsApp message");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-white/15 bg-[#0F1424] text-white backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              1-Click WhatsApp Dispatch
            </DialogTitle>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
              WAHA Verified
            </Badge>
          </div>
          <DialogDescription className="text-xs text-zinc-400">
            Preview and send transactional documents with official WhatsApp formatting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Recipient Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-zinc-300 text-xs font-medium">Recipient Mobile Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98480 12345"
                className="border-white/10 bg-white/5 text-xs text-white focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-300 text-xs font-medium">Recipient Name</Label>
              <Input
                value={recipientName}
                readOnly
                className="border-white/10 bg-white/5 text-xs text-zinc-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Template Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-zinc-300 text-xs font-medium">Message Template</Label>
              <button
                type="button"
                onClick={() => setUseCustom(!useCustom)}
                className="text-[11px] text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                {useCustom ? "Switch back to Template" : "Write Custom Message"}
              </button>
            </div>
            {!useCustom ? (
              <select
                value={selectedSlug}
                onChange={(e) => {
                  setSelectedSlug(e.target.value);
                  const tpl = templates?.find((t) => t.slug === e.target.value);
                  if (tpl) {
                    setVariables((prev) => ({ ...tpl.sample_variables, ...prev }));
                  }
                }}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="" disabled className="bg-zinc-900">Select Template...</option>
                {templates?.map((t) => (
                  <option key={t.slug} value={t.slug} className="bg-zinc-900">
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            ) : (
              <Textarea
                rows={4}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type your WhatsApp message..."
                className="border-white/10 bg-white/5 text-xs text-white resize-none"
              />
            )}
          </div>

          {/* Attached Document Pill (if present) */}
          {mediaFilename && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs">
              <div className="flex items-center gap-2 text-emerald-300 font-medium">
                <FileText className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="truncate">{mediaFilename}</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                PDF Attached
              </Badge>
            </div>
          )}

          {/* Live Smartphone Chat Mockup Preview */}
          <div className="space-y-1">
            <Label className="text-zinc-400 text-[11px] flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-zinc-400" />
              WhatsApp Live Bubble Preview
            </Label>
            <div className="rounded-2xl border border-white/10 bg-[#0B141A] p-3.5 shadow-inner">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#005C4B] p-3 text-xs text-zinc-100 shadow-md">
                <div className="whitespace-pre-wrap leading-relaxed">
                  {renderedMessage || <span className="italic text-emerald-200/60">No message content...</span>}
                </div>
                {mediaFilename && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-[11px] text-zinc-200">
                    <FileText className="h-4 w-4 text-emerald-300 shrink-0" />
                    <span className="truncate font-mono">{mediaFilename}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-emerald-200/70">
                  <span>10:45 AM</span>
                  <CheckCircle2 className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/5 text-xs text-zinc-300 hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !phone.trim() || !renderedMessage.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
