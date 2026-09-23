import { useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Inbox, Megaphone, Plus, UserPlus, UsersRound, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QuickAction {
  key: string;
  label: string;
  href: string;
  icon: typeof Plus;
}

/** Every action navigates to a real, working page -- no fake modal
 * that doesn't exist. "Log admission enquiry" deep-links straight into
 * the real Log Enquiry drawer via ?new=1 (see AdmissionEnquiriesPage);
 * the rest land on the real page's own create entry point, one click
 * away, same as this app's existing "+ Create" pattern for every other
 * industry profile. "Schedule event" is deliberately not offered here
 * -- no calendar/event model exists yet (see ADR-046). */
const ACTIONS: QuickAction[] = [
  { key: "add-student", label: "Add student", href: "/students", icon: GraduationCap },
  { key: "log-enquiry", label: "Log admission enquiry", href: "/admission-enquiries?new=1", icon: Inbox },
  { key: "create-application", label: "Create application", href: "/admission-applications", icon: UserPlus },
  { key: "record-attendance", label: "Record attendance", href: "/student-attendance", icon: UsersRound },
  { key: "collect-fee", label: "Collect fee", href: "/fees", icon: Wallet },
  { key: "add-staff", label: "Add staff", href: "/people/employees", icon: UserPlus },
  { key: "create-announcement", label: "Create announcement", href: "/announcements", icon: Megaphone },
];

const DEFAULT_SHOWN = 5;

export function SchoolQuickActions() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? ACTIONS : ACTIONS.slice(0, DEFAULT_SHOWN);

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-semibold">Quick actions</p>
      <div className="flex flex-wrap gap-2">
        {visible.map((action) => (
          <Button key={action.key} asChild variant="outline" size="sm">
            <Link to={action.href}>
              <action.icon className="h-4 w-4" /> {action.label}
            </Link>
          </Button>
        ))}
        {!showAll && ACTIONS.length > DEFAULT_SHOWN && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
            View all actions
          </Button>
        )}
      </div>
    </div>
  );
}

export { ACTIONS as SCHOOL_QUICK_ACTIONS };
