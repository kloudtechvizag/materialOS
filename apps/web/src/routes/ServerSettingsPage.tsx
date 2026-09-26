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

/** Public, no-auth route for self-hosted backend configuration,
 * upgraded with Obsidian Dark card, styled test status indicators (emerald/rose),
 * and clean controls. */
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
      <Card className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl text-white">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Server className="h-5 w-5" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-zinc-400">
              Self-Hosted Node
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">Server Settings</CardTitle>
            <CardDescription className="text-zinc-400 mt-1">
              MaterialOS points at your local backend instance. Point this app to your server endpoint below.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="apiUrl" className="text-xs font-medium text-zinc-300">Server Endpoint API Address</Label>
            <Input
              id="apiUrl"
              placeholder="http://localhost:58000/api/v1"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
              }}
              className="h-11 border-white/10 bg-white/5 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
            />
            <p className="text-xs text-zinc-400">Include the /api/v1 path, e.g. http://192.168.1.20:58000/api/v1 for LAN servers.</p>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-medium ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testing || !url}
              className="border-white/15 bg-white/5 text-xs text-zinc-200 hover:bg-white/10 hover:text-white"
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!url}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold text-xs text-white hover:from-violet-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
            >
              {saved ? "Saved ✓" : "Save Settings"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              className="text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            >
              Reset Default
            </Button>
          </div>

          <div className="flex justify-between border-t border-white/10 pt-4 text-xs">
            <Link to="/login" className="font-medium text-violet-400 underline-offset-4 hover:underline hover:text-violet-300">
              ← Back to Sign In
            </Link>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-zinc-400 underline-offset-4 hover:underline hover:text-zinc-200"
            >
              Go back
            </button>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
