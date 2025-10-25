// financial-management-panel.tsx
// Main Financial Management page component

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  BudgetModal, 
  NegotiationModal, 
  StaffingModal, 
  UpdateStaffingModal 
} from '@/components/financial-management-modals';

// Create the client instance
const supabase = createClient();

export default function FinancialManagementPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // State for different data
  const [stats, setStats] = useState({
    pendingBudgets: 0,
    approvedBudgets: 0,
    activeNegotiations: 0,
    pendingStaffing: 0,
    totalBudget: 0
  });
  const [budgets, setBudgets] = useState<any[]>([]);
  const [staffingRequests, setStaffingRequests] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  // Modal states
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [showStaffingModal, setShowStaffingModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [activeTab, currentUser]);

  // Load all data
  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        await loadStats();
      } else if (activeTab === 'budget') {
        await loadBudgets();
        await loadEventsNeedingBudget();
      } else if (activeTab === 'staffing') {
        await loadStaffingRequests();
        await loadEventsNeedingStaff();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  // Load statistics
  const loadStats = async () => {
    const { count: pendingBudgets } = await supabase
      .from('budget_adjustments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    const { count: approvedBudgets } = await supabase
      .from('budget_adjustments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'APPROVED');

    const { count: activeNegotiations } = await supabase
      .from('budget_negotiation_rounds')
      .select('*', { count: 'exact', head: true })
      .in('status', ['PENDING', 'COUNTER_OFFER']);

    const { count: pendingStaffing } = await supabase
      .from('staffing_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['PENDING', 'IN_PROGRESS']);

    const { data: approvedBudgetData } = await supabase
      .from('budget_adjustments')
      .select('estimated_cost')
      .eq('status', 'APPROVED');

    const totalBudget = approvedBudgetData?.reduce((sum, b) => sum + (b.estimated_cost || 0), 0) || 0;

    setStats({
      pendingBudgets: pendingBudgets || 0,
      approvedBudgets: approvedBudgets || 0,
      activeNegotiations: activeNegotiations || 0,
      pendingStaffing: pendingStaffing || 0,
      totalBudget
    });
  };

  // Load budgets
  const loadBudgets = async () => {
    const { data, error } = await supabase
      .from('budget_adjustments_with_details')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error) {
      setBudgets(data || []);
    }
  };

  // Load events that need budgets
  const loadEventsNeedingBudget = async () => {
    // Get all approved events
    const { data: allEvents } = await supabase
      .from('event_request')
      .select(`
        id,
        event_type,
        start_time,
        status,
        client:client_id (name, email)
      `)
      .eq('status', 'APPROVED')
      .order('id', { ascending: false });

    // Get events that already have budgets
    const { data: eventsWithBudgets } = await supabase
      .from('budget_adjustments')
      .select('event_request_id');

    const eventIdsWithBudgets = new Set(eventsWithBudgets?.map(b => b.event_request_id) || []);
    
    // Filter out events that already have budgets
    const eventsNeedingBudgets = allEvents?.filter(e => !eventIdsWithBudgets.has(e.id)) || [];
    
    setEvents(eventsNeedingBudgets);
  };

  // Load staffing requests
  const loadStaffingRequests = async () => {
    const { data, error } = await supabase
      .from('staffing_requests_with_details')
      .select('*')
      .order('urgency_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error) {
      setStaffingRequests(data || []);
    }
  };

  // Load events that need staffing
  const loadEventsNeedingStaff = async () => {
    // Get approved budgets
    const { data: approvedBudgets } = await supabase
      .from('budget_adjustments')
      .select(`
        id,
        event_request_id,
        estimated_cost,
        event:event_request_id (
          id,
          event_type,
          start_time,
          client:client_id (name)
        )
      `)
      .eq('status', 'APPROVED');

    // Get events that already have staffing requests
    const { data: eventsWithStaffing } = await supabase
      .from('staffing_requests')
      .select('event_request_id');

    const eventIdsWithStaffing = new Set(eventsWithStaffing?.map(s => s.event_request_id) || []);
    
    // Filter out events that already have staffing
    const budgetsNeedingStaff = approvedBudgets?.filter(b => !eventIdsWithStaffing.has(b.event_request_id)) || [];
    
    setEvents(budgetsNeedingStaff);
  };

  // Create budget adjustment
  const createBudgetAdjustment = async (formData: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_adjustments')
        .insert({
          event_request_id: parseInt(formData.eventRequestId),
          submitted_by: currentUser.id,
          submitted_by_role: formData.submittedByRole,
          resource_requirements: formData.resourceRequirements,
          estimated_cost: formData.estimatedCost,
          justification: formData.justification,
          status: 'PENDING'
        })
        .select()
        .single();

      if (error) throw error;

      alert('Budget adjustment created successfully!');
      setShowBudgetModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error: any) {
      alert('Error creating budget: ' + error.message);
    }
    setLoading(false);
  };

  // Update budget status
  const updateBudgetStatus = async (budgetId: number, newStatus: string) => {
    if (!confirm(`Are you sure you want to ${newStatus.toLowerCase()} this budget?`)) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('budget_adjustments')
        .update({ status: newStatus })
        .eq('id', budgetId);

      if (error) throw error;

      alert('Budget status updated!');
      loadData();
    } catch (error: any) {
      alert('Error updating budget: ' + error.message);
    }
    setLoading(false);
  };

  // Create negotiation round
  const createNegotiationRound = async (formData: any) => {
    setLoading(true);
    try {
      // Get current round count
      const { data: existingRounds } = await supabase
        .from('budget_negotiation_rounds')
        .select('round_number')
        .eq('budget_adjustment_id', formData.budgetAdjustmentId)
        .order('round_number', { ascending: false })
        .limit(1);

      const nextRoundNumber = (existingRounds?.[0]?.round_number || 0) + 1;

      const { data, error } = await supabase
        .from('budget_negotiation_rounds')
        .insert({
          budget_adjustment_id: formData.budgetAdjustmentId,
          round_number: nextRoundNumber,
          proposed_amount: formData.proposedAmount,
          alternative_options: formData.alternativeOptions,
          financial_manager_notes: formData.notes,
          status: 'PENDING'
        })
        .select()
        .single();

      if (error) throw error;

      alert(`Negotiation round ${nextRoundNumber} created!`);
      setShowNegotiationModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error: any) {
      alert('Error creating negotiation: ' + error.message);
    }
    setLoading(false);
  };

  // Create staffing request
  const createStaffingRequest = async (formData: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('staffing_requests')
        .insert({
          event_request_id: parseInt(formData.eventRequestId),
          budget_adjustment_id: formData.budgetAdjustmentId || null,
          submitted_by: currentUser.id,
          submitted_by_role: formData.submittedByRole,
          required_positions: formData.requiredPositions,
          urgency_level: formData.urgencyLevel,
          conflict_details: formData.conflictDetails,
          status: 'PENDING'
        })
        .select()
        .single();

      if (error) throw error;

      alert('Staffing request created!');
      setShowStaffingModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error: any) {
      alert('Error creating staffing request: ' + error.message);
    }
    setLoading(false);
  };

  // Update staffing status
  const updateStaffingStatus = async (formData: any) => {
    setLoading(true);
    try {
      const updateData: any = {
        status: formData.status,
        hr_notes: formData.hrNotes
      };

      if (formData.status === 'RESOLVED') {
        updateData.resolution_details = formData.resolutionDetails;
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('staffing_requests')
        .update(updateData)
        .eq('id', formData.id);

      if (error) throw error;

      alert('Staffing status updated!');
      setShowUpdateModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error: any) {
      alert('Error updating staffing: ' + error.message);
    }
    setLoading(false);
  };

  // Status badge component
  const StatusBadge = ({ status, type = 'budget' }: { status: string; type?: string }) => {
    const colors: any = {
      budget: {
        PENDING: 'bg-yellow-100 text-yellow-800',
        APPROVED: 'bg-green-100 text-green-800',
        REJECTED: 'bg-red-100 text-red-800',
        UNDER_REVIEW: 'bg-blue-100 text-blue-800'
      },
      staffing: {
        PENDING: 'bg-yellow-100 text-yellow-800',
        IN_PROGRESS: 'bg-blue-100 text-blue-800',
        RESOLVED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-gray-100 text-gray-800'
      },
      urgency: {
        LOW: 'bg-green-100 text-green-800',
        MEDIUM: 'bg-yellow-100 text-yellow-800',
        HIGH: 'bg-orange-100 text-orange-800',
        CRITICAL: 'bg-red-100 text-red-800'
      }
    };

    const colorClass = colors[type]?.[status] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Financial Management</h1>
          <p className="text-gray-600 mt-2">
            Manage budget adjustments, negotiations, and staffing requests for events
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'budget', label: 'Budget Process' },
                { id: 'staffing', label: 'Staffing Process' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading...</p>
              </div>
            )}

            {!loading && (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <OverviewTab 
                    stats={stats} 
                    onShowBudgetModal={() => setShowBudgetModal(true)}
                    onShowStaffingModal={() => setShowStaffingModal(true)}
                    onSwitchTab={setActiveTab}
                  />
                )}

                {/* Budget Process Tab */}
                {activeTab === 'budget' && (
                  <BudgetTab
                    budgets={budgets}
                    events={events}
                    onShowBudgetModal={() => setShowBudgetModal(true)}
                    onCreateBudget={(eventId: any) => {
                      setSelectedItem({ eventRequestId: eventId });
                      setShowBudgetModal(true);
                    }}
                    onUpdateStatus={updateBudgetStatus}
                    onStartNegotiation={(budgetId: any) => {
                      setSelectedItem({ budgetAdjustmentId: budgetId });
                      setShowNegotiationModal(true);
                    }}
                    onRequestStaff={(eventId: any, budgetId: any) => {
                      setSelectedItem({ eventRequestId: eventId, budgetAdjustmentId: budgetId });
                      setShowStaffingModal(true);
                    }}
                    StatusBadge={StatusBadge}
                  />
                )}

                {/* Staffing Process Tab */}
                {activeTab === 'staffing' && (
                  <StaffingTab
                    staffingRequests={staffingRequests}
                    events={events}
                    onShowStaffingModal={() => setShowStaffingModal(true)}
                    onRequestStaff={(eventId: any, budgetId: any) => {
                      setSelectedItem({ eventRequestId: eventId, budgetAdjustmentId: budgetId });
                      setShowStaffingModal(true);
                    }}
                    onUpdateStatus={(request: any) => {
                      setSelectedItem(request);
                      setShowUpdateModal(true);
                    }}
                    StatusBadge={StatusBadge}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showBudgetModal && (
        <BudgetModal
          selectedItem={selectedItem}
          onClose={() => {
            setShowBudgetModal(false);
            setSelectedItem(null);
          }}
          onSubmit={createBudgetAdjustment}
        />
      )}

      {showNegotiationModal && (
        <NegotiationModal
          selectedItem={selectedItem}
          onClose={() => {
            setShowNegotiationModal(false);
            setSelectedItem(null);
          }}
          onSubmit={createNegotiationRound}
        />
      )}

      {showStaffingModal && (
        <StaffingModal
          selectedItem={selectedItem}
          onClose={() => {
            setShowStaffingModal(false);
            setSelectedItem(null);
          }}
          onSubmit={createStaffingRequest}
        />
      )}

      {showUpdateModal && (
        <UpdateStaffingModal
          selectedItem={selectedItem}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedItem(null);
          }}
          onSubmit={updateStaffingStatus}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ stats, onShowBudgetModal, onShowStaffingModal, onSwitchTab }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Financial Overview</h2>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-3xl font-bold text-yellow-900">{stats.pendingBudgets}</div>
          <div className="text-sm text-yellow-700 mt-1">Pending Budgets</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-3xl font-bold text-green-900">{stats.approvedBudgets}</div>
          <div className="text-sm text-green-700 mt-1">Approved Budgets</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-3xl font-bold text-blue-900">{stats.activeNegotiations}</div>
          <div className="text-sm text-blue-700 mt-1">Active Negotiations</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="text-3xl font-bold text-purple-900">{stats.pendingStaffing}</div>
          <div className="text-sm text-purple-700 mt-1">Pending Staffing</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <div className="text-3xl font-bold text-indigo-900">
            ${stats.totalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-sm text-indigo-700 mt-1">Total Budget</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">⚡ Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={onShowBudgetModal}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span className="mr-2">💰</span>
            Submit Budget Adjustment
          </button>
          <button
            onClick={() => onSwitchTab('budget')}
            className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <span className="mr-2">✅</span>
            Review Budgets
          </button>
          <button
            onClick={onShowStaffingModal}
            className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <span className="mr-2">👥</span>
            Request Staff
          </button>
        </div>
      </div>

      {/* Requires Attention */}
      {(stats.pendingBudgets > 0 || stats.activeNegotiations > 0 || stats.pendingStaffing > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">⚠️ Requires Attention</h3>
          <ul className="space-y-2 text-yellow-800">
            {stats.pendingBudgets > 0 && (
              <li>• {stats.pendingBudgets} budget approval{stats.pendingBudgets !== 1 ? 's' : ''} pending</li>
            )}
            {stats.activeNegotiations > 0 && (
              <li>• {stats.activeNegotiations} negotiation{stats.activeNegotiations !== 1 ? 's' : ''} awaiting response</li>
            )}
            {stats.pendingStaffing > 0 && (
              <li>• {stats.pendingStaffing} staffing request{stats.pendingStaffing !== 1 ? 's' : ''} need review</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Budget Tab Component
function BudgetTab({ budgets, events, onShowBudgetModal, onCreateBudget, onUpdateStatus, onStartNegotiation, onRequestStaff, StatusBadge }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Budget Management</h2>
        <button
          onClick={onShowBudgetModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Submit Adjustment
        </button>
      </div>

      {/* Events Needing Budgets */}
      {events.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-yellow-900 mb-2">📋 Events Needing Budgets ({events.length})</h3>
          <div className="space-y-2">
            {events.slice(0, 5).map((event: any) => (
              <div key={event.id} className="flex justify-between items-center bg-white p-3 rounded">
                <div>
                  <span className="font-medium">Event #{event.id}</span>
                  <span className="text-gray-600 ml-2">{event.event_type}</span>
                  <span className="text-gray-500 ml-2">- {event.client?.name}</span>
                </div>
                <button
                  onClick={() => onCreateBudget(event.id)}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  Create Budget →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Adjustments List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Recent Budget Adjustments</h3>
        {budgets.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No budget adjustments found.</p>
        ) : (
          budgets.map((budget: any) => (
            <div key={budget.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Budget #{budget.id}
                    </h3>
                    <StatusBadge status={budget.status} type="budget" />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Event #{budget.event_request_id} - {budget.event_type || 'N/A'}</p>
                    <p>Client: {budget.client_name || 'N/A'}</p>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      ${budget.estimated_cost?.toFixed(2) || '0.00'}
                    </p>
                    {budget.justification && (
                      <p className="text-gray-500 italic text-sm mt-2">{budget.justification}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Submitted: {new Date(budget.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {budget.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => onUpdateStatus(budget.id, 'APPROVED')}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 whitespace-nowrap"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => onUpdateStatus(budget.id, 'REJECTED')}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 whitespace-nowrap"
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onStartNegotiation(budget.id)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 whitespace-nowrap"
                  >
                    🔄 Negotiate
                  </button>
                  {budget.status === 'APPROVED' && (
                    <button
                      onClick={() => onRequestStaff(budget.event_request_id, budget.id)}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 whitespace-nowrap"
                    >
                      👥 Request Staff
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Staffing Tab Component
function StaffingTab({ staffingRequests, events, onShowStaffingModal, onRequestStaff, onUpdateStatus, StatusBadge }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Staffing Management</h2>
        <button
          onClick={onShowStaffingModal}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          + Request Staff
        </button>
      </div>

      {/* Events with Approved Budgets Needing Staff */}
      {events.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-purple-900 mb-2">👥 Approved Budgets Needing Staff ({events.length})</h3>
          <div className="space-y-2">
            {events.slice(0, 5).map((budget: any) => (
              <div key={budget.id} className="flex justify-between items-center bg-white p-3 rounded">
                <div>
                  <span className="font-medium">Event #{budget.event_request_id}</span>
                  <span className="text-gray-600 ml-2">{budget.event?.event_type}</span>
                  <span className="text-gray-500 ml-2">- Budget: ${budget.estimated_cost?.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => onRequestStaff(budget.event_request_id, budget.id)}
                  className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                >
                  Request Staff →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staffing Requests List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Active Staffing Requests</h3>
        {staffingRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No staffing requests found.</p>
        ) : (
          staffingRequests.map((request: any) => (
            <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Staffing #{request.id}
                    </h3>
                    <StatusBadge status={request.status} type="staffing" />
                    <StatusBadge status={request.urgency_level} type="urgency" />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Event #{request.event_request_id} - {request.event_type || 'N/A'}</p>
                    <p>Client: {request.client_name || 'N/A'}</p>
                    {request.required_positions && (
                      <div className="mt-2">
                        <p className="font-medium text-gray-700">Required Positions:</p>
                        <ul className="ml-4 text-gray-600 text-xs">
                          {Object.entries(request.required_positions).map(([role, count]) => (
                            <li key={role}>• {role}: {count as any}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {request.hr_notes && (
                      <p className="text-gray-500 italic text-sm mt-2">HR: {request.hr_notes}</p>
                    )}
                    {request.resolution_details && (
                      <p className="text-green-700 text-sm mt-2">✓ {request.resolution_details}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Created: {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {request.status !== 'RESOLVED' && request.status !== 'CANCELLED' && (
                    <button
                      onClick={() => onUpdateStatus(request)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 whitespace-nowrap"
                    >
                      Update Status
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}