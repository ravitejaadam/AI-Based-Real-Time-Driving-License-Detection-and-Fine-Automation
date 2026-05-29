import React from 'react';
import { 
  Car, 
  AlertTriangle, 
  ShieldAlert, 
  Users, 
  CreditCard, 
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const data = [
  { name: '00:00', vehicles: 400, violations: 24 },
  { name: '04:00', vehicles: 300, violations: 13 },
  { name: '08:00', vehicles: 900, violations: 98 },
  { name: '12:00', vehicles: 1200, violations: 145 },
  { name: '16:00', vehicles: 1500, violations: 210 },
  { name: '20:00', vehicles: 1100, violations: 120 },
  { name: '23:59', vehicles: 600, violations: 45 },
];

const violationData = [
  { name: 'Helmet', value: 456, color: '#3b82f6' },
  { name: 'Triple Riding', value: 234, color: '#ef4444' },
  { name: 'Invalid License', value: 123, color: '#f59e0b' },
  { name: 'Speeding', value: 567, color: '#8b5cf6' },
];

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color }) => (
  <div className="bg-surface border border-white/5 rounded-2xl p-6 hover:border-primary/20 transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500`}>
        <Icon size={24} />
      </div>
      <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
        {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {trendValue}%
      </div>
    </div>
    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-gray-400 mt-1">Real-time traffic monitoring statistics and insights.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-surface border border-white/10 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
            Download Report
          </button>
          <button className="bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Live Feed
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Vehicles" value="12,458" icon={Car} trend="up" trendValue="12" color="blue" />
        <StatCard title="Total Violations" value="1,284" icon={AlertTriangle} trend="up" trendValue="8" color="red" />
        <StatCard title="Helmet Violations" value="456" icon={ShieldAlert} trend="down" trendValue="3" color="amber" />
        <StatCard title="Triple Riding" value="234" icon={Users} trend="up" trendValue="15" color="purple" />
        <StatCard title="Invalid License" value="123" icon={CreditCard} trend="down" trendValue="2" color="emerald" />
        <StatCard title="Total Fine" value="$45,670" icon={TrendingUp} trend="up" trendValue="24" color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-surface border border-white/5 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity size={20} className="text-primary" />
              Traffic Density vs Violations
            </h3>
            <select className="bg-background border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="vehicles" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVehicles)" />
                <Area type="monotone" dataKey="violations" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorViolations)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Violation Distribution */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-8">Violation Types</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={violationData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}
                  cursor={{ fill: '#ffffff05' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {violationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-lg font-bold">Recent Detection Log</h3>
          <button className="text-primary text-sm font-medium hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/5 text-left">
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Violation Type</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fine Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { id: 'MH-12-BK-5678', type: 'No Helmet', time: '2 mins ago', status: 'Pending', fine: '$50' },
                { id: 'KA-01-MJ-2345', type: 'Triple Riding', time: '15 mins ago', status: 'Verified', fine: '$100' },
                { id: 'DL-4C-NA-9012', type: 'Speeding', time: '34 mins ago', status: 'Pending', fine: '$150' },
                { id: 'HR-26-AB-3456', type: 'No Helmet', time: '1 hour ago', status: 'Rejected', fine: '$0' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-white">{row.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      row.type === 'No Helmet' ? 'bg-amber-500/10 text-amber-500' : 
                      row.type === 'Triple Riding' ? 'bg-purple-500/10 text-purple-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{row.time}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium ${
                      row.status === 'Verified' ? 'text-green-500' : 
                      row.status === 'Pending' ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white font-bold">{row.fine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
