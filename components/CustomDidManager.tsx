import React, { useState } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { CustomDidDefinition } from '../types';
import { Trash2, Plus, Save } from 'lucide-react';

export const CustomDidManager: React.FC = () => {
    const customDids = useVehicleStore(state => state.customDids);
    const addCustomDid = useVehicleStore(state => state.addCustomDid);
    const removeCustomDid = useVehicleStore(state => state.removeCustomDid);
    const [newDid, setNewDid] = useState<Partial<CustomDidDefinition>>({ did: '', name: '', bytes: 1, scaling: 1, offset: 0, signed: false });

    const handleAdd = () => {
        if (newDid.did && newDid.name) {
            addCustomDid({
                id: Date.now().toString(),
                did: newDid.did,
                name: newDid.name,
                description: newDid.description || '',
                bytes: newDid.bytes || 1,
                unit: newDid.unit || '',
                scaling: newDid.scaling || 1,
                offset: newDid.offset || 0,
                signed: !!newDid.signed
            });
            setNewDid({ did: '', name: '', bytes: 1, scaling: 1, offset: 0, signed: false });
        }
    };

    return (
        <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-6 text-white">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Custom DID Management</h2>
            
            <div className="space-y-4 mb-6">
                <input placeholder="DID (e.g. 0101)" className="w-full bg-[#111] p-2 border border-white/10 rounded" value={newDid.did} onChange={e => setNewDid({...newDid, did: e.target.value})} />
                <input placeholder="Name" className="w-full bg-[#111] p-2 border border-white/10 rounded" value={newDid.name} onChange={e => setNewDid({...newDid, name: e.target.value})} />
                <button onClick={handleAdd} className="w-full bg-brand-cyan text-black font-bold py-2 rounded flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add DID
                </button>
            </div>

            <div className="space-y-2">
                {customDids.map(did => (
                    <div key={did.id} className="flex items-center justify-between bg-[#111] p-3 rounded">
                        <span>{did.name} ({did.did})</span>
                        <button onClick={() => removeCustomDid(did.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};
