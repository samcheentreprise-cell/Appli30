import React, { useState } from 'react';
import { Client } from '../types';
import { Users, Plus, Search, Phone, Mail, MapPin } from 'lucide-react';

interface ClientsModuleProps {
  clients: Client[];
  onAddClient: (client: Client) => void;
}

export const ClientsModule: React.FC<ClientsModuleProps> = ({
  clients,
  onAddClient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('Toutes');
  const [isOpenModal, setIsOpenModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Client>>({
    prenom: '',
    nom: '',
    ville: 'Bamako',
    telephone: '',
    email: '',
  });

  const cities = ['Toutes', ...Array.from(new Set(clients.map((c) => c.ville || 'Bamako'))).filter(Boolean)];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom) return;

    const label = `${formData.prenom || ''} ${formData.nom}`.trim();
    const newClient: Client = {
      index: clients.length + 2,
      prenom: formData.prenom || '',
      nom: formData.nom,
      ville: formData.ville || 'Bamako',
      telephone: formData.telephone || '',
      email: formData.email || '',
      label,
    };

    onAddClient(newClient);
    setIsOpenModal(false);
    setFormData({
      prenom: '',
      nom: '',
      ville: 'Bamako',
      telephone: '',
      email: '',
    });
  };

  const filteredClients = clients.filter((c) => {
    const matchSearch =
      c.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telephone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ville.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCity = selectedCity === 'Toutes' || c.ville === selectedCity;
    return matchSearch && matchCity;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs tracking-wider uppercase">
            <Users className="w-4 h-4" />
            <span>Répertoire Commercial</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mt-1">
            Fichier Clients & Éleveurs
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Base de données des clients aviculteurs au Mali, coordonnées téléphoniques directes et localisations.
          </p>
        </div>

        <button
          onClick={() => setIsOpenModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl transition shadow-md text-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Rechercher nom, prénom, numéro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none"
          >
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Total : <strong className="text-slate-900">{filteredClients.length}</strong> clients affichés
        </div>
      </div>

      {/* Grid of Clients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                    {client.label}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{client.ville || 'Bamako, Mali'}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center border border-emerald-200/50">
                  {client.nom ? client.nom.slice(0, 2).toUpperCase() : 'CL'}
                </div>
              </div>

              {client.email && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              {client.telephone ? (
                <a
                  href={`tel:${client.telephone}`}
                  className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-emerald-200"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{client.telephone}</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">Pas de téléphone</span>
              )}

              <span className="text-[11px] font-semibold text-slate-400">
                Client #{client.index || idx + 1}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Client */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Nouveau Client</h3>
              </div>
              <button
                onClick={() => setIsOpenModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    placeholder="ex: Soumi"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nom / Ferme</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Maiga"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                <input
                  type="text"
                  placeholder="ex: 74478880 ou +223..."
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ville / Localité</label>
                <input
                  type="text"
                  placeholder="ex: Bamako, Koutiala, Sikasso..."
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email (optionnel)</label>
                <input
                  type="email"
                  placeholder="client@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-md"
                >
                  Enregistrer le Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
