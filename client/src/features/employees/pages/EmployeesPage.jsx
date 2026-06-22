import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeApi } from "../../../api/employeeApi";
import PageHeader from "../../../components/ui/PageHeader";
import Button from "../../../components/ui/Button";
import SearchInput from "../../../components/ui/SearchInput";
import Select from "../../../components/ui/Select";
import DataTable from "../../../components/ui/DataTable";
import Badge from "../../../components/ui/Badge";
import Pagination from "../../../components/ui/Pagination";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
import EmployeeForm, { KNOWN_DIVISIONS } from "../components/EmployeeForm";
import EmployeeDetailDrawer from "../components/EmployeeDetailDrawer";
import { useToast } from "../../../store/ToastContext";
import useDisclosure from "../../../hooks/useDisclosure";



const EmployeesPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const addModal = useDisclosure();

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const drawerDisclosure = useDisclosure();

  const [filters, setFilters] = useState({
    search: "",
    division: "",
    is_archived: "",
    page: 1,
    limit: 25,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["employees", filters],
    queryFn: () => employeeApi.getAll(filters).then((r) => r.data),
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: (data) => employeeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      addModal.close();
      toast.success("Employee added successfully");
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to add employee"),
  });

  const handleRowClick = (row) => {
    setSelectedEmployee(row);
    drawerDisclosure.open();
  };

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const columns = [
    {
      key: "employee_code",
      header: "Employee Code",
      width: "140px",
      render: (v) =>
        v ? (
          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            {v}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "name",
      header: "Name",
      render: (v, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold shrink-0">
            {v?.[0]?.toUpperCase() || "E"}
          </div>
          <span className="font-medium text-slate-800">{v}</span>
        </div>
      ),
    },
    { key: "division", header: "Division" },
    { key: "designation", header: "Designation" },
    {
      key: "assigned_count",
      header: "Equipment",
      render: (v) => (
        <span
          className={[
            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold",
            v > 0
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-100 text-slate-400",
          ].join(" ")}
        >
          {v ?? 0}
        </span>
      ),
    },
    {
      key: "is_archived",
      header: "Status",
      render: (v) => <Badge status={v ? "archived" : "active"} />,
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(row);
          }}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      ),
    },
  ];

  const employees = data?.data || [];
  const meta = data?.meta;

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={
          meta ? `${meta.total} total employees` : "Manage your workforce"
        }
        actions={
          <Button
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            }
            onClick={addModal.open}
          >
            Add Employee
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <SearchInput
          value={filters.search}
          onChange={(v) => setFilter("search", v)}
          placeholder="Search by name, code, division..."
          className="w-full sm:w-72"
        />
        <Select
          placeholder="All Divisions"
          value={filters.division}
          onChange={(e) => setFilter("division", e.target.value)}
          options={KNOWN_DIVISIONS.map((d) => ({ value: d, label: d }))}
          className="w-full sm:w-44"
        />
        <Select
          placeholder="All Status"
          value={filters.is_archived}
          onChange={(e) => setFilter("is_archived", e.target.value)}
          options={[
            { value: "false", label: "Active" },
            { value: "true", label: "Archived" },
          ]}
          className="w-full sm:w-36"
        />
        {(filters.search || filters.division || filters.is_archived) && (
          <button
            onClick={() =>
              setFilters({
                search: "",
                division: "",
                is_archived: "",
                page: 1,
                limit: 25,
              })
            }
            className="text-sm text-slate-500 hover:text-slate-700 hover:underline transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {!isLoading && employees.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState
            title="No employees found"
            message={
              filters.search || filters.division || filters.is_archived
                ? "Try adjusting your filters"
                : "Add your first employee to get started"
            }
            action={
              <Button size="sm" onClick={addModal.open}>
                Add Employee
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          isLoading={isLoading}
          onRowClick={handleRowClick}
          emptyMessage="No employees found"
        />
      )}

      {/* Pagination */}
      {meta && meta.total > 0 && (
        <div className="mt-4">
          <Pagination
            meta={meta}
            onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
            onLimitChange={(l) =>
              setFilters((prev) => ({ ...prev, limit: l, page: 1 }))
            }
          />
        </div>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={addModal.isOpen}
        onClose={addModal.close}
        title="Add Employee"
        size="lg"
        footer={
          <>
            <button
              onClick={addModal.close}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              form="employee-add-form"
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {createMutation.isPending ? "Saving..." : "Add Employee"}
            </button>
          </>
        }
      >
        <EmployeeForm
          formId="employee-add-form"
          onSubmit={(data) => createMutation.mutate(data)}
        />
      </Modal>

      {/* Detail Drawer */}
      <EmployeeDetailDrawer
        employee={selectedEmployee}
        isOpen={drawerDisclosure.isOpen}
        onClose={() => {
          drawerDisclosure.close();
          setSelectedEmployee(null);
        }}
        onUpdate={() => {
          if (selectedEmployee) {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
          }
        }}
      />
    </div>
  );
};

export default EmployeesPage;
