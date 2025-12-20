/**
 * @fileoverview Système d'automatisation de contenu Instagram pour Google Sheets.
 * @author Fabrice Faucheux
 * @version 2.0 
 */

// ==========================================
// CONFIGURATION GLOBALE
// ==========================================

const CONFIGURATION = {
  VERSION_GRAPH: 'v24.0',
  FEUILLES: {
    COMPTES: 'IG_Comptes',      // Anciennement IG_Accounts
    FILE_ATTENTE: 'IG_File_Attente', // Anciennement IG_Queue
    JOURNAL: 'IG_Journal',      // Anciennement IG_Log
    JOURNAL_POSTS: 'IG_Journal_Publications'
  },
  DELAI_SONDAGE_MS: 10000,      // 10 secondes entre les vérifications de statut
  MAX_TENTATIVES: 8             // Nombre max de tentatives pour le traitement vidéo
};

// ==========================================
// POINTS D'ENTRÉE PRINCIPAUX
// ==========================================

/**
 * Fonction principale déclenchée par un trigger temporel (ex: toutes les 15 min).
 * Scanne la file d'attente et publie les contenus prêts.
 */
function traiterFileAttenteInstagram() {
  console.time('TraitementFileAttente');
  journaliserAction_('', '', 'traiterFileAttente', 'DEBUT', '', '', '', '');

  try {
    const maintenant = new Date();
    const tableFile = lireTableau_(CONFIGURATION.FEUILLES.FILE_ATTENTE);
    
    // Si la feuille est vide, on arrête
    if (tableFile.lignes.length === 0) {
      console.log('Aucune ligne dans la file d\'attente.');
      return;
    }

    // Récupération des comptes actifs en une seule fois (Batch optimization)
    const carteComptes = construireCarteComptes_();

    // Mapping des index de colonnes pour accès rapide
    const idx = tableFile.indexEntetes;
    const feuille = tableFile.feuille;

    tableFile.lignes.forEach((ligne, i) => {
      const numeroLigne = i + 2; // +2 car en-têtes + index 0-based
      
      // Extraction sécurisée des données avec valeurs par défaut
      const {
        queue_id: idFile = '',
        cle_compte: cleCompte = '',
        pret_pour_plateforme: estPret = '',
        statut = '',
        planifie_pour_local: datePrevue,
        type_media: typeMedia = 'IMAGE',
        url_media: urlMedia = '',
        legende_finale: legende = ''
      } = ligne;

      // 1. Validations préliminaires (Guard Clauses)
      if (estPret.toLowerCase() !== 'oui') return;
      if (statut && statut.toLowerCase() !== 'en attente') return;
      if (estLigneVide_(ligne)) return;

      // 2. Vérification de l'horaire
      if (datePrevue instanceof Date) {
        const diffTemps = datePrevue.getTime() - maintenant.getTime();
        // Si prévu dans plus de 30 secondes, on attend
        if (diffTemps > 30000) {
          console.log(`Ligne ${numeroLigne} : Planifié dans le futur (${datePrevue}). Ignoré.`);
          return;
        }
      }

      console.log(`Traitement de la ligne ${numeroLigne} pour le compte ${cleCompte}`);
      journaliserAction_(cleCompte, idFile, 'traitementLigne', 'EN_COURS', '', '', '', '');

      // 3. Récupération du compte
      const compte = carteComptes[cleCompte.trim()];
      if (!compte) {
        marquerErreur_(feuille, numeroLigne, idx, "Compte introuvable ou inactif");
        return;
      }

      if (!urlMedia) {
        marquerErreur_(feuille, numeroLigne, idx, "URL du média manquante");
        return;
      }

      // Mise à jour du statut dans le Sheet
      if (idx.statut) feuille.getRange(numeroLigne, idx.statut).setValue('Publication en cours...');

      // 4. Exécution de la publication
      let resultat;
      try {
        if (typeMedia.toUpperCase() === 'VIDEO' || ligne.type_plateforme === 'IG_REEL') {
          resultat = publierVideo_(compte, urlMedia, legende, idFile);
        } else {
          resultat = publierImage_(compte, urlMedia, legende, idFile);
        }

        // 5. Gestion du résultat
        if (resultat && resultat.idMedia) {
          marquerSucces_(feuille, numeroLigne, idx, resultat);
          journaliserPublication_(ligne, resultat);
        } else {
          throw new Error(`Échec API: ${JSON.stringify(resultat)}`);
        }

      } catch (erreur) {
        const msgErreur = `Exception lors de la publication : ${erreur.message}`;
        console.error(msgErreur);
        marquerErreur_(feuille, numeroLigne, idx, msgErreur);
        journaliserAction_(cleCompte, idFile, 'traitementLigne', 'EXCEPTION', '', '', '', msgErreur);
      }
    });

  } catch (e) {
    console.error(`Erreur critique dans le répartiteur : ${e.toString()}`);
  }

  console.timeEnd('TraitementFileAttente');
  journaliserAction_('', '', 'traiterFileAttente', 'FIN', '', '', '', '');
}

