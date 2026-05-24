import { useState, useEffect } from 'react';
import { useUnit } from '../context/UnitContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { ClipboardList, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_URL as API } from '../config';

// Fallback team map when item.team is not set in DB
const ITEM_TEAM_MAP = {
  "Coffee Beans":"Front","Decaf Coffee":"Front","Matcha":"Front","Chai Latte":"Front",
  "Hot Choc Powder":"Front","Spray Cream":"Front","Baci (Box)":"Front","Baci (Bag)":"Front",
  "Marshmallow":"Front","Paper Bag / Brown Paper Bag":"Front","Tea bags":"Front",
  "White Sugar":"Front","Brown Sugar":"Front","Ketchup":"Front","Vinegar":"Front",
  "Salt Sachets":"Front","Pepper Sachets":"Front","Jam":"Front",
  "Full Fat Milk":"Front","Low Fat Milk":"Front","Coconut Milk":"Front","Oat Milk":"Front",
  "Coke":"Front","Coke Zero":"Front","San Pell Orange":"Front","Sparkling Water":"Front",
  "Still Water":"Front","Apple Juice":"Front","Moretti":"Front","Raffo":"Front",
  "12oz Cups":"Front","8oz cups":"Front","12oz Lids":"Front","8oz Lids":"Front",
  "12oz Cold Cups":"Front","Flat Lids":"Front","Vanilla Syrup":"Front","Caramel Syrup":"Front",
  "Hazelnut Syrup":"Front","Strawberry Puree":"Front","Mango Puree":"Front","Blueberry Puree":"Front",
  "T/A Forks":"Front","T/A Knives":"Front","T/A Spoons":"Front","Wooden Stirers":"Front",
  "Napkins (/pack)":"Front","Straw":"Front","Bamboo Straw":"Front",
  "Caramelised Biscuit":"Front","Kinder White Choc":"Front","Pistachio":"Front","Peanut Butter":"Front",
  "Chicken (melt)":"Kitchen","Tuna (melt)":"Kitchen","Veggie (melt)":"Kitchen",
  "Ham&Cheese (melt)":"Kitchen","Focaccia (melt)":"Kitchen","Avo Club (melt)":"Kitchen",
  "D9 (Grill & Oven)":"Kitchen","D5 (Descaler)":"Kitchen","D10":"Kitchen","Degreaser":"Kitchen",
  "Gloves L":"Kitchen","Heavy Duty Gloves":"Kitchen","Kitchen Printer Inks":"Kitchen",
  "Pot Scrub":"Kitchen","Rinse Clear":"Kitchen","Blue Roll":"Kitchen","Soap":"Kitchen",
  "Sponge":"Kitchen","Suma Combi+":"Kitchen","Fairy Liquid":"Kitchen","Glass Cleaner":"Kitchen",
  "Cif":"Kitchen","Toilet Paper":"Kitchen","Kitchen Printer Roll":"Kitchen",
  '12" Boxes':"Kitchen",'20" Boxes':"Kitchen","Small Foil Cont+Lids":"Kitchen",
  "Burger Box Sml":"Kitchen","Burger Box Lge":"Kitchen","Chip Bags":"Kitchen",
  "2oz cups+lids":"Kitchen","Pasta Cont+Lids":"Kitchen","Clear Pasta Cont":"Kitchen",
  "Bin Bags (Black)":"Kitchen","Bin Bags (Clear)":"Kitchen","Tin Foil":"Kitchen",
  "Small Salad Cont":"Kitchen","Large Salad Cont":"Kitchen","Salad Cont Lids":"Kitchen",
  "Acai Containers":"Kitchen","Acai Lids":"Kitchen",
  '12" Dough':"Kitchen",'20" Dough':"Kitchen","Pizza Sauce":"Kitchen","Veg Stock":"Kitchen",
  "Bolognese Sce":"Kitchen","Napoli Sauce":"Kitchen","Soup":"Kitchen","Green Pesto":"Kitchen",
  "Hot Honey":"Kitchen","Lasagne (TRAY)":"Kitchen","Dijon Dressing":"Kitchen","Mayonnaise 5L":"Kitchen",
  "Vine Tomato":"Kitchen","Sundried Tomato":"Kitchen","Avocado (case/20)":"Kitchen",
  "Courgette":"Kitchen","Mushroom":"Kitchen","Rocket (Bag)":"Kitchen","Spinach (Bag)":"Kitchen",
  "Lettuce (Bag)":"Kitchen","Peppers (single)":"Kitchen","Red Onion (/kg)":"Kitchen",
  "Sweetcorn (can)":"Kitchen","Lasagne for 2":"Kitchen","Garlic":"Kitchen","Garlic Puree":"Kitchen",
  "Chilli Peppers":"Kitchen","Chips (/bag)":"Kitchen","Acai":"Kitchen","Ravioli (/box)":"Kitchen",
  "Peas (Frozen)":"Kitchen","Vanilla Ice Cream":"Kitchen","Prawns":"Kitchen",
  "French Toast":"Kitchen","Ice (Bag)":"Kitchen","Ciabatta":"Kitchen",
  "Pizza Mozzarella":"Kitchen","Butter 454g":"Kitchen","Butter Portion":"Kitchen",
  "Cream":"Kitchen","Parmesan 1kg":"Kitchen","Parmesan Shaving (/kg)":"Kitchen",
  "Straciatella":"Kitchen","Buffalo Mozzarella":"Kitchen",
  "Olive Oil":"Kitchen","Oil Spray":"Kitchen","Honey (/btl)":"Kitchen","Chia Seed":"Kitchen",
  "Chilli Oil":"Kitchen","Salt (bucket)":"Kitchen","Cooking White Wine":"Kitchen",
  "Balsamic Glaze":"Kitchen","Relish":"Kitchen","Bread":"Kitchen","Egg Yolk":"Kitchen",
  "Eggs":"Kitchen","Peanut Butter (bucket)":"Kitchen","Penne (/5kg)":"Kitchen",
  "Spaghetti (/5kg)":"Kitchen","Gluten Free Penne (/400g)":"Kitchen","Granola":"Kitchen",
  "Focaccia Bread":"Kitchen","Kinder Bueno":"Kitchen","GlutenFree Bread":"Kitchen",
  "Flour":"Kitchen","Dry Funghi":"Kitchen","Nutella":"Kitchen","Biscoff Biscuits":"Kitchen",
  "Ham":"Kitchen","Sausages (/kg)":"Kitchen","Black Pudding (box)":"Kitchen",
  "Pepperoni (/pack)":"Kitchen","Parma Ham (/tray 500g)":"Kitchen","Nduja":"Kitchen",
  "Goujons":"Kitchen","Pancetta":"Kitchen","Diced Chicken Bags":"Kitchen","Breakfast Bacon":"Kitchen",
  "Pineapple (1 can)":"Kitchen","Banana (pcs)":"Kitchen","Blueberry":"Kitchen",
  "Strawberry":"Kitchen","Lemon (/pcs)":"Kitchen","Chilli Flakes":"Kitchen","Parsley":"Kitchen",
  "Basil":"Kitchen","Crushed B. Pepper":"Kitchen","Ground B.Pepper":"Kitchen",
  "Whole B. Pepper":"Kitchen","Chips Seasoning":"Kitchen","Oregano":"Kitchen",
  "pistachio sauce":"Kitchen","bueno sauce":"Kitchen","biscoff sauce":"Kitchen",
};

