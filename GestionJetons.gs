/**
 * @fileoverview Gestion des jetons d'accès et synchronisation des comptes META.
 * Gère la récupération des pages via l'API Graph et les alertes d'expiration.
 */

// ==========================================
// CONFIGURATION SPÉCIFIQUE JETONS
// ==========================================

const CONFIG_JETONS = {
  PROPRIETE_TOKEN_USER: 'FB_USER_LONG_LIVED_TOKEN', // Nom de la propriété de script à définir
  SEUIL_ALERTE_JOURS: 7,
  EMAIL_ALERTE: '' // Laissez vide pour utiliser votre email Google actuel
};

// ==========================================
// FONCTIONS PRINCIPALES
// ==========================================

/**
 * 1. Synchronise les pages Facebook/Instagram vers l'onglet 'IG_Comptes'.
 * À lancer manuellement quand vous ajoutez un nouveau client/page.
 */
function synchroniserComptesInstagram() {
  console.log('=== DÉBUT SYNCHRONISATION COMPTES ===');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = ss.getSheetByName(CONFIGURATION.FEUILLES.COMPTES);

  // Création de la feuille si elle n'existe pas
  if (!feuille) {
    feuille = ss.insertSheet(CONFIGURATION.FEUILLES.COMPTES);
    // En-têtes normalisés pour fonctionner avec Outils.gs
    feuille.appendRow([
      'Cle_Compte', 
      'Actif', 
      'Nom_Marque', 
      'Nom_Page_FB', 
      'ID_Page_FB', 
      'Identifiant_IG', 
      'ID_Business_IG', 
      'Token_Acces_Page', 
      'Expiration_Token_UTC'
    ]);
  }

  // Récupération des données existantes pour ne pas écraser les clés manuelles
  const donneesActuelles = lireTableau_(CONFIGURATION.FEUILLES.COMPTES);
  const mapLignesExistantes = {}; // Map ID_Page_FB -> Index ligne
  
  donneesActuelles.lignes.forEach((ligne, i) => {
    if (ligne.id_page_fb) mapLignesExistantes[ligne.id_page_fb] = i + 2;
  });

  // Appel API Facebook pour récupérer les pages
  const pages = recupererPagesDepuisFacebook_();
  console.log(`${pages.length} pages trouvées via l'API.`);

  const lignesAecrire = [];
  
  // On prépare la structure des en-têtes pour l'écriture
  // Index: 0:Cle, 1:Actif, 2:Marque, 3:NomPage, 4:IdPage, 5:IdIG, 6:IdBiz, 7:Token, 8:Exp
  
  pages.forEach(page => {
    const idPageFb = page.id;
    const nomPageFb = page.name || '';
    const tokenPage = page.access_token || '';
    
    // Extraction ID Instagram Business
    const idBizIg = extraireIdBusinessIg_(page);
    
    // Récupération username IG (si possible)
    const usernameIg = (tokenPage && idBizIg) ? recupererUsernameIg_(idBizIg, tokenPage) : '';

    // Vérification expiration
    const infosDebug = tokenPage ? deboguerToken_(tokenPage) : null;
    const dateExpiration = infosDebug ? convertirEpochEnIso_(infosDebug.expires_at) : '';

    // Détermination de la ligne : Mise à jour ou Création
    let numeroLigne = mapLignesExistantes[idPageFb];
    
    if (numeroLigne) {
      // MISE À JOUR : On ne touche PAS à 'Cle_Compte', 'Actif', 'Nom_Marque' s'ils existent
      const plage = feuille.getRange(numeroLigne, 1, 1, 9);
      const valeursActuelles = plage.getValues()[0];
      
      valeursActuelles[3] = nomPageFb;       // Nom_Page_FB
      // valeursActuelles[4] = idPageFb;     // ID déjà bon
      valeursActuelles[5] = usernameIg;      // Identifiant_IG
      valeursActuelles[6] = idBizIg || '';   // ID_Business_IG
      valeursActuelles[7] = tokenPage;       // Token_Acces_Page
      valeursActuelles[8] = dateExpiration;  // Expiration
      
      // On réécrit la ligne mise à jour
      plage.setValues([valeursActuelles]);
      console.log(`Mise à jour page : ${nomPageFb}`);
      
    } else {
      // CRÉATION : Nouvelle ligne
      const nouvelleLigne = [
        '',             // Cle_Compte (A remplir manuellement)
        'Non',          // Actif (Par défaut Non)
        nomPageFb,      // Nom_Marque (Par défaut nom page)
        nomPageFb,      // Nom_Page_FB
        idPageFb,       // ID_Page_FB
        usernameIg,     // Identifiant_IG
        idBizIg || '',  // ID_Business_IG
        tokenPage,      // Token_Acces_Page
        dateExpiration  // Expiration_Token_UTC
      ];
      feuille.appendRow(nouvelleLigne);
      console.log(`Nouvelle page ajoutée : ${nomPageFb}`);
    }
  });
  
  console.log('=== FIN SYNCHRONISATION ===');
}

