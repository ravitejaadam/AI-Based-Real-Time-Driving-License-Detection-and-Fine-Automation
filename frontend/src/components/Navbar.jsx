import React from 'react';
import { Search, Bell, User, Circle } from 'lucide-react';

const Navbar = () => {
  return (
    <header className="h-16 bg-background/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search vehicles, violations..."
            className="w-full bg-surface border border-white/5 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <Circle className="fill-green-500 text-green-500" size={8} />
          <span className="text-xs font-medium text-green-500 uppercase tracking-wider">System Live</span>
        </div>

        <button className="relative text-gray-400 hover:text-white transition-colors">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border-2 border-background"></span>
        </button>

        <div className="h-8 w-px bg-white/5 mx-2"></div>

        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white group-hover:text-primary transition-colors">Admin Panel</p>
            <p className="text-[10px] text-gray-500">Security Officer</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-surface border border-white/10 flex items-center justify-center text-primary group-hover:border-primary/50 transition-all">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
