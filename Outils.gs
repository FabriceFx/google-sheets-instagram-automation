// ==========================================
// AIDES : GESTION DES FEUILLES (SPREADSHEET)
// ==========================================

/**
 * Lit une feuille entière et retourne un objet structuré.
 * Rend le code résistant au changement d'ordre des colonnes.
 * @param {string} nomFeuille 
 */
function lireTableau_(nomFeuille) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const feuille = ss.getSheetByName(nomFeuille);
  
  if (!feuille) throw new Error(`La feuille "${nomFeuille}" est introuvable.`);

  const derniereLigne = feuille.getLastRow();
  const derniereCol = feuille.getLastColumn();

  if (derniereLigne < 2) return { feuille, lignes: [], indexEntetes: {} };

  const valeurs = feuille.getRange(1, 1, derniereLigne, derniereCol).getValues();
  const entetes = valeurs[0].map(h => String(h).trim().toLowerCase().replace(/ /g, '_')); // Normalisation des en-têtes
  const donnees = valeurs.slice(1);

  // Création d'un index des colonnes (ex: { 'statut': 5 }) pour écriture rapide
  const indexEntetes = {};
  entetes.forEach((h, i) => indexEntetes[h] = i + 1);

  // Conversion des lignes en objets
  const lignesObjets = donnees.map(ligne => {
    const obj = {};
    entetes.forEach((h, i) => {
      // Mapping des noms de colonnes francisés vers clés internes si nécessaire
      obj[h] = ligne[i];
    });
    return obj;
  });

  return {
    feuille: feuille,
    lignes: lignesObjets,
    indexEntetes: indexEntetes,
    entetesBruts: valeurs[0]
  };
}

/**
 * Construit une carte des comptes actifs pour un accès O(1).
 */
function construireCarteComptes_() {
  const table = lireTableau_(CONFIGURATION.FEUILLES.COMPTES);
  const carte = {};

  table.lignes.forEach(ligne => {
    const cle = String(ligne.cle_compte || '').trim();
    const actif = String(ligne.actif || '').toLowerCase();

    if (cle && actif === 'oui' && ligne.id_business_ig && ligne.token_acces_page) {
      carte[cle] = {
        cleCompte: cle,
        idBusinessIg: ligne.id_business_ig,
        tokenPage: ligne.token_acces_page,
        nomMarque: ligne.nom_marque
      };
    }
  });
  return carte;
}

// ==========================================
// AIDES : FEEDBACK VISUEL & LOGS
// ==========================================

function marquerSucces_(feuille, ligneIdx, idxCols, resultat) {
  const dateStr = new Date().toLocaleString('fr-FR');
  if (idxCols.statut) feuille.getRange(ligneIdx, idxCols.statut).setValue('Publié');
  if (idxCols.derniere_erreur) feuille.getRange(ligneIdx, idxCols.derniere_erreur).setValue('');
  if (idxCols.publie_le) feuille.getRange(ligneIdx, idxCols.publie_le).setValue(dateStr);
  if (idxCols.id_media_ig) feuille.getRange(ligneIdx, idxCols.id_media_ig).setValue(resultat.idMedia);
}

function marquerErreur_(feuille, ligneIdx, idxCols, message) {
  if (idxCols.statut) feuille.getRange(ligneIdx, idxCols.statut).setValue('Erreur');
  if (idxCols.derniere_erreur) feuille.getRange(ligneIdx, idxCols.derniere_erreur).setValue(message);
}

function estLigneVide_(ligneObj) {
  return !ligneObj.cle_compte && !ligneObj.url_media;
}

/**
 * Journalise les actions techniques.
 */
function journaliserAction_(compte, idFile, action, statut, codeHttp, endpoint, payload, reponse) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = ss.getSheetByName(CONFIGURATION.FEUILLES.JOURNAL);
  
  if (!feuille) {
    feuille = ss.insertSheet(CONFIGURATION.FEUILLES.JOURNAL);
    feuille.appendRow(['Horodatage', 'Compte', 'ID_File', 'Action', 'Statut', 'Code_HTTP', 'Endpoint', 'Payload', 'Réponse']);
  }

  feuille.appendRow([
    new Date(), compte, idFile, action, statut, codeHttp, endpoint, 
    String(payload).slice(0, 300), String(reponse).slice(0, 300)
  ]);
}

/**
 * Journal spécifique pour les posts réussis (plus lisible pour le client).
 */
function journaliserPublication_(ligneDonnees, resultat) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = ss.getSheetByName(CONFIGURATION.FEUILLES.JOURNAL_POSTS);

  if (!feuille) {
    feuille = ss.insertSheet(CONFIGURATION.FEUILLES.JOURNAL_POSTS);
    feuille.appendRow(['Date Publication', 'Compte', 'Type', 'Légende', 'URL Média', 'ID Instagram']);
  }

  feuille.appendRow([
    new Date(),
    ligneDonnees.cle_compte,
    ligneDonnees.type_media,
    ligneDonnees.legende_finale,
    ligneDonnees.url_media,
    resultat.idMedia
  ]);
}

// ==========================================
// AIDES : VALIDATION & CONVERSION URL
// ==========================================

/**
 * Convertit un lien Drive (View) en lien de téléchargement direct.
 * @param {string} url - L'URL brute.
 * @return {string} L'URL directe compatible API Meta.
 */
function convertirLienDriveEnDirect_(url) {
  if (!url) return '';
  const urlStr = String(url).trim();
  if (urlStr.includes('drive.google.com') || urlStr.includes('docs.google.com')) {
    const regexId = /[-\w]{25,}/;
    const match = urlStr.match(regexId);
    if (match && match[0]) {
      return `https://drive.google.com/uc?export=download&id=${match[0]}`;
    }
  }
  return urlStr;
}

/**
 * Vérifie si l'URL est accessible publiquement (Code 200).
 * Gère le cas des fichiers trop volumineux pour GAS (considérés comme existants).
 * @param {string} url - L'URL à tester.
 * @return {boolean} True si accessible, False sinon.
 */
function verifierAccessibiliteUrl_(url) {
  try {
    // On tente de récupérer juste les en-têtes ou le début pour ne pas charger tout le fichier
    // Note : UrlFetchApp ne supporte pas toujours bien HEAD, on fait un fetch standard
    const reponse = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true
    });
    
    const code = reponse.getResponseCode();
    if (code >= 200 && code < 300) return true;
    
    console.warn(`URL inaccessible (Code ${code}) : ${url}`);
    return false;

  } catch (e) {
    // Si l'erreur est "File too large", cela signifie que le fichier existe mais dépasse 50Mo (limite GAS).
    // Pour l'API Instagram, c'est bon signe (le fichier est là), donc on retourne true.
    if (e.message.includes("limit exceeded") || e.message.includes("trop volumineux")) {
      return true;
    }
    console.error(`Erreur vérification URL : ${e.message}`);
    return false;
  }
}
