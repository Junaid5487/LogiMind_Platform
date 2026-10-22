import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Truck, Warehouse, Factory, MapPin } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  license_number: string;
  vehicle_name: string;
}

const DRIVERS: Driver[] = [
  { id: 'DRV-01', name: 'Rahul Sharma', license_number: 'MH-04-2022-0094821', vehicle_name: 'Tata Prima 5530.S' },
  { id: 'DRV-02', name: 'Amit Varma', license_number: 'MH-12-2023-0182743', vehicle_name: 'Mahindra Treo Zor EV' },
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  dollar_savings?: number;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, dollar_savings }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
      <div className='glass-panel w-full max-w-md p-6 rounded-2xl border border-gray-800 space-y-6'>
        <div className='flex items-center justify-between'>
          <h3 className='text-base font-bold text-white'>LogiMind</h3>
          <button onClick={onClose} className='p-1 text-gray-400 hover:text-white'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <div>
          <h4 className='text-xs text-gray-300 font-semibold uppercase tracking-wider'>Carbon Savings</h4>
          <p className='text-xl font-bold text-sky-400'>{(dollar_savings ?? 19.90)}</p>
          <p className='text-xs text-gray-400'>dollar savings from route optimization</p>
        </div>

        <div>
          <h4 className='text-xs text-gray-300 font-semibold uppercase tracking-wider'>Driver Roster</h4>
          <p className='text-xs text-gray-400 mb-3'>
            Click on a driver name to view their details
          </p>
          <div className='space-y-1'>
            {DRIVERS.map((driver) => (
              <div
                key={driver.id}
                onClick={() => onClose()}
                className={['px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 hover:bg-gray-800 cursor-pointer text-sm transition-colors', user?.driver_name === driver.name ? 'bg-sky-500 border-sky-500 text-white' : ''].join(' ')}
                style={{ cursor: 'pointer' }}
              >
                <span className='font-medium text-white'>{driver.name}</span>
                {user?.driver_name === driver.name && (
                  <span className='ml-2 text-green-400 text-xs'>&#10003; Active</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {user?.driver_name && (
          <div className='mt-4 p-4 rounded-xl bg-gray-900 border border-gray-700'>
            <h5 className='text-semibold text-white mb-3'>Driver Details</h5>
            <div className='grid grid-cols-2 gap-4 text-sm'>
              <div>
                <p className='text-xs text-gray-300 mb-1'>Name</p>
                <p className='font-medium text-white'>{user.driver_name}</p>
              </div>
              <div>
                <p className='text-xs text-gray-300 mb-1'>License</p>
                <p className='font-medium text-white'>{user.license_number || 'N/A'}</p>
              </div>
              <div>
                <p className='text-xs text-gray-300 mb-1'>Assigned Vehicle</p>
                <p className='font-medium text-white'>{user.vehicle_name || 'N/A'}</p>
              </div>
              <div>
                <p className='text-xs text-gray-300 mb-1'>Driver ID</p>
                <p className='font-medium text-white'>{user.driver_id || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {user?.driver_name && (
          <button
            onClick={() => onClose()}
            className='w-full py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold transition-colors'
          >
            Logout
          </button>
        )}

        {!user?.driver_name && (
          <button
            onClick={() => onClose()}
            className='w-full py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition-colors'
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};
