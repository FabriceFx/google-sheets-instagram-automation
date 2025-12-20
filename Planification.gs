/**
 * @fileoverview Module de planification automatique du contenu.
 * Distribue le contenu en attente sur la semaine à venir.
 */

// ==========================================
// CONFIGURATION DE LA PLANIFICATION
// ==========================================

const CONFIG_PLANNING = {
  FUSEAU_HORAIRE: 'Europe/Paris', // Force le fuseau horaire français
  JOURS_A_PLANIFIER: 7,
  CRENEAUX: {
    MATIN: { heure: 11, minute: 0 }, // 11h00 (Reel)
    APRES_MIDI: { heure: 16, minute: 0 }, // 16h00 (Reel)
    SOIREE: { heure: 19, minute: 0 }  // 19h00 (Image)
  }
};

/**
 * Remplit automatiquement la colonne "planifie_pour_local" pour les 7 prochains jours.
 * Stratégie :
 * - 1 IMAGE à 19h00
 * - 1 REEL à 11h00
 * - 1 REEL à 16h00
 * * Filtre optionnel par compte (ex: lancer pour un client spécifique).
 * @param {string} filtreCompte - (Optionnel) Clé du compte à traiter (ex: 'CLIENT_A').
 */
function planifierSemaineSuivante(filtreCompte = '') {
  console.time('PlanificationSemaine');
  console.log('=== DÉBUT DE LA PLANIFICATION AUTOMATIQUE ===');

  try {
    const table = lireTableau_(CONFIGURATION.FEUILLES.FILE_ATTENTE);
    const feuille = table.feuille;
    const idx = table.indexEntetes;
    
    // Indices des colonnes (pour écriture directe)
    const colPlanif = idx.planifie_pour_local;

    // Collecte des lignes non planifiées
    const lignesImages = [];
    const lignesReels = [];

    table.lignes.forEach((ligne, i) => {
      const numeroLigne = i + 2;
      const cleCompte = String(ligne.cle_compte || '').trim();
      const typeMedia = String(ligne.type_media || '').toUpperCase();
      const typePlateforme = String(ligne.type_plateforme || '').toUpperCase();
      const datePlanif = ligne.planifie_pour_local;

      // Filtres
      if (filtreCompte && cleCompte !== filtreCompte) return;
      if (datePlanif && String(datePlanif).trim() !== '') return; // Déjà planifié
      if (estLigneVide_(ligne)) return;

      // Catégorisation
      const estImage = (typeMedia === 'IMAGE');
      // On considère comme Reel si type_media est VIDEO ou plateforme IG_REEL
      const estReel = (typeMedia === 'VIDEO' || typePlateforme === 'IG_REEL');

      if (estImage) {
        lignesImages.push(numeroLigne);
      } else if (estReel) {
        lignesReels.push(numeroLigne);
      }
    });

    console.log(`Lignes à planifier -> Images: ${lignesImages.length}, Reels: ${lignesReels.length}`);

    // Itération sur les 7 prochains jours
    let curseurImage = 0;
    let curseurReel = 0;

    for (let d = 0; d < CONFIG_PLANNING.JOURS_A_PLANIFIER; d++) {
      // 1. Créneau SOIRÉE (Priorité aux Images)
      if (curseurImage < lignesImages.length) {
        const ligneCible = lignesImages[curseurImage++];
        const dateCible = creerDateLocale_(d, CONFIG_PLANNING.CRENEAUX.SOIREE);
        
        feuille.getRange(ligneCible, colPlanif).setValue(dateCible);
        console.log(`[J+${d}] Image (Ligne ${ligneCible}) planifiée à ${dateCible.toLocaleString('fr-FR')}`);
      }

      // 2. Créneau MATIN (Priorité aux Reels)
      if (curseurReel < lignesReels.length) {
        const ligneCible = lignesReels[curseurReel++];
        const dateCible = creerDateLocale_(d, CONFIG_PLANNING.CRENEAUX.MATIN);
        
        feuille.getRange(ligneCible, colPlanif).setValue(dateCible);
        console.log(`[J+${d}] Reel Matin (Ligne ${ligneCible}) planifié à ${dateCible.toLocaleString('fr-FR')}`);
      }

      // 3. Créneau APRÈS-MIDI (Reels supplémentaires)
      if (curseurReel < lignesReels.length) {
        const ligneCible = lignesReels[curseurReel++];
        const dateCible = creerDateLocale_(d, CONFIG_PLANNING.CRENEAUX.APRES_MIDI);
        
        feuille.getRange(ligneCible, colPlanif).setValue(dateCible);
        console.log(`[J+${d}] Reel Aprèm (Ligne ${ligneCible}) planifié à ${dateCible.toLocaleString('fr-FR')}`);
      }
    }

  } catch (e) {
    console.error(`Erreur lors de la planification : ${e.message}`);
  }

  console.log('=== FIN DE LA PLANIFICATION ===');
  console.timeEnd('PlanificationSemaine');
}

/**
 * Utilitaire pour créer une date précise dans le futur.
 * @param {number} decalageJours - Nombre de jours à ajouter (0 = demain, car on commence à J+1).
 * @param {Object} heureCible - { heure, minute }
 * @return {Date} Date configurée.
 */
function creerDateLocale_(decalageJours, heureCible) {
  const date = new Date();
  
  // Réinitialisation à aujourd'hui minuit pour calcul propre
  date.setHours(0, 0, 0, 0); 
  
  // On commence la planification à partir de demain (J+1)
  date.setDate(date.getDate() + 1 + decalageJours);
  
  // Application de l'horaire
  date.setHours(heureCible.heure, heureCible.minute, 0, 0);
  
  return date;
}
