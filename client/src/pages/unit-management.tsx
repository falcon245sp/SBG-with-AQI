import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Plus, Edit, Trash2, Calendar, BookOpen, Target } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const unitSchema = z.object({
  unitNumber: z.number().min(1, 'Unit number must be at least 1'),
  name: z.string().min(1, 'Unit name is required'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface Unit {
  id: string;
  unitNumber: number;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UnitManagement() {
  const { classroomId } = useParams();
  const [, setLocation] = useLocation();
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: classrooms } = useQuery<any[]>({
    queryKey: ['/api/classrooms'],
    enabled: !!classroomId,
  });

  const classroom = classrooms?.find((c: any) => c.id === classroomId);

  const { data: units, isLoading } = useQuery<Unit[]>({
    queryKey: ['/api/classrooms', classroomId, 'units'],
    enabled: !!classroomId,
  });

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unitNumber: 1,
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      isActive: true,
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: (data: UnitFormData) => 
      apiRequest('POST', `/api/classrooms/${classroomId}/units`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms', classroomId, 'units'] });
      setIsDialogOpen(false);
      form.reset();
      setEditingUnit(null);
      toast({
        title: 'Success',
        description: 'Unit created successfully',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create unit',
      });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ unitId, data }: { unitId: string; data: UnitFormData }) =>
      apiRequest('PUT', `/api/units/${unitId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms', classroomId, 'units'] });
      setIsDialogOpen(false);
      form.reset();
      setEditingUnit(null);
      toast({
        title: 'Success',
        description: 'Unit updated successfully',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update unit',
      });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (unitId: string) =>
      apiRequest('DELETE', `/api/units/${unitId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/classrooms', classroomId, 'units'] });
      toast({
        title: 'Success',
        description: 'Unit deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete unit',
      });
    },
  });

  const handleSubmit = (data: UnitFormData) => {
    if (editingUnit) {
      updateUnitMutation.mutate({ unitId: editingUnit.id, data });
    } else {
      createUnitMutation.mutate(data);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    form.reset({
      unitNumber: unit.unitNumber,
      name: unit.name,
      description: unit.description || '',
      startDate: unit.startDate ? unit.startDate.split('T')[0] : '',
      endDate: unit.endDate ? unit.endDate.split('T')[0] : '',
      isActive: unit.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingUnit(null);
    const nextUnitNumber = units ? Math.max(...units.map(u => u.unitNumber), 0) + 1 : 1;
    form.reset({
      unitNumber: nextUnitNumber,
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (unit: Unit) => {
    if (confirm(`Are you sure you want to delete "${unit.name}"? This will also remove all associated standards coverage data.`)) {
      deleteUnitMutation.mutate(unit.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation(`/accountability-matrix/${classroomId}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Matrix
            </Button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Unit Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mb-1">
                {classroom?.name || 'Loading classroom...'}
              </p>
              <p className="text-sm text-gray-500">
                Organize your curriculum into units for better standards tracking
              </p>
            </div>
            
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Unit
            </Button>
          </div>
        </div>

        {/* Units Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Units</p>
                  <p className="text-2xl font-bold text-gray-900">{units?.length || 0}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Units</p>
                  <p className="text-2xl font-bold text-green-600">
                    {units?.filter(u => u.isActive).length || 0}
                  </p>
                </div>
                <Target className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Scheduled Units</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {units?.filter(u => u.startDate).length || 0}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Units List */}
        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
            <CardDescription>
              Manage your curriculum units and their organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!units || units.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No units created yet</p>
                <Button onClick={handleAdd}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Unit
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {units
                  .sort((a, b) => a.unitNumber - b.unitNumber)
                  .map(unit => (
                  <div key={unit.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                          {unit.unitNumber}
                        </div>
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{unit.name}</h3>
                          <Badge variant={unit.isActive ? "default" : "secondary"}>
                            {unit.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {unit.description && (
                          <p className="text-sm text-gray-600 mb-2">{unit.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {unit.startDate && (
                            <span>Start: {new Date(unit.startDate).toLocaleDateString()}</span>
                          )}
                          {unit.endDate && (
                            <span>End: {new Date(unit.endDate).toLocaleDateString()}</span>
                          )}
                          <span>Created: {new Date(unit.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(unit)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(unit)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUnit ? 'Edit Unit' : 'Add New Unit'}
              </DialogTitle>
              <DialogDescription>
                {editingUnit 
                  ? 'Update the unit details below.' 
                  : 'Create a new unit to organize your curriculum.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="unitNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Number</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-y-0 pt-6">
                        <FormLabel>Active</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Linear Functions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Brief description of the unit..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUnitMutation.isPending || updateUnitMutation.isPending}
                  >
                    {createUnitMutation.isPending || updateUnitMutation.isPending
                      ? 'Saving...' 
                      : editingUnit 
                        ? 'Update Unit' 
                        : 'Create Unit'
                    }
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}