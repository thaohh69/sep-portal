// FinancialManagementModals.tsx
// Modal components for Financial Management page

import React, { useState, useEffect } from 'react';
// IMPORT YOUR EXISTING SUPABASE CLIENT
import { createClient } from '@/lib/supabase/client';

// Create the client instance
const supabase = createClient();

// Budget Modal Component
export function BudgetModal({ selectedItem, onClose, onSubmit }: any) {
  const [formData, setFormData] = useState({
    eventRequestId: selectedItem?.eventRequestId || '',
    submittedByRole: 'Financial Manager',
    resourceRequirements: {},
    estimatedCost: 0,
    justification: ''
  });
  const [resources, setResources] = useState([{ item: '', quantity: 1, unitCost: 0 }]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('event_request')
        .select('id, event_type, client:client_id(name)')
        .eq('status', 'APPROVED')
        .order('id', { ascending: false });
      setEvents(data || []);
    };
    loadEvents();
  }, []);

  const addResource = () => {
    setResources([...resources, { item: '', quantity: 1, unitCost: 0 }]);
  };

  const removeResource = (index: number) => {
    const newResources = resources.filter((_, i) => i !== index);
    setResources(newResources);
    updateResourceRequirements(newResources);
  };

  const updateResource = (index: number, field: string, value: any) => {
    const newResources = [...resources];
    (newResources[index] as any)[field] = value;
    setResources(newResources);
    updateResourceRequirements(newResources);
  };

  const updateResourceRequirements = (resourceList: any[]) => {
    const reqs: any = {};
    let total = 0;
    resourceList.forEach(r => {
      if (r.item) {
        const itemTotal = r.quantity * r.unitCost;
        reqs[r.item] = { quantity: r.quantity, unit_cost: r.unitCost, total: itemTotal };
        total += itemTotal;
      }
    });
    setFormData(prev => ({ ...prev, resourceRequirements: reqs, estimatedCost: total }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventRequestId) {
      alert('Please select an event');
      return;
    }
    if (Object.keys(formData.resourceRequirements).length === 0) {
      alert('Please add at least one resource item');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Submit Budget Adjustment</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Event Request *
              </label>
              <select
                value={formData.eventRequestId}
                onChange={(e) => setFormData({ ...formData, eventRequestId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select an event...</option>
                {events.map((event: any) => (
                  <option key={event.id} value={event.id}>
                    Event #{event.id} - {event.event_type} - {event.client?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Role *
              </label>
              <input
                type="text"
                value={formData.submittedByRole}
                onChange={(e) => setFormData({ ...formData, submittedByRole: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resource Requirements *
              </label>
              <div className="space-y-2">
                {resources.map((resource, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Item (e.g., Catering)"
                      value={resource.item}
                      onChange={(e) => updateResource(index, 'item', e.target.value)}
                      className="col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={resource.quantity}
                      onChange={(e) => updateResource(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Unit Cost"
                      value={resource.unitCost}
                      onChange={(e) => updateResource(index, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="col-span-2 px-3 py-2 bg-gray-100 rounded-lg text-sm flex items-center justify-end font-medium">
                      ${(resource.quantity * resource.unitCost).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeResource(index)}
                      className="col-span-1 text-red-600 hover:text-red-800 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addResource}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Item
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Estimated Total Cost
              </label>
              <div className="text-3xl font-bold text-blue-900">
                ${formData.estimatedCost.toFixed(2)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Justification *
              </label>
              <textarea
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Explain why this budget is needed..."
                required
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit Budget Adjustment
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Negotiation Modal Component
export function NegotiationModal({ selectedItem, onClose, onSubmit }: any) {
  const [formData, setFormData] = useState({
    budgetAdjustmentId: selectedItem?.budgetAdjustmentId || '',
    proposedAmount: 0,
    alternativeOptions: {},
    notes: ''
  });
  const [alternatives, setAlternatives] = useState([{ description: '', cost: 0 }]);

  const addAlternative = () => {
    setAlternatives([...alternatives, { description: '', cost: 0 }]);
  };

  const removeAlternative = (index: number) => {
    const newAlts = alternatives.filter((_, i) => i !== index);
    setAlternatives(newAlts);
    updateAlternativeOptions(newAlts);
  };

  const updateAlternative = (index: number, field: string, value: any) => {
    const newAlts = [...alternatives];
    (newAlts[index] as any)[field] = value;
    setAlternatives(newAlts);
    updateAlternativeOptions(newAlts);
  };

  const updateAlternativeOptions = (altList: any[]) => {
    const opts: any = {};
    altList.forEach((alt, i) => {
      if (alt.description) {
        opts[`option_${String.fromCharCode(65 + i)}`] = { description: alt.description, cost: alt.cost };
      }
    });
    setFormData(prev => ({ ...prev, alternativeOptions: opts }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.proposedAmount <= 0) {
      alert('Please enter a valid proposed amount');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Start Negotiation Round</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Proposed Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.proposedAmount}
                  onChange={(e) => setFormData({ ...formData, proposedAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alternative Options (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">Provide different pricing options for the client to consider</p>
              <div className="space-y-2">
                {alternatives.map((alt, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${String.fromCharCode(65 + index)}: Description`}
                      value={alt.description}
                      onChange={(e) => updateAlternative(index, 'description', e.target.value)}
                      className="col-span-8 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="col-span-3 relative">
                      <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Cost"
                        value={alt.cost}
                        onChange={(e) => updateAlternative(index, 'cost', parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAlternative(index)}
                      className="col-span-1 text-red-600 hover:text-red-800 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAlternative}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Alternative Option
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Financial Manager Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Internal notes about this negotiation round..."
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit Negotiation Round
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Staffing Modal Component
export function StaffingModal({ selectedItem, onClose, onSubmit }: any) {
  const [formData, setFormData] = useState({
    eventRequestId: selectedItem?.eventRequestId || '',
    budgetAdjustmentId: selectedItem?.budgetAdjustmentId || null,
    submittedByRole: 'Event Manager',
    requiredPositions: {},
    urgencyLevel: 'MEDIUM',
    conflictDetails: ''
  });
  const [positions, setPositions] = useState([{ role: '', quantity: 1 }]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('event_request')
        .select('id, event_type, client:client_id(name)')
        .eq('status', 'APPROVED')
        .order('id', { ascending: false });
      setEvents(data || []);
    };
    loadEvents();
  }, []);

  const addPosition = () => {
    setPositions([...positions, { role: '', quantity: 1 }]);
  };

  const removePosition = (index: number) => {
    const newPos = positions.filter((_, i) => i !== index);
    setPositions(newPos);
    updateRequiredPositions(newPos);
  };

  const updatePosition = (index: number, field: string, value: any) => {
    const newPos = [...positions];
    (newPos[index] as any)[field] = value;
    setPositions(newPos);
    updateRequiredPositions(newPos);
  };

  const updateRequiredPositions = (posList: any[]) => {
    const reqs: any = {};
    posList.forEach(p => {
      if (p.role) {
        reqs[p.role] = p.quantity;
      }
    });
    setFormData(prev => ({ ...prev, requiredPositions: reqs }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.eventRequestId) {
      alert('Please select an event');
      return;
    }
    if (Object.keys(formData.requiredPositions).length === 0) {
      alert('Please add at least one position');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Request Staff</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Event Request *
              </label>
              <select
                value={formData.eventRequestId}
                onChange={(e) => setFormData({ ...formData, eventRequestId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Select an event...</option>
                {events.map((event: any) => (
                  <option key={event.id} value={event.id}>
                    Event #{event.id} - {event.event_type} - {event.client?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Role *
              </label>
              <input
                type="text"
                value={formData.submittedByRole}
                onChange={(e) => setFormData({ ...formData, submittedByRole: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Positions *
              </label>
              <div className="space-y-2">
                {positions.map((position, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Role (e.g., Waiter, Bartender)"
                      value={position.role}
                      onChange={(e) => updatePosition(index, 'role', e.target.value)}
                      className="col-span-8 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={position.quantity}
                      onChange={(e) => updatePosition(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removePosition(index)}
                      className="col-span-1 text-red-600 hover:text-red-800 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPosition}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  + Add Position
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urgency Level *
              </label>
              <select
                value={formData.urgencyLevel}
                onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="LOW">LOW - Can wait</option>
                <option value="MEDIUM">MEDIUM - Normal priority</option>
                <option value="HIGH">HIGH - Important</option>
                <option value="CRITICAL">CRITICAL - Urgent!</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conflict Details
              </label>
              <textarea
                value={formData.conflictDetails}
                onChange={(e) => setFormData({ ...formData, conflictDetails: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={3}
                placeholder="Any scheduling conflicts, special requirements, or additional notes..."
              />
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Submit Staffing Request
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Update Staffing Modal Component
export function UpdateStaffingModal({ selectedItem, onClose, onSubmit }: any) {
  const [formData, setFormData] = useState({
    id: selectedItem?.id,
    status: selectedItem?.status || 'PENDING',
    hrNotes: selectedItem?.hr_notes || '',
    resolutionDetails: selectedItem?.resolution_details || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.status === 'RESOLVED' && !formData.resolutionDetails) {
      alert('Please provide resolution details when marking as resolved');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Update Staffing Status</h2>
          
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Staffing Request #{selectedItem?.id}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Event #{selectedItem?.event_request_id}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="PENDING">PENDING - Waiting for review</option>
                <option value="IN_PROGRESS">IN_PROGRESS - Working on it</option>
                <option value="RESOLVED">RESOLVED - Staff assigned</option>
                <option value="CANCELLED">CANCELLED - No longer needed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HR Notes
              </label>
              <textarea
                value={formData.hrNotes}
                onChange={(e) => setFormData({ ...formData, hrNotes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Internal HR notes about this request..."
              />
            </div>

            {formData.status === 'RESOLVED' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Details *
                </label>
                <textarea
                  value={formData.resolutionDetails}
                  onChange={(e) => setFormData({ ...formData, resolutionDetails: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="List assigned staff members and any additional details..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: "Assigned: Sarah J. (Event Coordinator), Mike C. (AV Tech), Lisa W. & Tom B. (Catering)"
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update Status
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}