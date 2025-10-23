"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  DEPARTMENT_OPTIONS,
  MENU_OPTIONS,
  ROLE_OPTIONS,
  type DepartmentKey,
  type MenuKey,
  type RoleKey,
  findDepartmentLabel,
  findMenuLabel,
  findRoleLabel,
} from "@/lib/app-config";

type StaffRecord = {
  id: string;
  email: string;
  username: string;
  phone: string | null;
  department: DepartmentKey;
  role: RoleKey;
  permissions: MenuKey[];
};

type FormState = {
  email: string;
  username: string;
  password: string;
  phone: string;
  department: DepartmentKey;
  role: RoleKey;
  permissions: MenuKey[];
};

type AlertState =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | null;

const STAFF_ENDPOINT = "/api/staff";

const defaultFormState: FormState = {
  email: "",
  username: "",
  password: "",
  phone: "",
  department: "CUSTOMER_SERVICE",
  role: "CUSTOMER_SERVICE",
  permissions: ["home", "event-flow", "client-management"],
};

function ensurePermissions(input: MenuKey[]): MenuKey[] {
  const unique = new Set<MenuKey>(["home"]);
  input.forEach((permission) => {
    if (permission) {
      unique.add(permission);
    }
  });
  return Array.from(unique);
}

export function StaffManagementPanel() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedStaff = useMemo(
    () =>
      [...staff].sort((a, b) =>
        a.username.localeCompare(b.username, "en", { sensitivity: "base" }),
      ),
    [staff],
  );

  useEffect(() => {
    if (profile?.role === "HR") {
      void fetchStaff();
    } else {
      setStaff([]);
    }
  }, [profile]);

  const fetchStaff = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      const response = await fetch(STAFF_ENDPOINT, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load staff directory.");
      }
      const items: StaffRecord[] = (payload.staff ?? []).map(
        (row: StaffRecord) => ({
          ...row,
          permissions: ensurePermissions(row.permissions ?? []),
        }),
      );
      setStaff(items);
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to load staff directory.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingUserId(null);
  };

  const handleChange = (
    field: keyof FormState,
    value: string | MenuKey[] | undefined,
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePermissionToggle = (permission: MenuKey) => {
    if (permission === "home") {
      return;
    }

    setFormState((prev) => {
      const exists = prev.permissions.includes(permission);
      const nextPermissions = exists
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission];
      return {
        ...prev,
        permissions: ensurePermissions(nextPermissions),
      };
    });
  };

  const handleEdit = (record: StaffRecord) => {
    setEditingUserId(record.id);
    setFormState({
      email: record.email,
      username: record.username,
      password: "",
      phone: record.phone ?? "",
      department: record.department,
      role: record.role,
      permissions: ensurePermissions(record.permissions),
    });
    setAlert({
      type: "success",
      text: `Editing ${record.username}. Save your changes to update the account.`,
    });
  };

  const handleDelete = async (id: string) => {
    const target = staff.find((item) => item.id === id);
    if (!target) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${target.username}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setAlert(null);

    try {
      const response = await fetch(`${STAFF_ENDPOINT}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to remove user.");
      }

      setAlert({ type: "success", text: "User removed successfully." });
      await fetchStaff();
      if (editingUserId === id) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to delete the selected user.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAlert(null);

    if (
      !formState.email.trim() ||
      !formState.username.trim() ||
      !formState.department ||
      !formState.role
    ) {
      setAlert({
        type: "error",
        text: "Email, username, department, and role are required.",
      });
      return;
    }

    if (!editingUserId && !formState.password.trim()) {
      setAlert({
        type: "error",
        text: "A password is required when creating a new user.",
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      email: formState.email.trim(),
      username: formState.username.trim(),
      password: formState.password.trim(),
      phone: formState.phone.trim() || null,
      department: formState.department,
      role: formState.role,
      permissions: ensurePermissions(formState.permissions),
    };

    try {
      const endpoint = editingUserId
        ? `${STAFF_ENDPOINT}/${editingUserId}`
        : STAFF_ENDPOINT;
      const method = editingUserId ? "PUT" : "POST";

      const body = {
        email: payload.email,
        username: payload.username,
        phone: payload.phone,
        department: payload.department,
        role: payload.role,
        permissions: payload.permissions,
        ...(editingUserId
          ? payload.password
            ? { password: payload.password }
            : {}
          : { password: payload.password }),
      };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the user.");
      }

      setAlert({
        type: "success",
        text: editingUserId
          ? "User details updated."
          : "New user created successfully.",
      });

      await fetchStaff();
      resetForm();
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to save the user. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-base font-semibold text-slate-800">
              Staff directory
            </h3>
            <p className="text-xs text-slate-500">
              HR can review every account registered in the system and keep
              details aligned with reality.
            </p>
          </div>
          <div className="max-h-[460px] overflow-auto">
            {isLoading ? (
              <div className="p-6 text-sm text-slate-500">
                Loading staff directory...
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-medium">
                      Username
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">
                      Department
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-medium">
                      Permissions
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                  {sortedStaff.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No users yet. Use the form on the right to create the
                        first account.
                      </td>
                    </tr>
                  ) : (
                    sortedStaff.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 font-medium">
                          {record.username}
                        </td>
                        <td className="px-4 py-3">{record.email}</td>
                        <td className="px-4 py-3">
                          {findDepartmentLabel(record.department)}
                        </td>
                        <td className="px-4 py-3">
                          {findRoleLabel(record.role)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {record.permissions
                            .map((permission) => findMenuLabel(permission))
                            .join(", ")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(record)}
                              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              disabled={isSubmitting}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(record.id)}
                              className="rounded-md border border-rose-300 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                              disabled={isSubmitting}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-base font-semibold text-slate-800">
              {editingUserId ? "Edit user" : "Create new user"}
            </h3>
            <p className="text-xs text-slate-500">
              Capture the basics and configure the department, role, and allowed
              modules.
            </p>
          </div>
          <form className="space-y-4 px-5 py-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Email"
                type="email"
                value={formState.email}
                onChange={(value) => handleChange("email", value)}
                required
              />
              <InputField
                label="Username"
                value={formState.username}
                onChange={(value) => handleChange("username", value)}
                required
              />
              <InputField
                label={editingUserId ? "Reset password" : "Password"}
                type="password"
                value={formState.password}
                onChange={(value) => handleChange("password", value)}
                required={!editingUserId}
                placeholder={
                  editingUserId ? "Leave blank to keep current password" : ""
                }
              />
              <InputField
                label="Mobile number"
                value={formState.phone}
                onChange={(value) => handleChange("phone", value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Department"
                value={formState.department}
                options={DEPARTMENT_OPTIONS}
                onChange={(value) =>
                  handleChange("department", value as DepartmentKey)
                }
              />
              <SelectField
                label="Role"
                value={formState.role}
                options={ROLE_OPTIONS}
                onChange={(value) => handleChange("role", value as RoleKey)}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Menu permissions
              </span>
              <p className="text-xs text-slate-500">
                Select the modules this user can open. Access to Home is always
                included.
              </p>
              <div className="flex flex-wrap gap-3">
                {MENU_OPTIONS.map((menu) => (
                  <label
                    key={menu.value}
                    className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={formState.permissions.includes(menu.value)}
                      disabled={menu.value === "home"}
                      onChange={() => handlePermissionToggle(menu.value)}
                    />
                    {menu.label}
                  </label>
                ))}
              </div>
            </div>
            {alert && (
              <div
                className={`rounded-md px-4 py-3 text-sm ${
                  alert.type === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {alert.text}
              </div>
            )}
            <div className="flex justify-end gap-3">
              {editingUserId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Saving..."
                  : editingUserId
                  ? "Save changes"
                  : "Create user"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
};

function InputField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: InputFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

type SelectFieldProps<T extends string> = {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: string) => void;
};

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
