import React, { useState, useRef } from 'react';
import {
  Briefcase,
  Plus,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  ArrowUpRight,
  Clock,
  Shield,
  Users,
} from 'lucide-react';
import {
  PortfolioResponse,
  PortfolioPosition,
  MarketType,
} from '../types/api';
import { TooltipHelper } from './TooltipHelper';

interface PortfolioTrackerProps {
  portfolio: PortfolioResponse | null;
  loading: boolean;
  plainEnglishMode: boolean;
  onSelectStockForDeepDive: (ticker: string, market: MarketType) => void;
  onCreatePosition: (payload: Record<string, unknown>) => Promise<void>;
  onUpdatePosition: (id: number, payload: Record<string, unknown>) => Promise<void>;
  onDeletePosition: (id: number) => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: (data: Record<string, unknown>) => Promise<void>;
}

export const PortfolioTracker: React.FC<PortfolioTrackerProps> = ({
  portfolio,
  loading,
  plainEnglishMode,
  onSelectStockForDeepDive,
  onCreatePosition,
  onUpdatePosition,
  onDeletePosition,
  onExportBackup,
  onImportBackup,
}) => {
  const [ownerFilter, setOwnerFilter] = useState<'ALL' | 'Saksham' | 'Family' | 'Joint'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Add Position Form State
  const [newTicker, setNewTicker] = useState('RELIANCE.NS');
  const [newCompany, setNewCompany] = useState('Reliance Industries Ltd');
  const [newMarket, setNewMarket] = useState<MarketType>('INDIA_NSE');
  const [newOwner, setNewOwner] = useState<'Saksham' | 'Family' | 'Joint'>('Joint');
  const [newShares, setNewShares] = useState(25);
  const [newEntryPrice, setNewEntryPrice] = useState(1320);
  const [newStopPrice, setNewStopPrice] = useState(1235);
  const [newT1Price, setNewT1Price] = useState(1495);
  const [newT2Price, setNewT2Price] = useState(1645);
  const [newNotes, setNewNotes] = useState('');

  const positions = (portfolio?.positions || []).filter(
    (p) => ownerFilter === 'ALL' || p.owner === ownerFilter
  );

  const inrStats = portfolio?.summary_india_inr;
  const usdStats = portfolio?.summary_us_usd;

  const getOwnerBadge = (owner: string) => {
    if (owner === 'Family') {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (owner === 'Saksham') {
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  };

  const getAlertStyle = (type: string) => {
    if (type === 'PROFIT_BOOK' || type === 'SUCCESS') {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    if (type === 'DANGER') {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
    if (type === 'ROTATION') {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    return 'bg-slate-950 text-slate-300 border-slate-800';
  };

  const handleBookHalfAtT1 = async (pos: PortfolioPosition) => {
    const remainingShares = Math.max(1, Math.ceil(pos.shares / 2));
    await onUpdatePosition(pos.id, {
      shares: remainingShares,
      partial_booked: true,
      stop_loss_price: pos.entry_price,
      notes: `${pos.notes ? pos.notes + ' | ' : ''}Booked 50% at Target 1 & trailed Stop-Loss to breakeven (${pos.currency_symbol}${pos.entry_price}).`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Portfolio Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* India NSE Family Portfolio Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-bold text-emerald-400">
              India — NSE (National Stock Exchange) Holdings ({inrStats?.active_positions || 0} Active)
            </span>
            <TooltipHelper termKey="friction_tax" plainEnglishMode={plainEnglishMode} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Invested</div>
              <div className="text-base font-bold text-white mt-1">
                ₹{(inrStats?.total_invested || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Current Value</div>
              <div className="text-base font-bold text-white mt-1">
                ₹{(inrStats?.total_current_value || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Gross P&amp;L (Profit and Loss)</div>
              <div
                className={`text-base font-bold mt-1 ${
                  (inrStats?.total_gross_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {(inrStats?.total_gross_pnl || 0) >= 0 ? '+' : ''}₹
                {(inrStats?.total_gross_pnl || 0).toLocaleString()} ({inrStats?.total_return_pct || 0}%)
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30">
              <div className="text-xs text-emerald-300">Net After-Tax P&amp;L (Profit and Loss)</div>
              <div className="text-base font-bold text-emerald-400 mt-1">
                {(inrStats?.total_net_pnl || 0) >= 0 ? '+' : ''}₹
                {(inrStats?.total_net_pnl || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* US Equities Family Portfolio Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-bold text-cyan-400">
              US — NYSE (New York Stock Exchange) Holdings ({usdStats?.active_positions || 0} Active)
            </span>
            <span className="text-xs font-mono text-slate-400">
              3–6 Month Target Tracking
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Invested</div>
              <div className="text-base font-bold text-white mt-1">
                ${(usdStats?.total_invested || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Current Value</div>
              <div className="text-base font-bold text-white mt-1">
                ${(usdStats?.total_current_value || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Gross P&amp;L (Profit and Loss)</div>
              <div
                className={`text-base font-bold mt-1 ${
                  (usdStats?.total_gross_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {(usdStats?.total_gross_pnl || 0) >= 0 ? '+' : ''}$
                {(usdStats?.total_gross_pnl || 0).toLocaleString()} ({usdStats?.total_return_pct || 0}%)
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30">
              <div className="text-xs text-cyan-300">Net After-Tax P&amp;L (Profit and Loss)</div>
              <div className="text-base font-bold text-cyan-400 mt-1">
                {(usdStats?.total_net_pnl || 0) >= 0 ? '+' : ''}$
                {(usdStats?.total_net_pnl || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Owner Filter + Add Position + JSON Backup/Restore */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400 mr-1" />
          {(['ALL', 'Joint', 'Family', 'Saksham'] as const).map((owner) => (
            <button
              key={owner}
              type="button"
              onClick={() => setOwnerFilter(owner)}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                ownerFilter === owner
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-200 hover:text-white border border-slate-800'
              }`}
            >
              {owner === 'ALL' ? 'All Family Holdings' : `${owner} Holdings`}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Position</span>
          </button>

          <button
            type="button"
            onClick={onExportBackup}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-200 flex items-center gap-1.5"
            title="Download a JSON (JavaScript Object Notation) backup of your portfolio"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Download Backup (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-200 flex items-center gap-1.5"
            title="Restore Family Portfolio from a JSON (JavaScript Object Notation) backup file"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Restore Backup (JSON)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = async (ev) => {
                try {
                  const json = JSON.parse(String(ev.target?.result || '{}'));
                  await onImportBackup(json);
                } catch {
                  alert('Invalid backup file');
                }
              };
              reader.readAsText(file);
            }}
          />
        </div>
      </div>

      {/* Positions Grid */}
      {loading ? (
        <div className="p-12 text-center text-base text-slate-300">
          Loading Family Portfolio...
        </div>
      ) : positions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Briefcase className="w-9 h-9 text-slate-500 mx-auto mb-2.5" />
          <div className="text-base font-bold text-white mb-1">
            No positions found for this filter
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Add a position using the button above or from the Stock Analysis &amp; Trade Plan tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {positions.map((pos) => {
            const curr = pos.currency_symbol;
            return (
              <div
                key={pos.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-slate-700 transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-bold border ${getOwnerBadge(
                          pos.owner
                        )}`}
                      >
                        {pos.owner}
                      </span>
                      <h3 className="text-xl font-mono font-bold text-white">
                        {pos.ticker.replace('.NS', '')}
                      </h3>
                      <span className="text-sm text-slate-300 font-medium">
                        — {pos.company_name}
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-xs bg-slate-950 border border-slate-800 text-slate-300">
                        {pos.sector}
                      </span>
                      {pos.partial_booked && (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                          50% Booked at Target 1 (Stop Moved to Breakeven)
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-300 font-mono">
                      <span>
                        Shares: <strong className="text-white">{pos.shares}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Buy Price: <strong className="text-white">{curr}{pos.entry_price.toLocaleString()}</strong> ({pos.entry_date})
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span>Held: {pos.days_held} Days</span>
                      </span>
                    </div>
                  </div>

                  {/* P&L Box */}
                  <div className="flex flex-wrap items-center gap-3.5 font-mono">
                    <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
                      <div className="text-xs text-slate-400">
                        Current Price vs Entry
                      </div>
                      <div className="text-base font-bold text-white">
                        {curr}
                        {pos.current_price.toLocaleString()}
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          pos.pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos.pnl_pct >= 0 ? '+' : ''}
                        {pos.pnl_pct}%
                      </div>
                    </div>

                    <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
                      <div className="text-xs text-slate-400">
                        Net After-Tax P&amp;L (Profit and Loss)
                      </div>
                      <div
                        className={`text-base font-bold ${
                          pos.net_post_friction_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos.net_post_friction_pnl >= 0 ? '+' : ''}
                        {curr}
                        {pos.net_post_friction_pnl.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">
                        Gross: {pos.gross_pnl >= 0 ? '+' : ''}
                        {curr}
                        {pos.gross_pnl.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar: Stop Loss -> Entry -> Target 1 (3M) -> Target 2 (6M) */}
                <div className="my-4">
                  <div className="flex flex-wrap items-center justify-between text-sm mb-2 font-mono">
                    <span className="text-rose-400 flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      <span>Stop-Loss: {curr}{pos.stop_loss_price.toLocaleString()}</span>
                    </span>
                    <span className="text-slate-300">
                      Entry: {curr}{pos.entry_price.toLocaleString()}
                    </span>
                    <span className="text-teal-400 font-bold">
                      3M (3-Month) Target 1: {curr}{pos.target_1_price.toLocaleString()} ({pos.progress_to_t1_pct}%)
                    </span>
                    <span className="text-emerald-400 font-bold">
                      6M (6-Month) Target 2: {curr}{pos.target_2_price.toLocaleString()} ({pos.progress_to_t2_pct}%)
                    </span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(4, pos.progress_to_t2_pct)}%` }}
                    />
                  </div>
                </div>

                {/* Automated Action Alerts & Action Buttons */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {pos.alerts.map((al, i) => (
                      <div
                        key={i}
                        className={`px-3.5 py-2 rounded-xl border text-sm flex items-center gap-2 ${getAlertStyle(
                          al.type
                        )}`}
                      >
                        <span className="font-bold">{al.badge}:</span>
                        <span>{al.message}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {!pos.partial_booked && (
                      <button
                        type="button"
                        onClick={() => handleBookHalfAtT1(pos)}
                        className="px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold text-sm flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Book 50% at Target 1</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectStockForDeepDive(pos.ticker, pos.market)}
                      className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-emerald-400 flex items-center gap-1.5"
                    >
                      <span>View Analysis</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeletePosition(pos.id)}
                      className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-rose-950/50 border border-slate-800 text-slate-300 hover:text-rose-400 text-sm font-medium flex items-center gap-1.5 transition-colors"
                      title="Remove this position from portfolio"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Family Position Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-1">
              Add Position to Family Portfolio
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Track progress toward 3M (3-Month) Target 1 and 6M (6-Month) Target 2.
            </p>

            <div className="grid grid-cols-2 gap-3.5 text-sm">
              <div>
                <label className="text-slate-300 block mb-1">Stock Symbol</label>
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Company Name</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Market</label>
                <select
                  value={newMarket}
                  onChange={(e) => setNewMarket(e.target.value as MarketType)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="INDIA_NSE">India — NSE (National Stock Exchange) (₹)</option>
                  <option value="US_NYSE">US — NYSE (New York Stock Exchange) ($)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Account Owner</label>
                <select
                  value={newOwner}
                  onChange={(e) =>
                    setNewOwner(e.target.value as 'Saksham' | 'Family' | 'Joint')
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Joint">Joint</option>
                  <option value="Family">Family</option>
                  <option value="Saksham">Saksham</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Shares Quantity</label>
                <input
                  type="number"
                  value={newShares}
                  onChange={(e) => setNewShares(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Buy Price</label>
                <input
                  type="number"
                  step="0.05"
                  value={newEntryPrice}
                  onChange={(e) => setNewEntryPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Safety Stop-Loss Price</label>
                <input
                  type="number"
                  step="0.05"
                  value={newStopPrice}
                  onChange={(e) => setNewStopPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-rose-300"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">3M (3-Month) Target 1 Price</label>
                <input
                  type="number"
                  step="0.05"
                  value={newT1Price}
                  onChange={(e) => setNewT1Price(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-teal-300"
                />
              </div>
              <div className="col-span-2">
                <label className="text-slate-300 block mb-1">6M (6-Month) Target 2 Price</label>
                <input
                  type="number"
                  step="0.05"
                  value={newT2Price}
                  onChange={(e) => setNewT2Price(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-emerald-300"
                />
              </div>
              <div className="col-span-2">
                <label className="text-slate-300 block mb-1">Notes</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional trade note..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onCreatePosition({
                    ticker: newTicker,
                    company_name: newCompany,
                    market: newMarket,
                    owner: newOwner,
                    shares: newShares,
                    entry_price: newEntryPrice,
                    stop_loss_price: newStopPrice,
                    target_1_price: newT1Price,
                    target_2_price: newT2Price,
                    notes: newNotes,
                  });
                  setShowAddModal(false);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400"
              >
                Save Position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
