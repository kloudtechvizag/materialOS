import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Server, XCircle } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultApiBase, getApiBase, resetApiBase, setApiBase, testServerConnection } from "@/lib/serverConfig";

type TestResult = { ok: boolean; message: string } | null;

/** Public, no-auth route -- reachable from the Login/Signup pages,
 * since a wrong server address is exactly the kind of problem that
 * stops you from ever getting far enough to reach a normal,
 * authenticated Settings page. There is no hosted MaterialOS server:
 * every install points at a backend the user runs themselves
 * (`docker-compose up`, see the README) -- this is where that
 * address lives, editable at runtime instead of frozen into the app
 * at build time. */
export function ServerSettingsPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState(getApiBase());
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const result = await testServerConnection(url);
    setTestResult(result);
    setTesting(false);
  }

  function handleSave() {
    setApiBase(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    resetApiBase();
    setUrl(defaultApiBase());
    setTestResult(null);
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Server className="h-5 w-5" />
          </div>
          <CardTitle>Server settings</CardTitle>
          <CardDescription>
            MaterialOS has no hosted server -- point this app at the backend you're running (see the README's
            &quot;Running it&quot; section for <code>docker-compose up</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="apiUrl">Server address</Label>
            <Input
              id="apiUrl"
              placeholder="http://localhost:58000/api/v1"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
            />
            <p className="text-xs text-muted-foreground">Include the /api/v1 path, e.g. http://192.168.1.20:58000/api/v1 for a server on your network.</p>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {testResult.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !url}>
              {testing ? "Testing..." : "Test connection"}
            </Button>
            <Button type="button" onClick={handleSave} disabled={!url}>
              {saved ? "Saved" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset}>
              Reset to default
            </Button>
          </div>

          <div className="flex justify-between border-t border-border pt-4 text-sm">
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">Back to sign in</Link>
            <button type="button" onClick={() => navigate(-1)} className="text-muted-foreground underline-offset-4 hover:underline">Go back</button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
