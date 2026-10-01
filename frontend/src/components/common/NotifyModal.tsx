import React, { useState } from 'react';
import { Bell, Check, X, Smartphone, MessageSquare, ShieldCheck, Clock } from 'lucide-react';

interface NotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainId: string;
  trainName: string;
  stationName: string;
  onNotifySuccess?: (message: string) => void;
}

export const NotifyModal: React.FC<NotifyModalProps> = ({
  isOpen,
  onClose,
  trainId,
  trainName,
  stationName,
  onNotifySuccess,
}) => {
  const [phone, setPhone] = useState('+91 98765 43210');
  const [notifyType, setNotifyType] = useState<'whatsapp' | 'sms' | 'both'>('both');
  const [leadTime, setLeadTime] = useState<'15' | '30' | 'delay'>('15');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
      if (onNotifySuccess) {
        onNotifySuccess(
          `Notification alert set for ${trainName} (${trainId}) arriving at ${stationName}! You will receive ${notifyType.toUpperCase()} updates.`
        );
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B1F3A] to-[#1E3A8A] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Train Arrival Alerts</h3>
              <p className="text-xs text-slate-300">Smart AI Delay & ETA Notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
            <div className="font-semibold text-blue-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Monitoring target: <strong>{stationName}</strong></span>
            </div>
            <p className="text-slate-600">
              Train <span className="font-mono font-bold text-slate-900">{trainId}</span> ({trainName}). You will receive proactive updates if speed restrictions or signal halts alter the dynamic ETA.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mobile Number for SMS & WhatsApp Alerts
            </label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Notification Channel</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNotifyType('whatsapp')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  notifyType === 'whatsapp'
                    ? 'border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setNotifyType('sms')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  notifyType === 'sms'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                SMS
              </button>
              <button
                type="button"
                onClick={() => setNotifyType('both')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  notifyType === 'both'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Check className="w-3.5 h-3.5 text-indigo-600" />
                Both (Recommended)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Alert Trigger Condition</label>
            <select
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="15">Notify 15 minutes before arrival at {stationName}</option>
              <option value="30">Notify 30 minutes before arrival at {stationName}</option>
              <option value="delay">Notify whenever ETA changes by ±5 minutes or more</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Registering...' : 'Confirm Alert'}</span>
            </button>
          </div>

          <div className="text-[10px] text-center text-slate-400">
            Prototype demo mode: notifications simulated locally without toll charges.
          </div>
        </form>

      </div>
    </div>
  );
};
