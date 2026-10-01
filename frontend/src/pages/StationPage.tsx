import React, { useState } from 'react';
import { Building2, Clock, Train } from 'lucide-react';

const stationArrivals = [
  {
    trainNo: '12951',
    trainName: 'Mumbai Tejas Rajdhani',
    platform: 'PF 1',
    scheduledTime: '08:32',
    predictedEta: '08:44',
    delay: '+12 min',
    status: 'Arriving in 14 min',
    statusType: 'amber',
    turnaround: 'Normal',
    coaches: 20
  },
  {
    trainNo: '22436',
    trainName: 'Vande Bharat Express',
    platform: 'PF 3',
    scheduledTime: '14:00',
    predictedEta: '14:00',
    delay: 'On Time',
    status: 'Signal Green',
    statusType: 'green',
    turnaround: 'Quick Turn (35m)',
    coaches: 16
  },
  {
    trainNo: '12301',
    trainName: 'Howrah Rajdhani Express',
    platform: 'PF 2',
    scheduledTime: '10:05',
    predictedEta: '10:35',
    delay: '+30 min',
    status: 'Held at Outer Signal',
    statusType: 'red',
    turnaround: 'Delayed Rake',
    coaches: 22
  },
  {
    trainNo: '12004',
    trainName: 'Lucknow Swarna Shatabdi',
    platform: 'PF 4',
    scheduledTime: '06:10',
    predictedEta: '06:12',
    delay: '+2 min',
    status: 'Boarding Open',
    statusType: 'green',
    turnaround: 'Completed',
    coaches: 18
  }
];

export const StationPage: React.FC = () => {
  const [selectedStation, setSelectedStation] = useState('NDLS - New Delhi');

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Station Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Station Master Operations Board</h1>
            <p className="text-xs text-slate-500">Platform Allocation, Dynamic Dwell Estimation & Passenger Screen Sync</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Station:</label>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="text-xs font-semibold bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>NDLS - New Delhi (16 Platforms)</option>
            <option>CNB - Kanpur Central (10 Platforms)</option>
            <option>KOTA - Kota Junction (6 Platforms)</option>
            <option>MMCT - Mumbai Central (8 Platforms)</option>
          </select>
        </div>
      </div>

      {/* Platform Occupancy Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Train className="w-4 h-4 text-blue-600" />
            <span>Platform Real-Time Occupancy Matrix (Simulated)</span>
          </h2>
          <span className="text-xs text-slate-500">12 / 16 Platforms Active</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((pf) => {
            const isOccupied = pf === 1 || pf === 3 || pf === 4;
            const isAlert = pf === 2;
            return (
              <div
                key={pf}
                className={`p-3 rounded-lg border text-center transition-all ${
                  isAlert
                    ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-400/40'
                    : isOccupied
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                <div className="text-[10px] uppercase font-bold tracking-wider">PF {pf}</div>
                <div className="text-xs font-extrabold mt-1">
                  {isAlert ? 'Conflict Risk' : isOccupied ? 'Occupied' : 'Clear'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  {isAlert ? 'PF 2 Delay' : isOccupied ? 'Dwell 18m' : 'Ready'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Arrival Timetable */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Upcoming Train Inbound Stream & Dynamic ETA</span>
          </h2>
          <span className="text-xs px-2.5 py-1 rounded bg-teal-100 text-teal-800 font-semibold font-mono">
            PAS Screen Sync: Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Train No & Name</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4">Scheduled</th>
                <th className="py-3 px-4">Predicted ETA</th>
                <th className="py-3 px-4">Delay Factor</th>
                <th className="py-3 px-4">Operational Status</th>
                <th className="py-3 px-4">Turnaround</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {stationArrivals.map((train) => (
                <tr key={train.trainNo} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                        {train.trainNo}
                      </span>
                      <span className="font-semibold text-slate-800">{train.trainName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{train.platform}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 line-through">{train.scheduledTime}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700 text-sm">{train.predictedEta}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        train.statusType === 'green'
                          ? 'bg-green-100 text-green-800'
                          : train.statusType === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {train.delay}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{train.status}</td>
                  <td className="py-3.5 px-4 text-slate-500">{train.turnaround}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
