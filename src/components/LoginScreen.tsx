import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { SamcheLogo } from './SamcheLogo';
import { api } from '../services/googleSheet';

interface LoginScreenProps {
  onLogin: (user: {username: string, role: UserRole}) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [gsheetUrl, setGsheetUrl] = useState(() => localStorage.getItem('gsheet_webapp_url') || '');

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.listerUtilisateurs();
        console.log('API Response for users:', res);
        if (res.success && Array.isArray(res.data)) {
          console.log('User data content:', res.data);
          if (res.data.length > 0) {
            console.log('Keys of first user object:', Object.keys(res.data[0]));
          }
          setUsers(res.data);
        } else {
          console.warn('API fetch failed, falling back to demo users.');
          setUsers([
            { username: 'Cheick', password: '123', role: 'admin' },
            { username: 'Samba', password: '432', role: 'admin' },
            { username: 'Amara', password: 'a1111', role: 'utilisateur' },
            { username: 'Ousmane', password: 'o8801', role: 'utilisateur' },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch users', err);
        setUsers([
          { username: 'Cheick', password: '123', role: 'admin' },
          { username: 'Samba', password: '432', role: 'admin' },
          { username: 'Amara', password: 'a1111', role: 'utilisateur' },
          { username: 'Ousmane', password: 'o8801', role: 'utilisateur' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await api.authentifier({ username, password });
      console.log('Auth API Response:', res);
      
      // Based on logs, the structure is res.data.user
      const user = res.data?.user;
      if (res.success && user) {
        onLogin({username: user.username, role: user.role as UserRole});
      } else {
        setError('Identifiant ou mot de passe incorrect');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    onLogin({username: 'Mode Démo', role: 'admin'});
  };

  const saveConfig = () => {
    localStorage.setItem('gsheet_webapp_url', gsheetUrl);
    setShowConfig(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center">
        <SamcheLogo className="w-20 h-20 mb-6" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">COUVOIR</h1>
        <h2 className="text-xl font-bold text-orange-500 mb-6">SAMCHE</h2>
        
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Connexion</h3>
        <p className="text-sm text-slate-500 mb-8">Accedez a votre espace de gestion</p>
        
        {loading ? (
          <p className="text-sm text-slate-500">Chargement...</p>
        ) : showConfig ? (
          <div className="w-full">
            <h3 className="text-sm font-semibold mb-4 text-slate-700">Configurer URL API</h3>
            <input 
              type="text" 
              value={gsheetUrl} 
              onChange={(e) => setGsheetUrl(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm mb-4"
              placeholder="https://script.google.com/..."
            />
            <button onClick={saveConfig} className="w-full py-3 bg-blue-600 text-white rounded-xl mb-2">Enregistrer</button>
            <button onClick={() => setShowConfig(false)} className="w-full py-2 text-slate-500 text-xs underline">Annuler</button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="w-full">
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NOM D'UTILISATEUR</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Votre identifiant"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MOT DE PASSE</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Votre mot de passe"
                autoComplete="current-password"
              />
            </div>
            
            {error && <p className="text-red-500 text-xs mb-4 text-center">{error}</p>}
            
            <button 
              type="submit" 
              className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition mb-2"
            >
              Se connecter
            </button>
            <button 
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-3 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-200 transition mb-4"
            >
              Mode Démo (Admin)
            </button>
          </form>
        )}
        
        <div className="flex justify-between w-full">
          <button className="text-xs text-slate-400 hover:underline">Mot de passe oublié ?</button>
          <button onClick={() => setShowConfig(true)} className="text-xs text-blue-600 hover:underline">Configurer API</button>
        </div>
        <p className="text-[10px] text-slate-300 mt-8">Couvoir SAMCHE — Gestion</p>
      </div>
    </div>
  );
};
