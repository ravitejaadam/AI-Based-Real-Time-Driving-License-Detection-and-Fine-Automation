import React, { useEffect, useMemo, useState } from 'react';
import { Search, Car, Users, RefreshCcw } from 'lucide-react';
import { getVehicles } from '../services/vehiclesService';
import { useAuth } from '../context/AuthContext';

const Vehicles = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVehicles = async () => {
    console.log('Current Role:', user?.role);
    const canViewOwners = ['admin', 'super_admin'].includes(user?.role);
    console.log('Can View Owners:', canViewOwners);
    console.log('Current User:', user);
    console.log('Role:', user?.role);

    setLoading(true);
    setError('');

    try {
      const data = await getVehicles();
      console.log('Vehicles: getVehicles response payload:', data);
      console.log('Vehicles: raw data:', data);
      console.log('Vehicle Query Result:', data);
      console.log('Vehicle Data:', data);
      console.log('Owner Profile:', Array.isArray(data) ? data.map((item) => item.owner || item.owner_profile || item.profiles || null) : null);
      setVehicles(Array.isArray(data) ? data : []);
      console.log('Vehicles: count:', Array.isArray(data) ? data.length : 0);
      console.log('Vehicles: data.length === 0?', Array.isArray(data) && data.length === 0);
    } catch (loadError) {
      console.error('Vehicles: getVehicles error:', loadError);
      setError('Unable to load vehicle records');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Loading vehicles...');
    loadVehicles();
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user) {
      console.log('User logged out, clearing vehicle list state');
      setVehicles([]);
    }
  }, [user]);

  console.log('Vehicles:', vehicles);

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return vehicles;
    }

    return vehicles.filter((vehicle) => {
      return [vehicle.vehicle_number, vehicle.owner_name, vehicle.vehicle_type]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [vehicles, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 mb-2">Vehicle Database</p>
          <h1 className="text-3xl font-bold text-white">Registered Vehicles</h1>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl">
            View the current vehicle registry synced from Supabase.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="bg-surface border border-white/5 rounded-2xl px-4 py-3 min-w-[220px] flex items-center gap-3">
            <Users size={18} className="text-primary" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Total Vehicles</p>
              <p className="text-lg font-bold text-white">{vehicles.length}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadVehicles}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface px-4 py-3 text-sm font-semibold text-gray-200 transition-all hover:bg-white/5"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl p-4 sm:p-5">
        <div className="relative max-w-xl">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search vehicle number, owner name, or vehicle type"
            className="w-full rounded-2xl border border-white/10 bg-background/70 py-3 pl-12 pr-4 text-sm text-white outline-none transition-all placeholder:text-gray-500 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center px-6 py-12 text-gray-400">
            Loading vehicles...
          </div>
        ) : error ? (
          <div className="flex min-h-[280px] items-center justify-center px-6 py-12 text-red-400">
            {error}
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center px-6 py-12 text-gray-400">
            No vehicles found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.25em] text-gray-400">Vehicle Number</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.25em] text-gray-400">Owner Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.25em] text-gray-400">Vehicle Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredVehicles.map((vehicle) => (
                  <tr key={`${vehicle.vehicle_number}-${vehicle.owner_name}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-white">{vehicle.vehicle_number || '---'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{vehicle.owner_name || '---'}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        <Car size={12} />
                        {vehicle.vehicle_type || '---'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Vehicles;