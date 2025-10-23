export type MenuKey =
  | "home"
  | "event-flow"
  | "task-distribution"
  | "client-management"
  | "staff-management"
  | "recruitment"
  | "financial-management";

export type RoleKey =
  | "CUSTOMER_SERVICE"
  | "SENIOR_CUSTOMER_SERVICE"
  | "FINANCIAL_MANAGER"
  | "ADMINISTRATION_MANAGER"
  | "PRODUCTION_MANAGER"
  | "SERVICE_MANAGER"
  | "HR";

export type DepartmentKey =
  | "CUSTOMER_SERVICE"
  | "FINANCE"
  | "ADMINISTRATION"
  | "PRODUCTION"
  | "SERVICE"
  | "HR";

type Option<T> = {
  value: T;
  label: string;
};

export const MENU_OPTIONS: Option<MenuKey>[] = [
  { value: "home", label: "Home" },
  { value: "client-management", label: "Client Management" },
  { value: "event-flow", label: "Event Request Management" },
  { value: "task-distribution", label: "Task Distribution Management" },
  { value: "staff-management", label: "Staff Management" },
  { value: "recruitment", label: "Recruitment & Outsourcing" },
  { value: "financial-management", label: "Financial Management" },
];

export const ROLE_OPTIONS: Option<RoleKey>[] = [
  { value: "CUSTOMER_SERVICE", label: "Customer Service Specialist" },
  { value: "SENIOR_CUSTOMER_SERVICE", label: "Senior Customer Service Specialist" },
  { value: "FINANCIAL_MANAGER", label: "Financial Manager" },
  { value: "ADMINISTRATION_MANAGER", label: "Administration Manager" },
  { value: "PRODUCTION_MANAGER", label: "Production Manager" },
  { value: "SERVICE_MANAGER", label: "Service Manager" },
  { value: "HR", label: "Human Resources" },
];

export const DEPARTMENT_OPTIONS: Option<DepartmentKey>[] = [
  { value: "CUSTOMER_SERVICE", label: "Customer Service Department" },
  { value: "FINANCE", label: "Finance Department" },
  { value: "ADMINISTRATION", label: "Administration Department" },
  { value: "PRODUCTION", label: "Production Department" },
  { value: "SERVICE", label: "Service Department" },
  { value: "HR", label: "Human Resources Department" },
];

export function findMenuLabel(value: MenuKey) {
  return MENU_OPTIONS.find((menu) => menu.value === value)?.label ?? value;
}

export function findRoleLabel(value: RoleKey) {
  return ROLE_OPTIONS.find((role) => role.value === value)?.label ?? value;
}

export function findDepartmentLabel(value: DepartmentKey) {
  return (
    DEPARTMENT_OPTIONS.find((department) => department.value === value)?.label ??
    value
  );
}
