import React, { useState } from 'react';
import { UserRole } from '../types';
import { api } from '../services/googleSheet';
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

    try {
      // ✅ Authentification via Google Sheets (priorité)
      const response = await api.authentifier({ username, password });

      // Le GAS retourne { success, data: { user: { username, role } } }
      // ou { success, user: { username, role } } selon la version
      if (response?.success) {
        const userData = response.data?.user || response.data || response.user;
        if (userData && userData.username) {
          onLogin({
            username: userData.username,
            role: userData.role as UserRole
          });
          return;
        }
      }

      // ⚠️ Si le GAS échoue (indisponible ou utilisateur introuvable), fallback local
      console.warn('[Login] GAS indisponible ou utilisateur non trouvé, fallback local');
      const localUser = authenticateUser(username, password);

      if (localUser) {
        onLogin({
          username: localUser.username,
          role: localUser.role as UserRole
        });
      } else {
        setError('Identifiant ou mot de passe incorrect');
      }
    } catch (err) {
      console.error('[Login] Auth error:', err);

      // Fallback local en cas d'erreur réseau
      try {
        const { authenticateUser } = await import('../data/users');
        const localUser = authenticateUser(username, password);

        if (localUser) {
          onLogin({
            username: localUser.username,
            role: localUser.role as UserRole
          });
        } else {
          setError('Erreur de connexion au serveur');
        }
      } catch {
        setError('Erreur de connexion au serveur');
      }
    } finally {
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
        <p className="text-sm text-slate-500 mb-8">Accédez à votre espace de gestion</p>

        {loading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-slate-500">Vérification...</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="w-full">
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                NOM D'UTILISATEUR
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Votre identifiant"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                MOT DE PASSE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-600 text-xs text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition mb-4"
            >
              Se connecter
            </button>
          </form>
        )}

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
