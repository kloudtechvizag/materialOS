import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";
import { employeeName, type Department, type Designation, type Employee } from "@/lib/people";

interface Branch {
  id: string;
  name: string;
}

const STEPS = ["Personal info", "Employment details", "Compensation & payroll"] as const;

const EMPTY_PERSONAL = { first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", gender: "" };
const EMPTY_EMPLOYMENT = {
  joining_date: "", branch_id: "", department_id: "", designation_id: "", employment_type: "full_time", reporting_manager_id: "",
};
const EMPTY_COMPENSATION = { bank_name: "", bank_account_number: "", bank_ifsc: "", pan_number: "" };
const EMPTY_SALARY = { effective_date: "", annual_ctc: "", monthly_gross: "", basic: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Multi-step employee creation: Personal + Employment are local UI
 * state that get combined into one POST /employees call (the backend's
 * EmployeeCreate schema doesn't separate them -- see ADR). Compensation
 * is a genuinely separate step because it's two separate, more-tightly
 * permissioned endpoints (PATCH .../compensation, POST .../salary) that
 * require the employee to already exist -- see spec sec77 / hr.py's
 * EmployeeOut/EmployeeCompensationOut split. */
export function EmployeeDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState(EMPTY_PERSONAL);
  const [employment, setEmployment] = useState(EMPTY_EMPLOYMENT);
  const [compensation, setCompensation] = useState(EMPTY_COMPENSATION);
  const [salary, setSalary] = useState(EMPTY_SALARY);
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);

  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => apiFetch<Department[]>("/departments") });
  const { data: designations } = useQuery({ queryKey: ["designations"], queryFn: () => apiFetch<Designation[]>("/designations") });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => apiFetch<Employee[]>("/employees") });

  const reset = () => {
    setStep(0);
    setPersonal(EMPTY_PERSONAL);
    setEmployment(EMPTY_EMPLOYMENT);
    setCompensation(EMPTY_COMPENSATION);
    setSalary(EMPTY_SALARY);
    setCreatedEmployee(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const createEmployee = useMutation({
    mutationFn: () =>
      apiFetch<Employee>("/employees", {
        method: "POST",
        body: {
          ...personal,
          email: personal.email.trim() || null,
          phone: personal.phone.trim() || null,
          date_of_birth: personal.date_of_birth || null,
          gender: personal.gender || null,
          ...employment,
          department_id: employment.department_id || null,
          designation_id: employment.designation_id || null,
          reporting_manager_id: employment.reporting_manager_id || null,
        },
      }),
    onSuccess: (employee) => {
      setCreatedEmployee(employee);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setStep(2);
    },
  });

  const saveCompensation = useMutation({
    mutationFn: () =>
      apiFetch(`/employees/${createdEmployee!.id}/compensation`, {
        method: "PATCH",
        body: {
          bank_name: compensation.bank_name.trim() || null,
          bank_account_number: compensation.bank_account_number.trim() || null,
          bank_ifsc: compensation.bank_ifsc.trim() || null,
          pan_number: compensation.pan_number.trim() || null,
        },
      }),
  });

  const saveSalary = useMutation({
    mutationFn: () => apiFetch(`/employees/${createdEmployee!.id}/salary`, { method: "POST", body: salary }),
  });

  const finish = async () => {
    const hasCompensation = Object.values(compensation).some((v) => v.trim());
    const hasSalary = salary.effective_date && salary.annual_ctc && salary.monthly_gross && salary.basic;
    try {
      if (hasCompensation) await saveCompensation.mutateAsync();
      if (hasSalary) await saveSalary.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["employee-compensation", createdEmployee!.id] });
      queryClient.invalidateQueries({ queryKey: ["employee-salary", createdEmployee!.id] });
      toast.success(`${employeeName(createdEmployee!)} added`);
      close();
    } catch {
      // Error surfaces inline below via the mutations' own `error` state
      // (e.g. 403 when the signed-in user lacks employee_compensation.edit)
      // -- the employee itself is already created, so "Finish without
      // saving compensation" below still lets the user complete.
    }
  };

  const personalValid =
    personal.first_name.trim() && personal.last_name.trim() && (!personal.email.trim() || EMAIL_RE.test(personal.email.trim()));
  const employmentValid = employment.joining_date && employment.branch_id;
  const compensationError = saveCompensation.error instanceof ApiError ? saveCompensation.error : null;
  const salaryError = saveSalary.error instanceof ApiError ? saveSalary.error : null;

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Add employee</DrawerTitle>
          <p className="text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length} &middot; {STEPS[step]}
          </p>
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First name *</Label>
                  <Input value={personal.first_name} onChange={(e) => setPersonal((f) => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Last name *</Label>
                  <Input value={personal.last_name} onChange={(e) => setPersonal((f) => ({ ...f, last_name: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={personal.email} onChange={(e) => setPersonal((f) => ({ ...f, email: e.target.value }))} />
                {personal.email.trim() && !EMAIL_RE.test(personal.email.trim()) && (
                  <p className="text-xs text-destructive">Enter a valid email address.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={personal.phone} onChange={(e) => setPersonal((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date of birth</Label>
                  <Input type="date" value={personal.date_of_birth} onChange={(e) => setPersonal((f) => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={personal.gender}
                    onChange={(e) => setPersonal((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">Not specified</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Joining date *</Label>
                <Input type="date" value={employment.joining_date} onChange={(e) => setEmployment((f) => ({ ...f, joining_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Branch *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={employment.branch_id}
                  onChange={(e) => setEmployment((f) => ({ ...f, branch_id: e.target.value }))}
                >
                  <option value="">Select branch...</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Department</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={employment.department_id}
                    onChange={(e) => setEmployment((f) => ({ ...f, department_id: e.target.value }))}
                  >
                    <option value="">None</option>
                    {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Designation</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={employment.designation_id}
                    onChange={(e) => setEmployment((f) => ({ ...f, designation_id: e.target.value }))}
                  >
                    <option value="">None</option>
                    {designations?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Employment type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={employment.employment_type}
                  onChange={(e) => setEmployment((f) => ({ ...f, employment_type: e.target.value }))}
                >
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="temporary">Temporary</option>
                  <option value="intern">Intern</option>
                  <option value="apprentice">Apprentice</option>
                  <option value="consultant">Consultant</option>
                  <option value="daily_wage">Daily wage</option>
                  <option value="hourly">Hourly</option>
                  <option value="commission_based">Commission based</option>
                  <option value="freelancer">Freelancer</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Manager / supervisor</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={employment.reporting_manager_id}
                  onChange={(e) => setEmployment((f) => ({ ...f, reporting_manager_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {employees?.map((e) => <option key={e.id} value={e.id}>{employeeName(e)}</option>)}
                </select>
              </div>
              {createEmployee.error instanceof ApiError && (
                <p className="text-xs text-destructive">{createEmployee.error.message}</p>
              )}
            </div>
          )}

          {step === 2 && createdEmployee && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {employeeName(createdEmployee)} ({createdEmployee.employee_code}) was created. Bank and salary details are optional
                and can also be added later from their profile.
              </p>
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Banking</p>
                <div className="space-y-1">
                  <Label>Bank name</Label>
                  <Input value={compensation.bank_name} onChange={(e) => setCompensation((f) => ({ ...f, bank_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Account number</Label>
                    <Input value={compensation.bank_account_number} onChange={(e) => setCompensation((f) => ({ ...f, bank_account_number: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>IFSC code</Label>
                    <Input value={compensation.bank_ifsc} onChange={(e) => setCompensation((f) => ({ ...f, bank_ifsc: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>PAN</Label>
                  <Input value={compensation.pan_number} onChange={(e) => setCompensation((f) => ({ ...f, pan_number: e.target.value }))} />
                </div>
              </div>
              {compensationError && (
                <p className="text-xs text-destructive">
                  {compensationError.status === 403 ? "You don't have permission to set compensation details." : compensationError.message}
                </p>
              )}
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Base salary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Effective date</Label>
                    <Input type="date" value={salary.effective_date} onChange={(e) => setSalary((f) => ({ ...f, effective_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Annual CTC</Label>
                    <Input value={salary.annual_ctc} onChange={(e) => setSalary((f) => ({ ...f, annual_ctc: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Monthly gross</Label>
                    <Input value={salary.monthly_gross} onChange={(e) => setSalary((f) => ({ ...f, monthly_gross: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Basic</Label>
                    <Input value={salary.basic} onChange={(e) => setSalary((f) => ({ ...f, basic: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Paid monthly. Other pay frequencies aren&apos;t supported yet.</p>
              </div>
              {salaryError && (
                <p className="text-xs text-destructive">
                  {salaryError.status === 403 ? "You don't have permission to set salary details." : salaryError.message}
                </p>
              )}
            </div>
          )}
        </DrawerBody>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={step === 0 ? close : () => setStep((s) => s - 1)} disabled={step === 2}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step === 0 && (
            <Button onClick={() => setStep(1)} disabled={!personalValid}>Next</Button>
          )}
          {step === 1 && (
            <Button onClick={() => createEmployee.mutate()} disabled={!employmentValid || createEmployee.isPending}>
              {createEmployee.isPending ? "Creating..." : "Create employee"}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={finish} disabled={saveCompensation.isPending || saveSalary.isPending}>
              {saveCompensation.isPending || saveSalary.isPending ? "Saving..." : "Finish"}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
