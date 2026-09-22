import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/api";

interface AcademicYear { id: string; name: string; is_current: boolean; }
interface SchoolClass { id: string; academic_year_id: string; branch_id: string; name: string; }
interface Section { id: string; school_class_id: string; name: string; }
interface Student { id: string; admission_number: string; first_name: string; last_name: string; }
interface Branch { id: string; name: string; }

const EMPTY_PERSONAL = {
  branch_id: "", first_name: "", last_name: "", date_of_birth: "", gender: "", blood_group: "", phone: "", email: "",
  admission_date: new Date().toISOString().slice(0, 10), previous_school: "", category: "",
};

/** Two-step admission: Personal info, then an optional Enrolment step
 * (Academic year -> Class -> Section, real cascading selects). Both
 * are honestly optional -- the spec's own "do not require every
 * module to be configured before the school can start using the
 * system" -- so a school with no classes set up yet can still admit a
 * student and enrol them later from the student's own profile page. */
export function StudentDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState(EMPTY_PERSONAL);
  const [enrolment, setEnrolment] = useState({ academic_year_id: "", school_class_id: "", section_id: "", roll_number: "" });
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);

  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => apiFetch<Branch[]>("/branches") });
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: () => apiFetch<AcademicYear[]>("/academic-years") });
  const { data: classes } = useQuery({
    queryKey: ["school-classes", enrolment.academic_year_id, personal.branch_id],
    queryFn: () => apiFetch<SchoolClass[]>(`/school-classes?academic_year_id=${enrolment.academic_year_id}&branch_id=${personal.branch_id}`),
    enabled: !!enrolment.academic_year_id,
  });
  const { data: sections } = useQuery({
    queryKey: ["sections", enrolment.school_class_id],
    queryFn: () => apiFetch<Section[]>(`/sections?school_class_id=${enrolment.school_class_id}`),
    enabled: !!enrolment.school_class_id,
  });

  const reset = () => {
    setStep(0);
    setPersonal(EMPTY_PERSONAL);
    setEnrolment({ academic_year_id: "", school_class_id: "", section_id: "", roll_number: "" });
    setCreatedStudent(null);
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };

  const createStudent = useMutation({
    mutationFn: () =>
      apiFetch<Student>("/students", {
        method: "POST",
        body: {
          ...personal,
          date_of_birth: personal.date_of_birth || null,
          gender: personal.gender || null,
          blood_group: personal.blood_group || null,
          phone: personal.phone.trim() || null,
          email: personal.email.trim() || null,
          previous_school: personal.previous_school.trim() || null,
          category: personal.category.trim() || null,
        },
      }),
    onSuccess: (student) => {
      setCreatedStudent(student);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setStep(1);
    },
  });

  const enrolStudent = useMutation({
    mutationFn: () =>
      apiFetch(`/students/${createdStudent!.id}/enrolments`, {
        method: "POST",
        body: { ...enrolment, section_id: enrolment.section_id || null, roll_number: enrolment.roll_number.trim() || null },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      close();
    },
  });

  const personalValid = personal.branch_id && personal.first_name.trim() && personal.last_name.trim() && personal.admission_date;

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Admit student</DrawerTitle>
          <p className="text-xs text-muted-foreground">Step {step + 1} of 2 &middot; {step === 0 ? "Personal info" : "Enrolment"}</p>
        </DrawerHeader>
        <DrawerBody className="space-y-4">
          {step === 0 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Campus *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={personal.branch_id}
                  onChange={(e) => setPersonal((f) => ({ ...f, branch_id: e.target.value }))}
                >
                  <option value="">Select campus...</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
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
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Date of birth</Label>
                  <Input type="date" value={personal.date_of_birth} onChange={(e) => setPersonal((f) => ({ ...f, date_of_birth: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Gender</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={personal.gender} onChange={(e) => setPersonal((f) => ({ ...f, gender: e.target.value }))}>
                    <option value="">Not specified</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Blood group</Label>
                  <Input value={personal.blood_group} onChange={(e) => setPersonal((f) => ({ ...f, blood_group: e.target.value }))} placeholder="O+" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={personal.phone} onChange={(e) => setPersonal((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={personal.email} onChange={(e) => setPersonal((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Admission date *</Label>
                  <Input type="date" value={personal.admission_date} onChange={(e) => setPersonal((f) => ({ ...f, admission_date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Input value={personal.category} onChange={(e) => setPersonal((f) => ({ ...f, category: e.target.value }))} placeholder="General" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Previous school</Label>
                <Input value={personal.previous_school} onChange={(e) => setPersonal((f) => ({ ...f, previous_school: e.target.value }))} />
              </div>
              {createStudent.error instanceof ApiError && <p className="text-xs text-destructive">{createStudent.error.message}</p>}
            </div>
          )}

          {step === 1 && createdStudent && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {createdStudent.first_name} {createdStudent.last_name} ({createdStudent.admission_number}) was admitted. Enrolment is optional and can also be added later from their profile.
              </p>
              <div className="space-y-1">
                <Label>Academic year</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={enrolment.academic_year_id}
                  onChange={(e) => setEnrolment({ academic_year_id: e.target.value, school_class_id: "", section_id: "", roll_number: "" })}
                >
                  <option value="">Select academic year...</option>
                  {years?.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_current ? " (current)" : ""}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Class</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={enrolment.school_class_id}
                    onChange={(e) => setEnrolment((f) => ({ ...f, school_class_id: e.target.value, section_id: "" }))}
                    disabled={!enrolment.academic_year_id}
                  >
                    <option value="">Select class...</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Section</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={enrolment.section_id}
                    onChange={(e) => setEnrolment((f) => ({ ...f, section_id: e.target.value }))}
                    disabled={!enrolment.school_class_id}
                  >
                    <option value="">Unassigned</option>
                    {sections?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Roll number</Label>
                <Input value={enrolment.roll_number} onChange={(e) => setEnrolment((f) => ({ ...f, roll_number: e.target.value }))} />
              </div>
              {enrolStudent.error instanceof ApiError && <p className="text-xs text-destructive">{enrolStudent.error.message}</p>}
            </div>
          )}
        </DrawerBody>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" onClick={close}>{step === 0 ? "Cancel" : "Skip enrolment"}</Button>
          {step === 0 && (
            <Button onClick={() => createStudent.mutate()} disabled={!personalValid || createStudent.isPending}>
              {createStudent.isPending ? "Admitting..." : "Admit student"}
            </Button>
          )}
          {step === 1 && (
            <Button onClick={() => enrolStudent.mutate()} disabled={!enrolment.academic_year_id || !enrolment.school_class_id || enrolStudent.isPending}>
              {enrolStudent.isPending ? "Enrolling..." : "Enrol student"}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
