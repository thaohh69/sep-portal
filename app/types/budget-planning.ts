// types/budget-planning.ts
// TypeScript types for Budget Planning features

export type UserRole = 
  | 'production_manager' 
  | 'service_manager' 
  | 'financial_manager' 
  | 'hr_team' 
  | 'admin';

export type BudgetAdjustmentStatus = 
  | 'pending' 
  | 'under_review' 
  | 'approved' 
  | 'rejected' 
  | 'needs_staffing';

export type NegotiationStatus = 
  | 'pending_client' 
  | 'client_reviewing' 
  | 'accepted' 
  | 'rejected' 
  | 'counter_offer';

export type StaffingRequestStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'resolved' 
  | 'cancelled';

export type UrgencyLevel = 
  | 'low' 
  | 'medium' 
  | 'high' 
  | 'critical';

export interface ResourceRequirement {
  type: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  description: string;
}

export interface BudgetAdjustment {
  id: string;
  event_request_id: string;
  submitted_by: string;
  submitted_by_role: UserRole;
  resource_requirements: ResourceRequirement[];
  estimated_cost: number;
  justification: string;
  status: BudgetAdjustmentStatus;
  created_at: string;
  updated_at: string;
}

export interface AlternativeBudgetOption {
  description: string;
  amount: number;
  trade_offs: string[];
  recommendations: string[];
}

export interface BudgetNegotiationRound {
  id: string;
  budget_adjustment_id: string;
  round_number: number;
  proposed_amount: number;
  alternative_options?: AlternativeBudgetOption[];
  client_response?: string;
  financial_manager_notes?: string;
  status: NegotiationStatus;
  created_at: string;
  updated_at: string;
}

export interface RequiredPosition {
  role: string;
  count: number;
  skills_required: string[];
  duration: string;
  is_specialized: boolean;
}

export interface StaffingRequest {
  id: string;
  budget_adjustment_id?: string;
  event_request_id: string;
  submitted_by: string;
  submitted_by_role: UserRole;
  required_positions: RequiredPosition[];
  conflict_details: string;
  urgency_level: UrgencyLevel;
  status: StaffingRequestStatus;
  hr_notes?: string;
  resolution_details?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface EventRequestStatusHistory {
  id: string;
  event_request_id: string;
  previous_status?: string;
  new_status: string;
  changed_by: string;
  change_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// API Request/Response types
export interface CreateBudgetAdjustmentRequest {
  event_request_id: string;
  resource_requirements: ResourceRequirement[];
  justification: string;
}

export interface CreateNegotiationRoundRequest {
  budget_adjustment_id: string;
  proposed_amount: number;
  alternative_options?: AlternativeBudgetOption[];
  financial_manager_notes?: string;
}

export interface UpdateNegotiationRoundRequest {
  client_response?: string;
  status: NegotiationStatus;
}

export interface CreateStaffingRequestRequest {
  budget_adjustment_id?: string;
  event_request_id: string;
  required_positions: RequiredPosition[];
  conflict_details: string;
  urgency_level: UrgencyLevel;
}

export interface UpdateStaffingRequestRequest {
  status: StaffingRequestStatus;
  hr_notes?: string;
  resolution_details?: string;
}

export interface UpdateEventStatusRequest {
  event_request_id: string;
  new_status: string;
  change_reason?: string;
  metadata?: Record<string, any>;
}

// View models with joined data
export interface BudgetAdjustmentWithNegotiations extends BudgetAdjustment {
  negotiation_rounds: BudgetNegotiationRound[];
  staffing_requests: StaffingRequest[];
  submitter_name?: string;
}

export interface StaffingRequestWithDetails extends StaffingRequest {
  submitter_name?: string;
  event_name?: string;
}

// Dashboard/Summary types
export interface BudgetPlanningDashboard {
  pending_adjustments: number;
  active_negotiations: number;
  pending_staffing_requests: number;
  resolved_this_month: number;
  rejected_budget_count: number;
}

export interface NegotiationMetrics {
  total_rounds: number;
  avg_rounds_to_close: number;
  success_rate: number;
  avg_negotiation_duration_days: number;
}