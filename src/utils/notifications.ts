import { AdminNotification, UserRole } from '../types';
import { callApi } from '../services/googleSheet';

const DEFAULT_ADMIN_EMAIL = 'couvoirsamche@gmail.com';

// ============================================================
// ✅ ANOMALIE CORRIGÉE — AUCUN CACHE LOCAL
// -------------------------------------------------------------
// Avant : les notifications étaient persistées dans localStorage
// (clé `admin_notifications`) et les emails des administrateurs
// dans localStorage (clé `alert_emails`). Conséquence : après
// validation/rejet côté serveur, la notification restait affichée
// en local jusqu'au prochain refresh, et les emails n'étaient
// pas synchronisés entre les postes.
//
// Maintenant : TOUT est en ligne.
//  - Les notifications affichées dans le menu ⚙️ sont DÉRIVÉES
//    des soumissions synchronisées depuis Google Sheets (voir
//    App.tsx — `adminNotifications` est un useMemo sur soumissions).
//  - Les emails administrateurs sont configurés côté SERVEUR
//    (Google Apps Script → Project Settings → Script Properties
//    → clé `emails_admins`, valeurs séparées par virgules).
//  - Cette fonction ne fait qu'envoyer l'email via GAS
//    (`notifications.envoyer` → MailApp natif). Si les
//    destinataires ne sont pas fournis, GAS utilise
//    automatiquement `_getEmailsAdmins()` (config server-side).
// ============================================================

/**
 * Envoie une notification email aux administrateurs via GAS.
 * Aucune persistance locale — tout se passe côté serveur.
 *
 * @param type Type de notification (Commande, Mirage, Éclosion, etc.)
 * @param titre Sujet court
 * @param message Corps de l'email
 * @param auteur Utilisateur qui a déclenché la notification
 * @param role Rôle de l'auteur
 * @param idSoumission Référence à la soumission liée (optionnel)
 * @param idLot ID OAC concerné (optionnel)
 */
export const addAdminNotification = async (
  type: AdminNotification['type'],
  titre: string,
  message: string,
  auteur: string,
  role: UserRole,
  idSoumission?: string,
  idLot?: string
): Promise<void> => {
  // ✅ Envoi de l'email aux administrateurs via GAS (MailApp natif).
  //    On ne passe pas `destinataires` : GAS utilise automatiquement
  //    sa config server-side (`emails_admins` script property).
  try {
    const result = await callApi(
      'notifications.envoyer',
      {
        subject: `Notification Couvoir SAMCHE : ${titre}`,
        text:
          `${message}\n\n` +
          `Auteur : ${auteur} (${role})\n` +
          `Lot concerné : ${idLot || 'N/A'}\n` +
          `Soumission : ${idSoumission || 'N/A'}\n` +
          `Type : ${type}`,
        // Pas de destinataires → GAS utilise _getEmailsAdmins()
        destinataires: [],
      },
      'POST'
    );

    const ok =
      !!result?.success &&
      result?.data?.succes !== false &&
      result?.data?.success !== false;

    if (!ok) {
      console.error('[notifications] Échec envoi email GAS:', result);
    } else {
      console.log('[notifications] ✅ Email envoyé aux administrateurs via GAS');
    }
  } catch (e) {
    console.error('[notifications] Exception envoi email:', e);
  }
};

// ============================================================
// Les fonctions suivantes étaient utilisées pour la persistance
// locale des notifications. Elles sont désormais OBSOLÈTES car
// les notifications sont dérivées des soumissions (online via GAS).
// On garde des no-ops pour préserver la compatibilité descendante
// des composants qui les appellent encore.
// ============================================================

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
