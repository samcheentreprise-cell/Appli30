import { AdminNotification, UserRole } from '../types';
import { DEFAULT_ADMIN_EMAILS, sendAdminNotificationEmail } from '../services/googleSheet';

const DEFAULT_ADMIN_EMAIL = DEFAULT_ADMIN_EMAILS[0];

/**
 * Envoie une notification email aux administrateurs via GAS.
 * Aucune persistance locale — tout se passe côté serveur.
 */
export const addAdminNotification = async (
  type: AdminNotification['type'],
  titre: string,
  message: string,
  auteur: string,
  role: UserRole,
  idSoumission?: string,
  idLot?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const subject = `Notification Couvoir SAMCHE : ${titre}`;
    const text =
      `${message}\n\n` +
      `Auteur : ${auteur} (${role})\n` +
      `Lot concerné : ${idLot || 'N/A'}\n` +
      `Soumission : ${idSoumission || 'N/A'}\n` +
      `Type : ${type}\n` +
      `Date : ${new Date().toLocaleString('fr-FR')}`;

    const res = await sendAdminNotificationEmail(subject, text);
    if (!res.success) {
      console.error('[notifications] Échec envoi email GAS:', res.message);
    } else {
      console.log('[notifications] ✅ Email envoyé aux administrateurs via GAS:', res.message);
    }
    return { success: res.success, message: res.message };
  } catch (e: any) {
    console.error('[notifications] Exception envoi email:', e);
    return { success: false, message: e?.message || 'Erreur inconnue' };
  }
};

/** @deprecated Les notifications sont désormais dérivées des soumissions (online). */
export const getAdminNotifications = (): AdminNotification[] => [];

/** @deprecated Ne fait rien — les notifications sont online. */
export const markNotificationAsRead = (_id: string) => {
  /* no-op — notifications sont online via GAS */
};

/** @deprecated Ne fait rien — les notifications sont online. */
export const deleteNotification = (_id: string) => {
  /* no-op — notifications sont online via GAS */
};

// Export par défaut de l'email admin par défaut (référence uniquement)
export const DEFAULT_ADMIN_NOTIFICATION_EMAIL = DEFAULT_ADMIN_EMAIL;
