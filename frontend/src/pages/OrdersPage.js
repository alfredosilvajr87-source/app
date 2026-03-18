import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { format } from 'date-fns';
import {
  ShoppingCart,
  CalendarIcon,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  Trash2,
  FileText,
  Edit
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrdersPage = () => {
  const { currentUnit } = useUnit();
  const { user, company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [calculatedOrder, setCalculatedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [targetDate, setTargetDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [amendDialogOpen, setAmendDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [editedQuantities, setEditedQuantities] = useState({});
  const [amendItems, setAmendItems] = useState([]);

  useEffect(() => {
    if (currentUnit) {
      fetchOrders();
    }
  }, [currentUnit]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/orders/${currentUnit.id}`);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateOrder = async () => {
    setCalculating(true);
    try {
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      const res = await axios.get(`${API}/orders/${currentUnit.id}/calculate?target_date=${dateStr}`);
      setCalculatedOrder(res.data);
      
      const quantities = {};
      res.data.items.forEach(item => {
        quantities[item.item_id] = item.adjusted_quantity;
      });
      setEditedQuantities(quantities);
      setPreviewOpen(true);
    } catch (err) {
      toast.error('Failed to calculate order');
    } finally {
      setCalculating(false);
    }
  };

  const createOrder = async () => {
    setCreating(true);
    try {
      const items = calculatedOrder.items
        .filter(item => editedQuantities[item.item_id] > 0)
        .map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          section_id: item.section_id,
          section_name: item.section_name,
          unit_of_measure: item.unit_of_measure,
          calculated_quantity: Math.round(item.calculated_quantity),
          adjusted_quantity: Math.round(editedQuantities[item.item_id])
        }));

      if (items.length === 0) {
        toast.warning('No items to order');
        setCreating(false);
        return;
      }

      await axios.post(`${API}/orders`, {
        unit_id: currentUnit.id,
        target_date: calculatedOrder.target_date,
        items,
        notes: orderNotes
      });

      toast.success('Order created successfully');
      setPreviewOpen(false);
      setCalculatedOrder(null);
      setOrderNotes('');
      fetchOrders();
    } catch (err) {
      toast.error('Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const downloadPdf = async (orderId) => {
    try {
      const res = await axios.get(`${API}/orders/${orderId}/pdf`);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
      link.download = res.data.filename;
      link.click();
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  const sharePdf = async (orderId) => {
    try {
      const res = await axios.get(`${API}/orders/${orderId}/pdf`);
      
      // Convert base64 to blob
      const byteCharacters = atob(res.data.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const file = new File([blob], res.data.filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: res.data.share_title,
          text: res.data.share_text,
          files: [file]
        });
        toast.success('Shared successfully');
      } else if (navigator.share) {
        // Share without file
        await navigator.share({
          title: res.data.share_title,
          text: res.data.share_text
        });
        toast.success('Shared successfully');
      } else {
        // Fallback: download
        downloadPdf(orderId);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Failed to share');
      }
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status?status=${status}`);
      toast.success(`Order marked as ${status}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update order');
    }
  };

  const openAmendDialog = (order) => {
    setSelectedOrder(order);
    setAmendItems(order.items.map(item => ({
      ...item,
      new_quantity: item.adjusted_quantity
    })));
    setAmendDialogOpen(true);
  };

  const createAmendment = async () => {
    const changedItems = amendItems.filter(item => item.new_quantity !== item.adjusted_quantity && item.new_quantity > 0);
    
    if (changedItems.length === 0) {
      toast.warning('No changes to submit');
      return;
    }

    try {
      await axios.post(`${API}/orders/${selectedOrder.id}/amendment`, {
        order_id: selectedOrder.id,
        items: changedItems.map(item => ({
          item_id: item.item_id,
          item_name: item.item_name,
          section_id: item.section_id,
          section_name: item.section_name,
          unit_of_measure: item.unit_of_measure,
          calculated_quantity: Math.round(item.new_quantity - item.adjusted_quantity),
          adjusted_quantity: Math.round(item.new_quantity - item.adjusted_quantity)
        })),
        notes: 'Quantity adjustment'
      });

      toast.success('Amendment order created');
      setAmendDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create amendment');
    }
  };

  const deleteOrder = async () => {
    try {
      await axios.delete(`${API}/orders/${selectedOrder.id}`);
      toast.success('Order deleted');
      setDeleteDialogOpen(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to delete order');
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const completedOrders = orders.filter(o => o.status === 'completed');

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-amber-600" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      default: return null;
    }
  };

  if (!currentUnit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShoppingCart className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold text-slate-900 mb-2">No Unit Selected</h2>
        <p className="text-slate-500">Please select a unit to manage orders</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="orders-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Purchase Orders
          </h1>
          <p className="text-slate-500 mt-1">Generate and manage purchase orders</p>
        </div>
      </div>

      {/* Generate Order Card */}
      <Card className="bg-gradient-to-br from-slate-50 to-white" data-testid="generate-order-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg">Generate New Order</CardTitle>
          <CardDescription>
            Calculate order based on minimum stock + day adjustment and average consumption
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[240px] justify-start text-left font-normal"
                    data-testid="target-date-btn"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(targetDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={(date) => {
                      setTargetDate(date || new Date());
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button
              onClick={calculateOrder}
              disabled={calculating}
              data-testid="calculate-order-btn"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {calculating ? 'Calculating...' : 'Calculate Order'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending" data-testid="pending-orders-tab">
            Pending ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="completed-orders-tab">
            Completed ({completedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No pending orders</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((order) => (
                <Card key={order.id} data-testid={`order-${order.id}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(order.status)}
                        <div>
                          <p className="font-medium font-mono">{order.order_number}</p>
                          <p className="text-sm text-slate-500">
                            {order.items.length} items · Target: {order.target_date}
                          </p>
                          <p className="text-xs text-slate-400">
                            Created by {order.created_by_name} · {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdf(order.id)}
                          data-testid={`download-pdf-${order.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sharePdf(order.id)}
                          data-testid={`share-order-${order.id}`}
                        >
                          <Share2 className="h-4 w-4 mr-1" />
                          Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          data-testid={`complete-order-${order.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDeleteDialogOpen(true);
                          }}
                          data-testid={`delete-order-${order.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-slate-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No completed orders</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedOrders.map((order) => (
                <Card key={order.id} className="opacity-90" data-testid={`order-${order.id}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(order.status)}
                        <div>
                          <p className="font-medium font-mono">{order.order_number}</p>
                          <p className="text-sm text-slate-500">
                            {order.items.length} items · {order.target_date}
                          </p>
                          <p className="text-xs text-slate-400">
                            Completed: {order.completed_at ? new Date(order.completed_at).toLocaleString() : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdf(order.id)}
                          data-testid={`download-pdf-${order.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sharePdf(order.id)}
                          data-testid={`share-order-${order.id}`}
                        >
                          <Share2 className="h-4 w-4 mr-1" />
                          Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAmendDialog(order)}
                          data-testid={`amend-order-${order.id}`}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Amend
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="order-preview-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Order Preview</DialogTitle>
            <DialogDescription>
              Review and adjust quantities before creating the order
            </DialogDescription>
          </DialogHeader>

          {calculatedOrder && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Target Date</p>
                  <p className="font-medium">{calculatedOrder.target_date}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Day Increment</p>
                  <p className="font-medium">+{calculatedOrder.quantity_increment} units</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Items</p>
                  <p className="font-medium">{calculatedOrder.items.length}</p>
                </div>
              </div>

              {calculatedOrder.items.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-4" />
                  <p className="text-slate-500">All items have sufficient stock!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Section</th>
                        <th>Current</th>
                        <th>Needed</th>
                        <th>Order Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedOrder.items.map((item) => (
                        <tr key={item.item_id}>
                          <td className="font-medium">{item.item_name}</td>
                          <td className="text-slate-500">{item.section_name}</td>
                          <td className="font-mono">
                            {Math.round(item.current_stock)} {item.unit_of_measure}
                          </td>
                          <td className="font-mono">
                            {item.calculated_quantity} {item.unit_of_measure}
                          </td>
                          <td>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              className="w-24 font-mono"
                              value={editedQuantities[item.item_id] || 0}
                              onChange={(e) => setEditedQuantities({
                                ...editedQuantities,
                                [item.item_id]: Math.round(parseFloat(e.target.value)) || 0
                              })}
                              data-testid={`order-qty-${item.item_id}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes for this order..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  data-testid="order-notes"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={createOrder}
              disabled={creating || !calculatedOrder?.items.length}
              data-testid="confirm-order-btn"
            >
              {creating ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Amendment Dialog */}
      <Dialog open={amendDialogOpen} onOpenChange={setAmendDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="amend-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Amend Order {selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>
              Adjust quantities. Only changed items will be included in the amendment order.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Original Qty</th>
                  <th>New Qty</th>
                </tr>
              </thead>
              <tbody>
                {amendItems.map((item, index) => (
                  <tr key={item.item_id}>
                    <td className="font-medium">{item.item_name}</td>
                    <td className="font-mono">{item.adjusted_quantity} {item.unit_of_measure}</td>
                    <td>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        className="w-24 font-mono"
                        value={item.new_quantity}
                        onChange={(e) => {
                          const newItems = [...amendItems];
                          newItems[index].new_quantity = Math.round(parseFloat(e.target.value)) || 0;
                          setAmendItems(newItems);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAmendment} data-testid="create-amendment-btn">
              Create Amendment Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteOrder}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-order"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;
