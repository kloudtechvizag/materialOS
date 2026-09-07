import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users as UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

const ROLE_OPTIONS = [
  "owner",
  "admin",
  "finance_manager",
  "accountant",
  "sales_manager",
  "salesperson",
  "purchase_manager",
  "warehouse_manager",
  "warehouse_staff",
  "dispatcher",
  "driver",
  "auditor",
];

export function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("salesperson");

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<User[]>("/users"),
  });

  const createUser = useMutation({
    mutationFn: () =>
      apiFetch<User>("/users", {
        method: "POST",
        body: { full_name: fullName, email, password, role_names: [role] },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setFullName("");
      setEmail("");
      setPassword("");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Each user gets exactly one role-based view of the business.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add user"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New user</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Full name</Label>
                <Input id="user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-password">Temporary password</Label>
                <Input id="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-role">Role</Label>
                <select
                  id="user-role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {createUser.isError && <ErrorState error={createUser.error} />}
            <Button onClick={() => createUser.mutate()} disabled={!fullName || !email || !password || createUser.isPending}>
              {createUser.isPending ? "Saving..." : "Save user"}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-32" />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {users && users.length === 0 && !showForm && (
        <EmptyState
          icon={UsersIcon}
          title="No team members added yet"
          description="Add your sales, accounts, and warehouse staff so each of them gets a role-appropriate view."
          actionLabel="Add user"
          onAction={() => setShowForm(true)}
        />
      )}

      {users && users.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
