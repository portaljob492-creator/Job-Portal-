import React, { useState } from 'react';
import { UserProfile } from '../../types';

interface ProfileEditorProps {
  profile: UserProfile;
  onUpdate: (updatedProfile: UserProfile) => void;
  onCancel: () => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    name: profile.name,
    phone: profile.phone,
    specialties: profile.specialties?.join(', ') || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...profile,
      name: formData.name,
      phone: formData.phone,
      specialties: formData.specialties.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Edit Profile</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Specializations (comma separated)</label>
        <input
          type="text"
          value={formData.specialties}
          onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};
