import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";

export default function NewEmployeePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add employee" description="Create an employee record for equipment assignments." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <EmployeeForm />
      </div>
    </div>
  );
}
