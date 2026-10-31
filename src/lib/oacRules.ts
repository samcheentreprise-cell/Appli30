import { UserRole } from '../types';

let currentUser: { username: string; role: UserRole } | null = null;

export const setCurrentUser = (user: { username: string; role: UserRole } | null) => {
  currentUser = user;
};

export const getCurrentUser = () => currentUser;

export const oacErrorMessage = (code: string, defaultMessage: string) => {
  if (code === 'COMMANDE_VERROUILLEE') {
    return 'Cette commande est verrouillée par un administrateur et ne peut être modifiée.';
  }
  return defaultMessage;
};

export const estVerrouillee = async (idCommande: string) => {
  return { 
    success: true, 
    data: { 
        verrouillee: false,
        validePar: undefined,
        valideLe: undefined
    } 
  };
};

// Placeholder components for OacLockBadge and OacLockButton
export const OacLockBadge = ({ idCommande }: { idCommande: string }) => null;
export const OacLockButton = ({ idCommande }: { idCommande: string }) => null;
export const useIsAdmin = () => false;