const getItemTeam = (item) => item.team || ITEM_TEAM_MAP[item.name] || '';

const TEAM_CONFIG = {
  Front:   { label: '☕ Front',   bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  Kitchen: { label: '🍳 Kitchen', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
};

const DailyEntryPage = () => {
  const { currentUnit } = useUnit();
  const [items, setItems] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [teamFilter, setTeamFilter] = useState('All');

  useEffect(() => {
    if (currentUnit) fetchData();
  }, [currentUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, entriesRes] = await Promise.all([
        axios.get(`${API}/items`),
        axios.get(`${API}/stock-entries/${currentUnit.id}/latest`)
      ]);
      setItems(itemsRes.data);
      const entriesMap = {};
      entriesRes.data.forEach(entry => { entriesMap[entry.item_id] = entry.quantity; });
      setEntries(entriesMap);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEntryChange = (itemId, value) => {
    setEntries(prev => ({ ...prev, [itemId]: value === '' ? '' : parseFloat(value) || 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entriesToSave = Object.entries(entries)
        .filter(([_, q]) => q !== '' && q !== undefined)
        .map(([item_id, quantity]) => ({ item_id, quantity: parseFloat(quantity), unit_id: currentUnit.id }));
      if (entriesToSave.length === 0) { toast.warning('No entries to save'); setSaving(false); return; }
      await axios.post(`${API}/stock-entries`, entriesToSave);
      setLastSaved(new Date());
      toast.success(`${entriesToSave.length} entries saved successfully`);
    } catch {
      toast.error('Failed to save entries');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Apply team from map if not in DB, then filter and group
  const itemsWithTeam = items.map(i => ({ ...i, team: getItemTeam(i) }));
  const filteredItems = teamFilter === 'All' ? itemsWithTeam : itemsWithTeam.filter(i => i.team === teamFilter);
  const groupedItems = filteredItems.reduce((acc, item) => {
    const sec = item.section_name || 'Other';
    if (!acc[sec]) acc[sec] = { Front: [], Kitchen: [], Other: [] };
    const team = item.team === 'Front' ? 'Front' : item.team === 'Kitchen' ? 'Kitchen' : 'Other';
    acc[sec][team].push(item);
    return acc;
  }, {});

  const renderItems = (itemList) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {itemList.map((item) => {
        const team = getItemTeam(item);
        const cardBorder = team === 'Front'
          ? 'border-blue-200 bg-blue-50'
          : team === 'Kitchen'
          ? 'border-orange-200 bg-orange-50'
          : 'border-slate-100';
        const dotColor = team === 'Front'
          ? 'bg-blue-400'
          : team === 'Kitchen'
          ? 'bg-orange-400'
          : 'bg-slate-300';
        return (
          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm ${cardBorder}`} data-testid={`entry-item-${item.id}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {team && <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />}
                <p className="font-medium truncate text-sm">{item.name}</p>
              </div>
              <p className="text-xs text-slate-400">Min: {item.minimum_stock} {item.unit_of_measure}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number" step="0.01" min="0"
                className="w-20 text-right font-mono text-sm bg-white"
                value={entries[item.id] ?? ''}
                onChange={(e) => handleEntryChange(item.id, e.target.value)}
                placeholder="0"
                data-testid={`entry-input-${item.id}`}
              />
              <span className="text-xs text-slate-400 w-6">{item.unit_of_measure}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!currentUnit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="font-heading text-2xl font-bold mb-2">No Unit Selected</h2>
        <p className="text-slate-500">Please select a unit to enter daily stock</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="daily-entry-page">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Daily Stock Entry</h1>
          <p className="text-slate-500 mt-1">{today}</p>
          <div className="flex gap-2 mt-3">
            {['All', 'Front', 'Kitchen'].map(t => (
              <button key={t} onClick={() => setTeamFilter(t)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${teamFilter === t ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-200 hover:border-slate-400'}`}>
                {t === 'All' ? '🏠 All' : t === 'Front' ? '☕ Front' : '🍳 Kitchen'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={handleSave} disabled={saving || loading} data-testid="save-entries-btn">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-5 bg-slate-200 rounded w-32" /></CardHeader>
              <CardContent><div className="h-24 bg-slate-100 rounded" /></CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-heading text-xl font-semibold mb-2">No Items to Count</h3>
            <p className="text-slate-500">Add items to your inventory first</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([sectionName, teamGroups]) => {
            const totalItems = Object.values(teamGroups).flat().length;
            if (totalItems === 0) return null;
            const hasMultipleTeams = teamFilter === 'All' &&
              [teamGroups.Front, teamGroups.Kitchen].filter(g => g.length > 0).length > 1;

            return (
              <Card key={sectionName} data-testid={`entry-section-${sectionName}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-lg">{sectionName}</CardTitle>
                  <CardDescription>{totalItems} items</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasMultipleTeams ? (
                    ['Front', 'Kitchen'].map(team => {
                      const teamItems = teamGroups[team];
                      if (teamItems.length === 0) return null;
                      const cfg = TEAM_CONFIG[team];
                      return (
                        <div key={team} className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                            <span className="text-xs text-slate-400">{teamItems.length} items</span>
                          </div>
                          {renderItems(teamItems)}
                        </div>
                      );
                    })
                  ) : (
                    renderItems(Object.values(teamGroups).flat())
                  )}
                  {teamGroups.Other.length > 0 && renderItems(teamGroups.Other)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="fixed bottom-6 right-6 lg:hidden">
        <Button size="lg" onClick={handleSave} disabled={saving || loading} className="shadow-lg" data-testid="floating-save-btn">
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default DailyEntryPage;
