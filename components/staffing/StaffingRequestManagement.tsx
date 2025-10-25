// components/staffing/StaffingRequestManagement.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { StaffingRequestWithDetails, StaffingRequestStatus, UrgencyLevel } from '@/app/types/budget-planning';

interface StaffingRequestManagementProps {
  staffingRequest: StaffingRequestWithDetails;
  onUpdateStatus: (status: StaffingRequestStatus, hrNotes?: string, resolutionDetails?: string) => Promise<void>;
}

export function StaffingRequestManagement({ staffingRequest, onUpdateStatus }: StaffingRequestManagementProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StaffingRequestStatus>(staffingRequest.status);
  const [hrNotes, setHrNotes] = useState(staffingRequest.hr_notes || '');
  const [resolutionDetails, setResolutionDetails] = useState(staffingRequest.resolution_details || '');

  const handleUpdateStatus = async () => {
    if (selectedStatus === 'resolved' && !resolutionDetails.trim()) {
      alert('Please provide resolution details');
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateStatus(
        selectedStatus,
        hrNotes || undefined,
        selectedStatus === 'resolved' ? resolutionDetails : undefined
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const urgencyColors: Record<UrgencyLevel, { bg: string; text: string; icon: React.ReactNode }> = {
    low: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="h-4 w-4" /> },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', icon: <AlertCircle className="h-4 w-4" /> },
    critical: { bg: 'bg-red-100', text: 'text-red-800', icon: <AlertCircle className="h-4 w-4" /> }
  };

  const statusColors: Record<StaffingRequestStatus, string> = {
    pending: 'bg-yellow-500',
    in_progress: 'bg-blue-500',
    resolved: 'bg-green-500',
    cancelled: 'bg-gray-500'
  };

  const urgencyStyle = urgencyColors[staffingRequest.urgency_level];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Staffing Request Details</CardTitle>
              <CardDescription>Review and process staffing request</CardDescription>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge className={statusColors[staffingRequest.status]}>
                {staffingRequest.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge className={`${urgencyStyle.bg} ${urgencyStyle.text}`}>
                {urgencyStyle.icon}
                <span className="ml-1">{staffingRequest.urgency_level.toUpperCase()}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="font-semibold">Submitted By</Label>
            <p className="mt-1 text-sm">
              {staffingRequest.submitter_name || 'Unknown'} 
              <span className="text-muted-foreground"> ({staffingRequest.submitted_by_role})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(staffingRequest.created_at).toLocaleString()}
            </p>
          </div>

          <div>
            <Label className="font-semibold">Conflict/Shortage Details</Label>
            <p className="mt-2 text-sm text-muted-foreground">{staffingRequest.conflict_details}</p>
          </div>

          <div>
            <Label className="font-semibold mb-3 block">Required Positions</Label>
            <div className="space-y-3">
              {staffingRequest.required_positions.map((position, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{position.role}</h4>
                        {position.is_specialized && (
                          <Badge variant="outline" className="mt-1">Specialized</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{position.count} person{position.count > 1 ? 's' : ''}</p>
                        <p className="text-sm text-muted-foreground">{position.duration}</p>
                      </div>
                    </div>

                    {position.skills_required.length > 0 && (
                      <div>
                        <Label className="text-sm">Required Skills</Label>
                        <ul className="mt-1 space-y-1">
                          {position.skills_required.filter(s => s).map((skill, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-center">
                              <span className="mr-2">•</span> {skill}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {staffingRequest.hr_notes && (
            <div>
              <Label className="font-semibold">HR Notes</Label>
              <p className="mt-2 text-sm text-muted-foreground">{staffingRequest.hr_notes}</p>
            </div>
          )}

          {staffingRequest.resolution_details && (
            <div>
              <Label className="font-semibold">Resolution Details</Label>
              <p className="mt-2 text-sm text-muted-foreground">{staffingRequest.resolution_details}</p>
            </div>
          )}

          {staffingRequest.resolved_at && (
            <div>
              <Label className="font-semibold">Resolved At</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(staffingRequest.resolved_at).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {staffingRequest.status !== 'resolved' && staffingRequest.status !== 'cancelled' && (
        <Card>
          <CardHeader>
            <CardTitle>Process Staffing Request</CardTitle>
            <CardDescription>Update status and add notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as StaffingRequestStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hrNotes">HR Notes</Label>
              <Textarea
                id="hrNotes"
                value={hrNotes}
                onChange={(e) => setHrNotes(e.target.value)}
                placeholder="Add internal HR notes about this request"
                rows={3}
              />
            </div>

            {selectedStatus === 'resolved' && (
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution Details *</Label>
                <Textarea
                  id="resolution"
                  value={resolutionDetails}
                  onChange={(e) => setResolutionDetails(e.target.value)}
                  placeholder="Describe how the staffing issue was resolved (e.g., hired contractors, reassigned internal staff)"
                  rows={4}
                  required
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button onClick={handleUpdateStatus} disabled={isUpdating}>
                {isUpdating ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}