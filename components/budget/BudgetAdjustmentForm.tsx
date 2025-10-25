// components/budget/BudgetAdjustmentForm.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { ResourceRequirement, CreateBudgetAdjustmentRequest } from '@/app/types/budget-planning';

interface BudgetAdjustmentFormProps {
  eventRequestId: string;
  onSubmit: (data: CreateBudgetAdjustmentRequest) => Promise<void>;
  onCancel: () => void;
}

export function BudgetAdjustmentForm({ eventRequestId, onSubmit, onCancel }: BudgetAdjustmentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justification, setJustification] = useState('');
  const [resources, setResources] = useState<ResourceRequirement[]>([
    { type: '', quantity: 1, unitCost: 0, totalCost: 0, description: '' }
  ]);

  const addResource = () => {
    setResources([
      ...resources,
      { type: '', quantity: 1, unitCost: 0, totalCost: 0, description: '' }
    ]);
  };

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const updateResource = (index: number, field: keyof ResourceRequirement, value: any) => {
    const updated = [...resources];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total cost
    if (field === 'quantity' || field === 'unitCost') {
      updated[index].totalCost = updated[index].quantity * updated[index].unitCost;
    }
    
    setResources(updated);
  };

  const totalEstimatedCost = resources.reduce((sum, r) => sum + r.totalCost, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (resources.some(r => !r.type || r.quantity <= 0 || r.unitCost <= 0)) {
      alert('Please fill in all resource details');
      return;
    }

    if (!justification.trim()) {
      alert('Please provide justification for the budget adjustment');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        event_request_id: eventRequestId,
        resource_requirements: resources,
        justification
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Budget Adjustment Request</CardTitle>
        <CardDescription>
          Review resource needs and submit a budget adjustment request for financial manager approval
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Resource Requirements</Label>
              <Button type="button" onClick={addResource} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </div>

            {resources.map((resource, index) => (
              <Card key={index} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`type-${index}`}>Resource Type</Label>
                    <Input
                      id={`type-${index}`}
                      value={resource.type}
                      onChange={(e) => updateResource(index, 'type', e.target.value)}
                      placeholder="e.g., Equipment, Staff"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      min="1"
                      value={resource.quantity}
                      onChange={(e) => updateResource(index, 'quantity', parseFloat(e.target.value))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`unitCost-${index}`}>Unit Cost ($)</Label>
                    <Input
                      id={`unitCost-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={resource.unitCost}
                      onChange={(e) => updateResource(index, 'unitCost', parseFloat(e.target.value))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`totalCost-${index}`}>Total Cost ($)</Label>
                    <Input
                      id={`totalCost-${index}`}
                      type="number"
                      value={resource.totalCost.toFixed(2)}
                      disabled
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={() => removeResource(index)}
                      size="icon"
                      variant="destructive"
                      disabled={resources.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor={`description-${index}`}>Description</Label>
                  <Textarea
                    id={`description-${index}`}
                    value={resource.description}
                    onChange={(e) => updateResource(index, 'description', e.target.value)}
                    placeholder="Provide details about this resource"
                    rows={2}
                  />
                </div>
              </Card>
            ))}

            <div className="flex justify-end p-4 bg-muted rounded-lg">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Estimated Cost</div>
                <div className="text-2xl font-bold">${totalEstimatedCost.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">Justification</Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Explain why these additional resources are necessary"
              rows={4}
              required
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Budget Adjustment'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}