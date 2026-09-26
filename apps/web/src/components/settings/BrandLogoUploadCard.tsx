import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Building2, AlertCircle, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuthenticatedImage } from "@/lib/useAuthenticatedImage";
import { cn } from "@/lib/utils";

interface BrandLogoUploadCardProps {
  logoUrl?: string | null;
  companyName?: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".webp"];
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export function BrandLogoUploadCard({ logoUrl, companyName = "Organization" }: BrandLogoUploadCardProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Authenticated blob URL for displaying the logo securely
  const authenticatedLogoUrl = useAuthenticatedImage(logoUrl ?? null, logoUrl);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<{ logo_url: string; file_name: string; size_bytes: number }>(
        "/tenant/branding/logo",
        {
          method: "POST",
          body: formData,
          isFormData: true,
        }
      );
    },
    onSuccess: () => {
      setClientError(null);
      toast.success("Brand logo updated successfully", {
        description: "Your logo is now active across headers, receipts, and invoices.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      queryClient.invalidateQueries({ queryKey: ["receipt"] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Failed to upload logo. Please try again.";
      setClientError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ success: boolean; logo_url: null }>("/tenant/branding/logo", {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      setClientError(null);
      toast.success("Brand logo removed", {
        description: "Reverted to default brand placeholder.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      queryClient.invalidateQueries({ queryKey: ["receipt"] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Failed to delete logo. Please try again.";
      setClientError(message);
      toast.error(message);
    },
  });

  function validateFile(file: File): string | null {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.type);

    if (!isValidExt && !isValidMime) {
      return `Invalid format (${ext || file.type}). Supported formats: PNG, JPG, SVG, WebP.`;
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      return `File size (${sizeMb} MB) exceeds the 2 MB limit.`;
    }

    return null;
  }

  function handleProcessFile(file: File) {
    const error = validateFile(file);
    if (error) {
      setClientError(error);
      return;
    }
    setClientError(null);
    uploadMutation.mutate(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
    // reset input so user can re-upload same file if desired
    e.target.value = "";
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  }

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const hasLogo = Boolean(logoUrl);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Brand & Identity</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Upload your organization's logo to customize your dashboard header, printed receipts, and client-facing documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Logo Preview Area / Drop Target */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={cn(
                "relative flex h-28 w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 transition-all duration-200 select-none sm:h-32 sm:w-32",
                dragOver
                  ? "border-primary bg-primary/10 shadow-inner scale-[1.02]"
                  : "border-dashed border-border hover:border-muted-foreground/50 bg-muted/20 hover:bg-muted/40",
                isUploading && "pointer-events-none opacity-80"
              )}
              title="Click or drag image to upload logo"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-primary animate-in fade-in">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-[11px] font-medium">Uploading...</span>
                </div>
              ) : hasLogo && (authenticatedLogoUrl || logoUrl) ? (
                <div className="relative flex h-full w-full items-center justify-center p-2">
                  <img
                    src={authenticatedLogoUrl || logoUrl!}
                    alt={`${companyName} logo`}
                    className="h-full w-full object-contain rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                    <span className="text-xs font-medium text-white flex items-center gap-1">
                      <ImagePlus className="h-3.5 w-3.5" /> Change
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground">
                  <Building2 className="h-8 w-8 stroke-[1.5] text-muted-foreground/70" />
                  <span className="text-[11px] font-medium">No Logo</span>
                  <span className="text-[9px] text-muted-foreground/60 hidden sm:inline">Drop image here</span>
                </div>
              )}
            </div>

            {/* Upload Controls & Specifications */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-2"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {hasLogo ? "Upload New Logo" : "Upload Logo"}
                </Button>

                {hasLogo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={isUploading || isDeleting}
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove Logo
                  </Button>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Allowed formats: <span className="font-medium text-foreground">PNG, JPG, SVG, WebP</span> (Max size: 2MB)</p>
                <p>Recommended dimensions: <span className="font-medium text-foreground">512×512 px</span> or square aspect ratio (1:1)</p>
              </div>

              {clientError && (
                <div className="flex items-center gap-2 text-xs font-medium text-destructive animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{clientError}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Organization Logo</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the company logo? This will revert your dashboard header, printed receipts, and exported documents to the default logo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Logo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

