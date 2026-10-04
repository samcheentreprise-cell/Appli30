import React, { useState } from 'react';
import { UserRole } from '../types';
import { authenticateUser } from '../data/users';

interface LoginScreenProps {
  onLogin: (user: {username: string, role: UserRole}) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Simuler un léger délai réseau
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = authenticateUser(username, password);
    
    if (user) {
      onLogin({username: user.username, role: user.role as UserRole});
    } else {
      setError('Identifiant ou mot de passe incorrect');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center">
        <img src="/logo-samche.jpg" alt="Logo SamChe" className="w-24 h-24 mb-6 object-contain" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">COUVOIR</h1>
        <h2 className="text-xl font-bold text-orange-500 mb-6">SAMCHE</h2>
        
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Connexion</h3>
        <p className="text-sm text-slate-500 mb-8">Accedez a votre espace de gestion</p>
        
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
            disabled={loading}
            className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition mb-4 disabled:bg-slate-400"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        
        <div className="flex justify-center w-full">
          <button 
            onClick={() => alert("Veuillez contacter l'administrateur (Cheick ou Samba) pour réinitialiser votre mot de passe.")}
            className="text-xs text-slate-400 hover:underline"
          >
            Mot de passe oublié ?
          </button>
        </div>
        <p className="text-[10px] text-slate-300 mt-8">Couvoir SAMCHE — Gestion</p>
      </div>
    </div>
  );
};
