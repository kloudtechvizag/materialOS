import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

interface ProjectRecord {
  id: string;
  name: string;
  customer_id: string;
  sites: { id: string; name: string; state: string }[];
}

/** Launched from the "+ Quick Add Project" row of the project
 * SearchableSelect, which only ever appears once a customer is already
 * chosen -- so the customer is fixed context here, not a field to fill. */
export function QuickAddProjectModal({
  open,
  onOpenChange,
  customerId,
  customerName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onCreated: (project: ProjectRecord) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () =>
      apiFetch<ProjectRecord>("/projects", {
        method: "POST",
        body: { customer_id: customerId, name: name.trim(), sites: [] },
      }),
    onSuccess: (project) => {
      queryClient.setQueryData<ProjectRecord[]>(["projects"], (old) => (old ? [project, ...old] : [project]));
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created and selected", { description: project.name });
      onCreated(project);
      onOpenChange(false);
      setName("");
      create.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setName(""); create.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Add Project</DialogTitle>
          <DialogDescription>For {customerName}. Add a site to it afterward if you need one.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="qa-project-name">Project name</Label>
            <Input id="qa-project-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Vizag Site Phase 2" required />
          </div>

          {create.isError && <ErrorState error={create.error} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Adding..." : "Add Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