// ==========================================
// LOGIQUE DE PUBLICATION (MÉTIER)
// ==========================================

/**
 * Publie une image sur Instagram.
 * @param {Object} compte - Objet contenant les tokens.
 * @param {string} urlImage - URL publique de l'image.
 * @param {string} legende - Texte du post.
 * @param {string} idFile - ID de suivi interne.
 * @return {Object} Résultat de la publication.
 */
function publierImage_(compte, urlImage, legende, idFile) {
  const endpoint = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/${compte.idBusinessIg}/media`;
  
  console.log(`Création conteneur IMAGE pour ${compte.cleCompte}`);

  // 1. Création du conteneur
  const reponse = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    payload: {
      image_url: urlImage,
      caption: legende,
      access_token: compte.tokenPage
    },
    muteHttpExceptions: true
  });

  const json = JSON.parse(reponse.getContentText());
  
  if (!json.id) {
    return { codeHttp: reponse.getResponseCode(), erreur: json };
  }

  // 2. Publication du conteneur
  return finaliserPublication_(compte, json.id, idFile);
}

/**
 * Publie une vidéo (Reel) sur Instagram.
 * @param {Object} compte 
 * @param {string} urlVideo 
 * @param {string} legende 
 * @param {string} idFile 
 */
function publierVideo_(compte, urlVideo, legende, idFile) {
  const endpoint = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/${compte.idBusinessIg}/media`;

  console.log(`Création conteneur REELS pour ${compte.cleCompte}`);

  // 1. Création du conteneur (Note: media_type: 'REELS')
  const reponse = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    payload: {
      media_type: 'REELS',
      video_url: urlVideo,
      caption: legende,
      access_token: compte.tokenPage
    },
    muteHttpExceptions: true
  });

  const json = JSON.parse(reponse.getContentText());

  if (!json.id) {
    return { codeHttp: reponse.getResponseCode(), erreur: json };
  }

  const idCreation = json.id;

  // 2. Attente du traitement (Polling)
  const statutTraitement = attendreTraitementMedia_(idCreation, compte);
  
  if (!statutTraitement.estPret) {
    return { 
      codeHttp: statutTraitement.codeHttp, 
      erreur: { message: "Délai d'attente dépassé ou erreur traitement", details: statutTraitement } 
    };
  }

  // 3. Publication finale
  return finaliserPublication_(compte, idCreation, idFile);
}

/**
 * Étape finale : publie le conteneur média créé.
 */
function finaliserPublication_(compte, idCreation, idFile) {
  const endpoint = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/${compte.idBusinessIg}/media_publish`;

  const reponse = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    payload: {
      creation_id: idCreation,
      access_token: compte.tokenPage
    },
    muteHttpExceptions: true
  });

  const json = JSON.parse(reponse.getContentText());

  if (!json.id) {
    return { codeHttp: reponse.getResponseCode(), erreur: json };
  }

  return {
    succes: true,
    idMedia: json.id,
    codeHttp: reponse.getResponseCode(),
    endpoint: endpoint
  };
}

/**
 * Vérifie périodiquement si la vidéo est prête à être publiée.
 */
function attendreTraitementMedia_(idCreation, compte) {
  const endpoint = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/${idCreation}?fields=status_code,status&access_token=${compte.tokenPage}`;
  
  for (let i = 0; i < CONFIGURATION.MAX_TENTATIVES; i++) {
    Utilities.sleep(CONFIGURATION.DELAI_SONDAGE_MS);
    
    const reponse = UrlFetchApp.fetch(endpoint, { muteHttpExceptions: true });
    const json = JSON.parse(reponse.getContentText());
    const codeStatut = json.status_code || json.status;

    console.log(`Sondage ${i+1}/${CONFIGURATION.MAX_TENTATIVES} pour ${idCreation}: ${codeStatut}`);

    if (codeStatut === 'FINISHED') return { estPret: true };
    if (codeStatut === 'ERROR' || codeStatut === 'FAILED') return { estPret: false, erreur: json };
  }

  return { estPret: false, erreur: 'TIMEOUT' };
}