/**
 * 2. Vérifie les dates d'expiration et envoie une alerte email.
 * À mettre sur un déclencheur "Une fois par jour" ou "Hebdomadaire".
 */
function verifierExpirationJetonsEtNotifier() {
  const table = lireTableau_(CONFIGURATION.FEUILLES.COMPTES);
  const maintenant = new Date();
  const tokensExpirants = [];

  table.lignes.forEach(ligne => {
    const expirationBrute = ligne.expiration_token_utc;
    if (!expirationBrute) return;

    const dateExp = new Date(expirationBrute);
    if (isNaN(dateExp.getTime())) return;

    const diffMs = dateExp.getTime() - maintenant.getTime();
    const joursRestants = diffMs / (1000 * 60 * 60 * 24);

    if (joursRestants <= CONFIG_JETONS.SEUIL_ALERTE_JOURS) {
      tokensExpirants.push({
        marque: ligne.nom_marque || ligne.nom_page_fb,
        jours: joursRestants.toFixed(1),
        cle: ligne.cle_compte
      });
    }
  });

  if (tokensExpirants.length > 0) {
    envoyerEmailAlerte_(tokensExpirants);
  } else {
    console.log('Aucun token proche de l\'expiration.');
  }
}

// ==========================================
// OUTILS INTERNES (PRIVÉS)
// ==========================================

function recupererJetonUtilisateur_() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(CONFIG_JETONS.PROPRIETE_TOKEN_USER);
  if (!token) {
    throw new Error(`Propriété '${CONFIG_JETONS.PROPRIETE_TOKEN_USER}' introuvable dans les Propriétés du Script.`);
  }
  return token;
}

function recupererPagesDepuisFacebook_() {
  const userToken = recupererJetonUtilisateur_();
  // On demande les champs nécessaires : id, nom, access_token, et les objets business
  const url = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account,connected_instagram_account&access_token=${encodeURIComponent(userToken)}`;

  const reponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(reponse.getContentText());

  if (!json.data) {
    throw new Error('Erreur récupération pages : ' + reponse.getContentText());
  }
  return json.data;
}

function extraireIdBusinessIg_(pageObj) {
  if (pageObj.instagram_business_account && pageObj.instagram_business_account.id) {
    return pageObj.instagram_business_account.id;
  }
  if (pageObj.connected_instagram_account && pageObj.connected_instagram_account.id) {
    return pageObj.connected_instagram_account.id;
  }
  return null;
}

function recupererUsernameIg_(idBiz, tokenPage) {
  const url = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/${idBiz}?fields=username&access_token=${encodeURIComponent(tokenPage)}`;
  try {
    const reponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(reponse.getContentText());
    return json.username || '';
  } catch (e) {
    return '';
  }
}

function deboguerToken_(inputToken) {
  // Note: Pour debugger un token, on a besoin d'un App Access Token ou User Token valide.
  // Ici on utilise le User Token principal pour vérifier les Page Tokens.
  const userToken = recupererJetonUtilisateur_(); 
  const url = `https://graph.facebook.com/${CONFIGURATION.VERSION_GRAPH}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(userToken)}`;

  try {
    const reponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(reponse.getContentText());
    return json.data; // contient expires_at
  } catch (e) {
    console.warn('Erreur debug_token : ' + e.message);
    return null;
  }
}

function convertirEpochEnIso_(epochSeconds) {
  if (!epochSeconds) return '';
  // Si expiration = 0, c'est un token "never expire" (ex: User Token parfois, mais Page Token expire souvent)
  if (epochSeconds === 0) return 'JAMAIS'; 
  const d = new Date(epochSeconds * 1000);
  return d.toISOString();
}

function envoyerEmailAlerte_(listeExpirants) {
  const destinataire = CONFIG_JETONS.EMAIL_ALERTE || Session.getActiveUser().getEmail();
  const sujet = '[ALERTE] Tokens Instagram expirants';
  
  let corps = `Bonjour,\n\nAttention, les jetons pour les comptes suivants expirent bientôt (<= ${CONFIG_JETONS.SEUIL_ALERTE_JOURS} jours) :\n\n`;
  
  listeExpirants.forEach(item => {
    corps += `- ${item.marque} (Clé: ${item.cle}) : expire dans ${item.jours} jours\n`;
  });
  
  corps += `\nAction requise :\n1. Générez un nouveau User Token Longue Durée.\n2. Mettez à jour les propriétés du script.\n3. Lancez 'synchroniserComptesInstagram'.\n`;
  
  MailApp.sendEmail(destinataire, sujet, corps);
  console.log(`Alerte email envoyée à ${destinataire}`);
}
