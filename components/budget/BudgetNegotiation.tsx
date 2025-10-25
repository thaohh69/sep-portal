// components/budget/BudgetNegotiation.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { 
  BudgetAdjustmentWithNegotiations, 
  AlternativeBudgetOption,
  CreateNegotiationRoundRequest 
} from '@/app/types/budget-planning';

interface BudgetNegotiationProps {
  budgetAdjustment: BudgetAdjustmentWithNegotiations;
  onCreateRound: (data: CreateNegotiationRoundRequest) => Promise<void>;
  onUpdateRound: (roundId: string, status: string, clientResponse?: string, isFinal?: boolean) => Promise<void>;
}

export function BudgetNegotiation({ budgetAdjustment, onCreateRound, onUpdateRound }: BudgetNegotiationProps) {
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [proposedAmount, setProposedAmount] = useState(budgetAdjustment.estimated_cost.toString());
  const [notes, setNotes] = useState('');
  const [alternatives, setAlternatives] = useState<AlternativeBudgetOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAlternative = () => {
    setAlternatives([
      ...alternatives,
      { description: '', amount: 0, trade_offs: [''], recommendations: [''] }
    ]);
  };

  const removeAlternative = (index: number) => {
    setAlternatives(alternatives.filter((_, i) => i !== index));
  };

  const updateAlternative = (index: number, field: keyof AlternativeBudgetOption, value: any) => {
    const updated = [...alternatives];
    updated[index] = { ...updated[index], [field]: value };
    setAlternatives(updated);
  };

  const addTradeOff = (altIndex: number) => {
    const updated = [...alternatives];
    updated[altIndex].trade_offs.push('');
    setAlternatives(updated);
  };

  const updateTradeOff = (altIndex: number, tradeOffIndex: number, value: string) => {
    const updated = [...alternatives];
    updated[altIndex].trade_offs[tradeOffIndex] = value;
    setAlternatives(updated);
  };

  const handleCreateRound = async () => {
    if (!proposedAmount || parseFloat(proposedAmount) <= 0) {
      alert('Please enter a valid proposed amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateRound({
        budget_adjustment_id: budgetAdjustment.id,
        proposed_amount: parseFloat(proposedAmount),
        alternative_options: alternatives.length > 0 ? alternatives : undefined,
        financial_manager_notes: notes || undefined
      });
      
      // Reset form
      setIsCreatingRound(false);
      setAlternatives([]);
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkRejected = async () => {
    if (!confirm('Are you sure you want to mark this request as "Rejected (Budget)"? This will end the negotiation process.')) {
      return;
    }

    const lastRound = budgetAdjustment.negotiation_rounds[budgetAdjustment.negotiation_rounds.length - 1];
    if (lastRound) {
      await onUpdateRound(lastRound.id, 'rejected', undefined, true);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'under_review': return 'bg-blue-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'needs_staffing': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Budget Negotiation</CardTitle>
              <CardDescription>Manage budget negotiations with the client</CardDescription>
            </div>
            <Badge className={statusColor(budgetAdjustment.status)}>
              {budgetAdjustment.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Original Estimated Cost</Label>
              <p className="text-2xl font-bold">${budgetAdjustment.estimated_cost.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Negotiation Rounds</Label>
              <p className="text-2xl font-bold">{budgetAdjustment.negotiation_rounds.length}</p>
            </div>
          </div>

          <div>
            <Label className="font-semibold">Justification</Label>
            <p className="mt-2 text-sm text-muted-foreground">{budgetAdjustment.justification}</p>
          </div>

          <div>
            <Label className="font-semibold">Resource Requirements</Label>
            <div className="mt-2 space-y-2">
              {budgetAdjustment.resource_requirements.map((resource, index) => (
                <Card key={index} className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{resource.type}</p>
                      <p className="text-sm text-muted-foreground">{resource.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${resource.totalCost.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        {resource.quantity} × ${resource.unitCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Negotiation Rounds History */}
      {budgetAdjustment.negotiation_rounds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Negotiation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {budgetAdjustment.negotiation_rounds.map((round) => (
                <Card key={round.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">Round {round.round_number}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(round.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge>{round.status.replace('_', ' ')}</Badge>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm">Proposed Amount</Label>
                      <p className="text-lg font-bold">${round.proposed_amount.toFixed(2)}</p>
                    </div>

                    {round.financial_manager_notes && (
                      <div>
                        <Label className="text-sm">Manager Notes</Label>
                        <p className="text-sm text-muted-foreground mt-1">{round.financial_manager_notes}</p>
                      </div>
                    )}

                    {round.alternative_options && round.alternative_options.length > 0 && (
                      <div>
                        <Label className="text-sm">Alternative Options</Label>
                        <div className="mt-2 space-y-2">
                          {round.alternative_options.map((alt, idx) => (
                            <div key={idx} className="p-2 bg-muted rounded">
                              <p className="font-medium">${alt.amount.toFixed(2)}</p>
                              <p className="text-sm">{alt.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {round.client_response && (
                      <div>
                        <Label className="text-sm">Client Response</Label>
                        <p className="text-sm text-muted-foreground mt-1">{round.client_response}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Round */}
      {budgetAdjustment.status !== 'approved' && budgetAdjustment.status !== 'rejected' && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isCreatingRound ? 'Prepare New Negotiation Round' : 'Start Negotiation'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isCreatingRound ? (
              <div className="flex gap-3">
                <Button onClick={() => setIsCreatingRound(true)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start New Round
                </Button>
                {budgetAdjustment.negotiation_rounds.length > 0 && (
                  <Button variant="destructive" onClick={handleMarkRejected}>
                    Mark as Rejected (Budget)
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proposedAmount">Proposed Amount ($)</Label>
                  <Input
                    id="proposedAmount"
                    type="number"
                    step="0.01"
                    value={proposedAmount}
                    onChange={(e) => setProposedAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Financial Manager Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this negotiation round"
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Alternative Budget Options</Label>
                    <Button type="button" onClick={addAlternative} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Alternative
                    </Button>
                  </div>

                  {alternatives.map((alt, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <Label>Alternative {index + 1}</Label>
                          <Button
                            type="button"
                            onClick={() => removeAlternative(index)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Amount ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={alt.amount}
                              onChange={(e) => updateAlternative(index, 'amount', parseFloat(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={alt.description}
                            onChange={(e) => updateAlternative(index, 'description', e.target.value)}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Trade-offs</Label>
                            <Button
                              type="button"
                              onClick={() => addTradeOff(index)}
                              size="sm"
                              variant="outline"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          {alt.trade_offs.map((tradeOff, tIdx) => (
                            <Input
                              key={tIdx}
                              value={tradeOff}
                              onChange={(e) => updateTradeOff(index, tIdx, e.target.value)}
                              placeholder="Describe a trade-off"
                            />
                          ))}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex gap-3 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreatingRound(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRound} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Negotiation Round'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}