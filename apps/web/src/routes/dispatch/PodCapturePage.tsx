import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MapPin } from "lucide-react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

/** ADR-005: the driver app's POD capture, as a mobile web page --
 * signature via canvas, photo via the device camera input, location via
 * the browser Geolocation API. No app install, no separate codebase. */
export function PodCapturePage() {
  const { challanId } = useParams<{ challanId: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [status, setStatus] = useState("delivered");
  const [shortageNotes, setShortageNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getCanvasPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasSignature(true);
  }

  function stopDraw() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  function captureLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setLocationError(err.message)
    );
  }

  const submit = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("receiver_name", receiverName);
      form.append("status", status);
      if (shortageNotes) form.append("shortage_notes", shortageNotes);
      if (location) {
        form.append("latitude", String(location.lat));
        form.append("longitude", String(location.lng));
      }
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        form.append("signature_data_url", canvas.toDataURL("image/png"));
      }
      if (photo) form.append("photo", photo);
      return apiFetch(`/delivery-challans/${challanId}/pod`, { method: "POST", body: form, isFormData: true });
    },
  });

  if (submit.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="space-y-3 pt-10 pb-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="text-lg font-semibold">Delivery confirmed</p>
            <p className="text-sm text-muted-foreground">No paper challan needed -- this is the record.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 p-4">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Proof of delivery</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Receiver name</Label>
            <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Who received the goods?" />
          </div>

          <div className="space-y-1.5">
            <Label>Delivery status</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="delivered">Delivered in full</option>
              <option value="partial">Partial / shortage</option>
              <option value="failed">Failed delivery</option>
            </select>
          </div>

          {status !== "delivered" && (
            <div className="space-y-1.5">
              <Label>Shortage / damage notes</Label>
              <textarea
                className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={shortageNotes}
                onChange={(e) => setShortageNotes(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Signature</Label>
            <canvas
              ref={canvasRef}
              width={340}
              height={140}
              className="w-full touch-none rounded-md border border-input bg-white"
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={stopDraw}
              onPointerLeave={stopDraw}
            />
            <button type="button" onClick={clearSignature} className="text-xs text-muted-foreground hover:underline">
              Clear
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Photo</Label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
              <MapPin className="h-4 w-4" /> {location ? "Location captured" : "Capture current location"}
            </Button>
            {locationError && <p className="text-xs text-destructive">{locationError}</p>}
          </div>

          {submit.isError && <ErrorState error={submit.error} />}

          <Button className="w-full" onClick={() => submit.mutate()} disabled={!receiverName || submit.isPending}>
            {submit.isPending ? "Submitting..." : "Confirm delivery"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
