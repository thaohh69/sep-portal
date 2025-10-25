// components/budget/BudgetPlanningDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  FileText, 
  Users, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Clock
} from 'lucide-react';
import { 
  BudgetAdjustmentWithNegotiations,
  StaffingRequestWithDetails,
  BudgetPlanningDashboard as DashboardType
} from '@/app/types/budget-planning';
import Link from 'next/link';

interface BudgetPlanningDashboardProps {
  userRole: string;
}

export function BudgetPlanningDashboard({ userRole }: BudgetPlanningDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardType | null>(null);
  const [budgetAdjustments, setBudgetAdjustments] = useState<BudgetAdjustmentWithNegotiations[]>([]);
  const [staffingRequests, setStaffingRequests] = useState<StaffingRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load budget adjustments
      const budgetRes = await fetch('/api/budget-adjustments');
      const budgetData = await budgetRes.json();
      setBudgetAdjustments(budgetData.data || []);

      // Load staffing requests if HR or can view
      if (['hr_team', 'production_manager', 'service_manager', 'admin'].includes(userRole)) {
        const staffingRes = await fetch('/api/staffing-requests');
        const staffingData = await staffingRes.json();
        setStaffingRequests(staffingData.data || []);
      }

      // Calculate dashboard metrics
      const metrics: DashboardType = {
        pending_adjustments: budgetData.data?.filter((b: any) => b.status === 'pending').length || 0,
        active_negotiations: budgetData.data?.filter((b: any) => b.status === 'under_review').length || 0,
        pending_staffing_requests: staffingData?.data?.filter((s: any) => s.status === 'pending').length || 0,
        resolved_this_month: budgetData.data?.filter((b: any) => {
          const createdDate = new Date(b.created_at);
          const now = new Date();
          return b.status === 'approved' && 
                 createdDate.getMonth() === now.getMonth() && 
                 createdDate.getFullYear() === now.getFullYear();
        }).length || 0,
        rejected_budget_count: budgetData.data?.filter((b: any) => b.status === 'rejected').length || 0
      };

      setDashboardData(metrics);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading dashboard...</div>;
  }

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    color: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'under_review': return 'bg-blue-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'needs_staffing': return 'bg-orange-500';
      case 'in_progress': return 'bg-blue-500';
      case 'resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Budget Planning Dashboard</h2>
        <p className="text-muted-foreground">
          Monitor budget adjustments, negotiations, and staffing requests
        </p>
      </div>

      {dashboardData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Pending Adjustments"
            value={dashboardData.pending_adjustments}
            icon={Clock}
            color="text-yellow-600"
          />
          <StatCard
            title="Active Negotiations"
            value={dashboardData.active_negotiations}
            icon={DollarSign}
            color="text-blue-600"
          />
          <StatCard
            title="Staffing Requests"
            value={dashboardData.pending_staffing_requests}
            icon={Users}
            color="text-orange-600"
          />
          <StatCard
            title="Resolved This Month"
            value={dashboardData.resolved_this_month}
            icon={CheckCircle}
            color="text-green-600"
          />
          <StatCard
            title="Rejected (Budget)"
            value={dashboardData.rejected_budget_count}
            icon={XCircle}
            color="text-red-600"
          />
        </div>
      )}

      <Tabs defaultValue="budget-adjustments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="budget-adjustments">Budget Adjustments</TabsTrigger>
          {['hr_team', 'production_manager', 'service_manager', 'admin'].includes(userRole) && (
            <TabsTrigger value="staffing-requests">Staffing Requests</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="budget-adjustments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Budget Adjustments</CardTitle>
              <CardDescription>View and manage budget adjustment requests</CardDescription>
            </CardHeader>
            <CardContent>
              {budgetAdjustments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No budget adjustments found</p>
              ) : (
                <div className="space-y-3">
                  {budgetAdjustments.slice(0, 10).map((adjustment) => (
                    <Card key={adjustment.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">Event Request #{adjustment.event_request_id.slice(0, 8)}</h4>
                            <Badge className={statusColor(adjustment.status)}>
                              {adjustment.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Estimated Cost: <span className="font-medium">${adjustment.estimated_cost.toFixed(2)}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Rounds: {adjustment.negotiation_rounds?.length || 0} | 
                            Staffing Requests: {adjustment.staffing_requests?.length || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(adjustment.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link href={`/budget-adjustments/${adjustment.id}`}>
                          <Button size="sm">View Details</Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {['hr_team', 'production_manager', 'service_manager', 'admin'].includes(userRole) && (
          <TabsContent value="staffing-requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staffing Requests</CardTitle>
                <CardDescription>Manage staffing requests and resource gaps</CardDescription>
              </CardHeader>
              <CardContent>
                {staffingRequests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No staffing requests found</p>
                ) : (
                  <div className="space-y-3">
                    {staffingRequests.slice(0, 10).map((request) => (
                      <Card key={request.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">
                                {request.required_positions.length} Position(s)
                              </h4>
                              <Badge className={statusColor(request.status)}>
                                {request.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <Badge variant={
                                request.urgency_level === 'critical' ? 'destructive' :
                                request.urgency_level === 'high' ? 'default' : 'secondary'
                              }>
                                {request.urgency_level.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {request.required_positions.map(p => p.role).join(', ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(request.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Link href={`/staffing-requests/${request.id}`}>
                            <Button size="sm">View Details</Button>
                          </Link>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}