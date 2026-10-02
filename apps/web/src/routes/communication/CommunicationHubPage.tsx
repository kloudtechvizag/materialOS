import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Layers,
  Clock,
  Bot,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  fetchCommunicationMessages,
  fetchCommunicationTemplates,
  createCommunicationTemplate,
  fetchCommunicationConfig,
  fetchWhatsAppSessionStatus,
  type CommunicationTemplate,
} from "@/lib/communication";
import { useIndustryProfile } from "@/lib/industryProfile";
import { filterTemplatesForProfile } from "@/lib/communicationProfile";
import { WhatsAppSendModal } from "@/components/communication/WhatsAppSendModal";

export function CommunicationHubPage() {
  const queryClient = useQueryClient();
  const { profile } = useIndustryProfile();
  const [activeTab, setActiveTab] = useState("messages");
  const [searchPhone, setSearchPhone] = useState("");
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | null>(null);
  const [filterByProfileOnly, setFilterByProfileOnly] = useState(true);

  // New Template Form State
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newBody, setNewBody] = useState("");
  const [newSmsBody, setNewSmsBody] = useState("");

  const { data: config } = useQuery({
    queryKey: ["communication-config"],
    queryFn: fetchCommunicationConfig,
  });

  const { data: sessionStatus } = useQuery({
    queryKey: ["whatsapp-session-status"],
    queryFn: fetchWhatsAppSessionStatus,
    refetchInterval: 10000,
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["communication-messages", searchPhone],
    queryFn: () => fetchCommunicationMessages(searchPhone),
    refetchInterval: 5000,
  });

  const { data: rawTemplates } = useQuery({
    queryKey: ["communication-templates"],
    queryFn: () => fetchCommunicationTemplates(),
  });

  const templates = useMemo(() => {
    if (!filterByProfileOnly || !profile) return rawTemplates;
    return filterTemplatesForProfile(rawTemplates, profile);
  }, [rawTemplates, profile, filterByProfileOnly]);

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      createCommunicationTemplate({
        slug: newSlug,
        name: newName,
        category: newCategory,
        whatsapp_body: newBody,
        sms_body: newSmsBody || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communication-templates"] });
      toast.success("Template created successfully!");
      setNewSlug("");
      setNewName("");
      setNewBody("");
      setNewSmsBody("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create template");
    },
  });

  const isWorking = sessionStatus?.status === "WORKING" || config?.session_status === "WORKING";

  const totalMessages = messages?.length || 0;
  const deliveredCount = messages?.filter((m) => m.status === "delivered" || m.status === "read").length || 0;
  const readCount = messages?.filter((m) => m.status === "read").length || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <MessageSquare className="h-6 w-6 text-emerald-400" />
            Communication Center
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Omnichannel WhatsApp & SMS dispatch, automated document delivery, and live message timeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-zinc-300">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isWorking ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              )}
            />
            <span className="font-medium">
              {isWorking ? `WhatsApp Active (+${sessionStatus?.phone_number || config?.phone_number || ""})` : "WhatsApp Offline"}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => setTestModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Quick Dispatch
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-400">Total Dispatched</span>
              <p className="text-2xl font-extrabold text-white mt-0.5">{totalMessages}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Send className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-400">Delivered</span>
              <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{deliveredCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-400">Read Receipts</span>
              <p className="text-2xl font-extrabold text-sky-400 mt-0.5">{readCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <CheckCheck className="h-5 w-5 text-sky-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-zinc-400">AI Copilot Guard</span>
              <p className="text-sm font-bold text-white mt-1">RLS Protected</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bot className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 border border-white/10 bg-white/5 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            className={cn(
              "flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === "messages"
                ? "bg-white/10 text-white shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Message Timeline & Audit Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activeTab === "templates"
                ? "bg-white/10 text-white shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Template Manager & Smartphone Preview
          </button>
        </div>

        {/* Tab 1: Messages Timeline */}
        {activeTab === "messages" && (
          <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white">Outbound Message Stream</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Real-time status updates received via WAHA webhooks (single grey tick, double delivered tick, blue read receipt).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="Search phone number..."
                    className="pl-8 h-8 text-xs border-white/10 bg-white/5 text-white"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchMessages()}
                  className="h-8 border-white/10 bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {messages?.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No messages sent yet. Use Quick Dispatch to send your first WhatsApp message!
                </div>
              ) : (
                <div className="divide-y divide-white/5 overflow-x-auto">
                  {messages?.map((msg) => {
                    const isRead = msg.status === "read";
                    const isDelivered = msg.status === "delivered";
                    const isSent = msg.status === "sent";
                    const isFailed = msg.status === "failed";

                    return (
                      <div key={msg.id} className="py-3.5 flex items-start justify-between gap-4 text-xs">
                        <div className="space-y-1 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {msg.recipient_name || `+${msg.recipient_phone}`}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              +{msg.recipient_phone}
                            </span>
                            {msg.template_slug && (
                              <Badge variant="outline" className="border-white/10 text-[10px] py-0 text-zinc-400">
                                {msg.template_slug}
                              </Badge>
                            )}
                            {msg.media_filename && (
                              <Badge className="bg-emerald-950/40 text-emerald-300 border-emerald-500/30 text-[10px] py-0 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {msg.media_filename}
                              </Badge>
                            )}
                          </div>
                          <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap line-clamp-2">
                            {msg.rendered_text}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-end gap-1">
                              {isRead && <CheckCheck className="h-4 w-4 text-sky-400" />}
                              {isDelivered && <CheckCheck className="h-4 w-4 text-zinc-400" />}
                              {isSent && <Check className="h-4 w-4 text-zinc-400" />}
                              {isFailed && <AlertCircle className="h-4 w-4 text-rose-400" />}
                              <span
                                className={cn(
                                  "font-semibold uppercase text-[10px]",
                                  isRead ? "text-sky-400" : isDelivered ? "text-zinc-300" : isFailed ? "text-rose-400" : "text-zinc-400"
                                )}
                              >
                                {msg.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Template Manager & Mockup */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template List */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                        Pre-Configured Templates
                        {profile && (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] py-0">
                            {profile.name}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-0.5">
                        {filterByProfileOnly && profile
                          ? `Displaying templates tailored for your ${profile.name} business profile.`
                          : "Displaying all communication templates in system."}
                      </CardDescription>
                    </div>
                    {profile && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFilterByProfileOnly(!filterByProfileOnly)}
                        className="text-[11px] h-7 border-white/10 text-zinc-300 hover:text-white"
                      >
                        {filterByProfileOnly ? "Show All Templates" : `Filter by ${profile.name}`}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {templates?.map((t) => (
                    <div
                      key={t.slug}
                      onClick={() => setSelectedTemplate(t)}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer",
                        selectedTemplate?.slug === t.slug
                          ? "border-emerald-500/60 bg-emerald-950/20"
                          : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-xs">{t.name}</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="border-white/10 text-[10px] py-0 text-zinc-400 uppercase">
                            {t.category}
                          </Badge>
                          <span className="text-[10px] font-mono text-zinc-500">#{t.slug}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {t.whatsapp_body}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Add Custom Template */}
              <Card className="border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Plus className="h-4 w-4 text-emerald-400" /> Create Custom Template
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-300">Template Slug</Label>
                      <Input
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                        placeholder="e.g. order_ready"
                        className="h-8 text-xs border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-300">Display Name</Label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Order Ready Notification"
                        className="h-8 text-xs border-white/10 bg-white/5 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-300">Category</Label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white"
                      >
                        <option value="sales" className="bg-zinc-900">Sales & Billing</option>
                        <option value="dispatch" className="bg-zinc-900">Dispatch & Fleet</option>
                        <option value="fees" className="bg-zinc-900">Fees & Finance</option>
                        <option value="attendance" className="bg-zinc-900">Attendance</option>
                        <option value="contractor" className="bg-zinc-900">Contractor & Projects</option>
                        <option value="general" className="bg-zinc-900">General</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-300">WhatsApp Body (use {"{{placeholder}}"} syntax)</Label>
                    <Textarea
                      rows={3}
                      value={newBody}
                      onChange={(e) => setNewBody(e.target.value)}
                      placeholder="Dear {{customer_name}}, your order #{{order_no}} is packed and ready for pickup."
                      className="border-white/10 bg-white/5 text-xs text-white resize-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => createTemplateMutation.mutate()}
                      disabled={createTemplateMutation.isPending || !newSlug || !newName || !newBody}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                    >
                      Save Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Smartphone WhatsApp Mockup */}
            <div className="space-y-3">
              <div className="sticky top-6">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-emerald-400" /> WhatsApp Live Mockup
                  </span>
                  <span className="text-[10px] text-zinc-500">Official Preview</span>
                </div>

                {/* Smartphone Device Frame */}
                <div className="rounded-[2.5rem] border-4 border-zinc-800 bg-[#0B141A] p-3 shadow-2xl overflow-hidden min-h-[480px] flex flex-col justify-between">
                  {/* Phone Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 px-2 text-[11px] text-zinc-300">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-300 text-[10px]">
                        MO
                      </div>
                      <div>
                        <span className="font-bold text-white block leading-tight">Sri Balaji Steels</span>
                        <span className="text-[9px] text-emerald-400">Official Business Account</span>
                      </div>
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="py-4 space-y-3 flex-1 flex flex-col justify-end">
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#005C4B] p-3 text-xs text-zinc-100 shadow-md self-start">
                      <div className="whitespace-pre-wrap leading-relaxed text-[11px]">
                        {selectedTemplate ? (
                          selectedTemplate.whatsapp_body
                        ) : (
                          "Select a template on the left to preview its live WhatsApp rendering with tags."
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-emerald-200/70">
                        <span>10:30 AM</span>
                        <CheckCheck className="h-3 w-3 text-sky-300" />
                      </div>
                    </div>
                  </div>

                  {/* Phone Input Bar */}
                  <div className="rounded-full bg-zinc-900 border border-white/10 px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Message...</span>
                    <Send className="h-3.5 w-3.5 text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Dispatch Modal */}
      <WhatsAppSendModal
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        recipientPhone="+919848012345"
        recipientName="Direct Dispatch"
        defaultTemplateSlug="quote_created"
      />
    </div>
  );
}
