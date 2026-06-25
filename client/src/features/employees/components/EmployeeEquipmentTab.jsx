import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeApi } from "../../../api/employeeApi";
import { consumableApi } from "../../../api/consumableApi";
import { assignmentApi } from "../../../api/assignmentApi";
import { assetApi } from "../../../api/assetApi";
import { categoryApi } from "../../../api/categoryApi";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Input from "../../../components/ui/Input";
import Textarea from "../../../components/ui/Textarea";
import Badge from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Loader";
import { formatDate, getDaysActive } from "../../../utils/formatters";
import { useToast } from "../../../store/ToastContext";

const SubRow = ({ label, value }) => (
  <div className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 w-32 shrink-0">{label}</span>
    <span className="text-xs text-slate-800 font-medium break-all">
      {value === "" || value === null || value === undefined ? "—" : value}
    </span>
  </div>
);

const Chevron = ({ open }) => (
  <svg
    className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
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
);

const formatCustomValue = (value, meta) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (meta?.field_type === "boolean") return value ? "Yes" : "No";
  return String(value ?? "—");
};

const labelFor = (key, meta) =>
  meta?.field_label ||
  key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

// ─── Asset Row ─────────────────────────────────────────────────
const AssetAssignmentRow = ({ assignment, expanded, onToggle, onReturn }) => {
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["asset", assignment.asset_id],
    queryFn: () =>
      assetApi.getById(assignment.asset_id).then((r) => r.data.data),
    enabled: expanded && !!assignment.asset_id,
  });
  const { data: categoryFields } = useQuery({
    queryKey: ["category-fields", detail?.category_id],
    queryFn: () =>
      categoryApi.getFields(detail.category_id).then((r) => r.data.data),
    enabled: expanded && !!detail?.category_id,
  });

  const customFields = detail?.custom_fields || {};
  const fieldMeta = categoryFields || [];
  const metaByName = Object.fromEntries(
    fieldMeta.map((f) => [f.field_name, f])
  );
  const orderedKeys = [
    ...fieldMeta.map((f) => f.field_name).filter((k) => k in customFields),
    ...Object.keys(customFields).filter((k) => !(k in metaByName)),
  ];
  const customRows = orderedKeys
    .map((key) => ({ key, value: customFields[key], meta: metaByName[key] }))
    .filter(
      ({ value }) => value !== "" && value !== null && value !== undefined
    );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
      >
        <Chevron open={expanded} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {assignment.product_name ||
              assignment.category_name ||
              "Unnamed Asset"}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {[
              assignment.category_name,
              assignment.serial_number,
              `${getDaysActive(assignment.assigned_at)}d`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onReturn(assignment);
          }}
        >
          Return
        </Button>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-slate-50/60 border-t border-slate-100">
          <SubRow label="Product Name" value={assignment.product_name} />
          <SubRow label="Category" value={assignment.category_name} />
          <SubRow label="Model" value={assignment.model || detail?.model} />
          <SubRow
            label="Serial Number"
            value={
              assignment.serial_number ? (
                <span className="font-mono">{assignment.serial_number}</span>
              ) : null
            }
          />
          <SubRow
            label="Asset Number"
            value={
              assignment.asset_number ? (
                <span className="font-mono">{assignment.asset_number}</span>
              ) : null
            }
          />
          <SubRow
            label="Assigned On"
            value={formatDate(assignment.assigned_at)}
          />
          <SubRow
            label="Days Active"
            value={`${getDaysActive(assignment.assigned_at)} days`}
          />
          {detail && (
            <>
              <SubRow
                label="Purchase Date"
                value={formatDate(detail.purchase_date)}
              />
              <SubRow
                label="Warranty Expiry"
                value={formatDate(detail.warranty_expiry)}
              />
            </>
          )}
          {assignment.remarks && (
            <SubRow label="Assignment Remarks" value={assignment.remarks} />
          )}

          {detailLoading && (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          )}

          {customRows.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-3 mb-1">
                {detail?.category_name
                  ? `${detail.category_name} Fields`
                  : "Additional Fields"}
              </p>
              {customRows.map(({ key, value, meta }) => (
                <SubRow
                  key={key}
                  label={labelFor(key, meta)}
                  value={formatCustomValue(value, meta)}
                />
              ))}
            </>
          )}

          {detail?.remarks && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Asset Remarks
              </p>
              <p className="text-xs text-slate-700 bg-white rounded-md px-2 py-1.5 border border-slate-100">
                {detail.remarks}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Consumable Row ────────────────────────────────────────────
const ConsumableAssignmentRow = ({
  assignment,
  expanded,
  onToggle,
  onReturn,
}) => {
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["consumable", assignment.consumable_id],
    queryFn: () =>
      consumableApi.getById(assignment.consumable_id).then((r) => r.data.data),
    enabled: expanded && !!assignment.consumable_id,
  });

  const unit = assignment.consumable_unit || detail?.unit || "units";

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
      >
        <Chevron open={expanded} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {assignment.consumable_name}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {[
              `${assignment.quantity} ${unit}`,
              assignment.consumable_category,
              `${getDaysActive(assignment.assigned_at)}d`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {assignment.is_returnable && (
          <Button
            variant="secondary"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onReturn(assignment);
            }}
          >
            Return
          </Button>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-slate-50/60 border-t border-slate-100">
          <SubRow label="Item Name" value={assignment.consumable_name} />
          <SubRow
            label="Category"
            value={assignment.consumable_category || detail?.category}
          />
          <SubRow label="Unit" value={unit} />
          <SubRow
            label="Quantity Issued"
            value={`${assignment.quantity} ${unit}`}
          />
          <SubRow
            label="Type"
            value={
              assignment.is_returnable ? "Returnable" : "Consumed on issue"
            }
          />
          <SubRow
            label="Issued On"
            value={formatDate(assignment.assigned_at)}
          />
          <SubRow
            label="Days Active"
            value={`${getDaysActive(assignment.assigned_at)} days`}
          />
          {assignment.remarks && (
            <SubRow label="Issue Remarks" value={assignment.remarks} />
          )}

          {detailLoading && (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          )}

          {detail?.remarks && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Item Remarks
              </p>
              <p className="text-xs text-slate-700 bg-white rounded-md px-2 py-1.5 border border-slate-100">
                {detail.remarks}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Asset Return Modal ────────────────────────────────────────
const AssetReturnModal = ({ isOpen, onClose, assignment, onSuccess }) => {
  const toast = useToast();
  const [condition, setCondition] = useState("good");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCondition("good");
    setRemarks("");
  };
  const close = () => {
    reset();
    onClose();
  };

  const handleReturn = async () => {
    setSubmitting(true);
    try {
      await assignmentApi.return(assignment.id, {
        condition,
        remarks: remarks || undefined,
      });
      toast.success(
        condition === "damaged"
          ? "Asset returned — marked as damaged"
          : "Asset returned successfully"
      );
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Return failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!assignment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Return Asset"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={condition === "damaged" ? "danger" : "success"}
            onClick={handleReturn}
            loading={submitting}
          >
            Confirm Return
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-500 text-xs mb-1">Returning</p>
          <p className="font-medium text-slate-800">
            {assignment.product_name || assignment.category_name}
            {assignment.serial_number ? ` — ${assignment.serial_number}` : ""}
          </p>
          <p className="text-slate-500">From: {assignment.employee_name}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            Return Condition <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {[
              {
                value: "good",
                label: "✅ Good Condition",
                desc: "Asset is functional and undamaged",
              },
              {
                value: "damaged",
                label: "⚠️ Damaged",
                desc: "Asset will be marked as damaged",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={[
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  condition === opt.value
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  value={opt.value}
                  checked={condition === opt.value}
                  onChange={() => setCondition(opt.value)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Textarea
          label="Remarks"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Any notes about the return..."
        />
      </div>
    </Modal>
  );
};

// ─── Consumable Return Modal ───────────────────────────────────
const ConsumableReturnModal = ({ isOpen, onClose, assignment, onSuccess }) => {
  const toast = useToast();
  const [returnedQty, setReturnedQty] = useState(0);
  const [condition, setCondition] = useState("good");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReturnedQty(0);
    setCondition("good");
    setRemarks("");
  };
  const close = () => {
    reset();
    onClose();
  };

  const handleReturn = async () => {
    if (Number(returnedQty) > Number(assignment.quantity)) {
      return toast.error(
        `Cannot return more than ${assignment.quantity} ${assignment.consumable_unit || "units"}`
      );
    }
    setSubmitting(true);
    try {
      await consumableApi.returnIssue(assignment.id, {
        returned_quantity: Number(returnedQty),
        condition,
        remarks: remarks || undefined,
      });
      toast.success(
        condition === "damaged"
          ? "Return recorded — units marked as damaged"
          : "Return recorded successfully"
      );
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Return failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!assignment) return null;
  const unit = assignment.consumable_unit || "units";

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Process Return"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={condition === "damaged" ? "danger" : "success"}
            onClick={handleReturn}
            loading={submitting}
          >
            Confirm Return
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-slate-500 text-xs mb-1">Returning</p>
          <p className="font-medium text-slate-800">
            {assignment.consumable_name}
          </p>
          <p className="text-slate-500">
            From: {assignment.employee_name}
            {assignment.employee_code ? ` (${assignment.employee_code})` : ""}
          </p>
          <p className="text-slate-500">
            Issued: {assignment.quantity} {unit}
          </p>
        </div>

        <Input
          label={`Quantity returned (max ${assignment.quantity})`}
          type="number"
          min={0}
          max={assignment.quantity}
          value={returnedQty}
          onChange={(e) => setReturnedQty(e.target.value)}
        />

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            Return Condition <span className="text-red-500">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {[
              {
                value: "good",
                label: "✅ Good Condition",
                desc: "Returned units go back into available stock",
              },
              {
                value: "damaged",
                label: "⚠️ Damaged",
                desc: "Returned units will be marked as damaged",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={[
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  condition === opt.value
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  value={opt.value}
                  checked={condition === opt.value}
                  onChange={() => setCondition(opt.value)}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Textarea
          label="Remarks"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Any notes..."
        />
      </div>
    </Modal>
  );
};

// ─── Section Header ────────────────────────────────────────────
const SectionHeader = ({ title, count }) => (
  <div className="flex items-center gap-2 mb-2">
    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
      {title}
    </h4>
    {count > 0 && (
      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold ring-1 ring-indigo-100">
        {count}
      </span>
    )}
  </div>
);

// ─── Main Tab ──────────────────────────────────────────────────
const EmployeeEquipmentTab = ({ employee }) => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [assetReturn, setAssetReturn] = useState(null);
  const [consumableReturn, setConsumableReturn] = useState(null);

  const { data: assetAssignments, isLoading: assetsLoading } = useQuery({
    queryKey: ["employee-assignments", employee?.id],
    queryFn: () =>
      employeeApi.getAssignments(employee.id).then((r) => r.data.data),
    enabled: !!employee?.id,
  });

  const { data: consumableData, isLoading: consumablesLoading } = useQuery({
    queryKey: ["employee-consumable-assignments", employee?.id, "all"],
    queryFn: () =>
      consumableApi
        .getAssignments({ employee_id: employee.id, limit: 100 })
        .then((r) => r.data.data),
    enabled: !!employee?.id,
  });

  const assets = assetAssignments || [];
  const returnableConsumables = (consumableData || []).filter(
    (a) => a.is_returnable && a.is_active
  );
  const consumedConsumables = (consumableData || []).filter(
    (a) => !a.is_returnable
  );

  const onReturnSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["employee-assignments", employee.id],
    });
    queryClient.invalidateQueries({
      queryKey: ["employee-consumable-assignments", employee.id, "all"],
    });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["assignments-active"] });
    queryClient.invalidateQueries({ queryKey: ["assignments-history"] });
    queryClient.invalidateQueries({ queryKey: ["assets"] });
    queryClient.invalidateQueries({ queryKey: ["asset"] });
    queryClient.invalidateQueries({ queryKey: ["consumables"] });
    queryClient.invalidateQueries({
      queryKey: ["consumable-issuances-active"],
    });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const toggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const isLoading = assetsLoading || consumablesLoading;
  const isEmpty =
    !isLoading &&
    assets.length === 0 &&
    returnableConsumables.length === 0 &&
    consumedConsumables.length === 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title="No equipment assigned"
        message="This employee has no assets assigned and no bulk inventory issued."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Assigned Assets */}
      {assets.length > 0 && (
        <div>
          <SectionHeader title="Assigned Assets" count={assets.length} />
          <div className="flex flex-col gap-2">
            {assets.map((a) => (
              <AssetAssignmentRow
                key={`asset-${a.id}`}
                assignment={a}
                expanded={expandedId === `asset-${a.id}`}
                onToggle={() => toggle(`asset-${a.id}`)}
                onReturn={setAssetReturn}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk Inventory (Returnable) */}
      {returnableConsumables.length > 0 && (
        <div>
          <SectionHeader
            title="Bulk Inventory · Returnable"
            count={returnableConsumables.length}
          />
          <div className="flex flex-col gap-2">
            {returnableConsumables.map((a) => (
              <ConsumableAssignmentRow
                key={`cons-${a.id}`}
                assignment={a}
                expanded={expandedId === `cons-${a.id}`}
                onToggle={() => toggle(`cons-${a.id}`)}
                onReturn={setConsumableReturn}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk Inventory (Consumed on issue) */}
      {consumedConsumables.length > 0 && (
        <div>
          <SectionHeader
            title="Bulk Inventory · Consumed on issue"
            count={consumedConsumables.length}
          />
          <div className="flex flex-col gap-2">
            {consumedConsumables.map((a) => (
              <ConsumableAssignmentRow
                key={`consumed-${a.id}`}
                assignment={a}
                expanded={expandedId === `consumed-${a.id}`}
                onToggle={() => toggle(`consumed-${a.id}`)}
                onReturn={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      <AssetReturnModal
        isOpen={!!assetReturn}
        onClose={() => setAssetReturn(null)}
        assignment={assetReturn}
        onSuccess={onReturnSuccess}
      />

      <ConsumableReturnModal
        isOpen={!!consumableReturn}
        onClose={() => setConsumableReturn(null)}
        assignment={consumableReturn}
        onSuccess={onReturnSuccess}
      />
    </div>
  );
};

export default EmployeeEquipmentTab;
