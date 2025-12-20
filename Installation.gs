/**
 * @fileoverview Script d'initialisation de l'environnement.
 * À exécuter une seule fois pour générer les onglets et les colonnes.
 */

/**
 * Configure entièrement le Google Sheet actif.
 * Crée les feuilles manquantes, ajoute les en-têtes et formate le tableau.
 */
function installerApplication() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  console.log('=== DÉBUT DE L\'INSTALLATION ===');

  // Définition de la structure exacte attendue par le code
  const structure = [
    {
      nom: CONFIGURATION.FEUILLES.COMPTES,
      couleurOnglet: '#4285F4', // Bleu Google
      colsLargeur: [100, 60, 150, 150, 120, 120, 120, 100, 150],
      entetes: [
        'Cle_Compte',        // A
        'Actif',             // B
        'Nom_Marque',        // C
        'Nom_Page_FB',       // D
        'ID_Page_FB',        // E
        'Identifiant_IG',    // F
        'ID_Business_IG',    // G
        'Token_Acces_Page',  // H
        'Expiration_Token_UTC' // I
      ]
    },
    {
      nom: CONFIGURATION.FEUILLES.FILE_ATTENTE,
      couleurOnglet: '#EA4335', // Rouge (Action)
      colsLargeur: [80, 100, 120, 100, 150, 80, 100, 250, 300, 200, 150],
      entetes: [
        'Queue_ID',              // A
        'Cle_Compte',            // B
        'Pret_Pour_Plateforme',  // C (Mettre 'Oui' pour poster)
        'Statut',                // D (Géré par le script)
        'Planifie_Pour_Local',   // E (Format: JJ/MM/AAAA HH:mm)
        'Type_Media',            // F (IMAGE ou VIDEO)
        'Type_Plateforme',       // G (IG_POST ou IG_REEL)
        'URL_Media',             // H
        'Legende_Finale',        // I
        'Derniere_Erreur',       // J
        'ID_Media_IG'            // K
      ]
    },
    {
      nom: CONFIGURATION.FEUILLES.JOURNAL,
      couleurOnglet: '#FBBC04', // Jaune (Logs)
      colsLargeur: [140, 100, 80, 150, 100, 80, 200, 200, 200],
      entetes: [
        'Horodatage', 'Compte', 'ID_File', 'Action', 
        'Statut', 'Code_HTTP', 'Endpoint', 'Payload', 'Reponse'
      ]
    },
    {
      nom: CONFIGURATION.FEUILLES.JOURNAL_POSTS,
      couleurOnglet: '#34A853', // Vert (Succès)
      colsLargeur: [140, 100, 80, 250, 200, 150],
      entetes: [
        'Date_Publication', 'Compte', 'Type', 'Legende', 'URL_Media', 'ID_Instagram'
      ]
    }
  ];

  // Boucle de création
  structure.forEach(config => {
    let feuille = ss.getSheetByName(config.nom);
    
    // Création si inexistante
    if (!feuille) {
      feuille = ss.insertSheet(config.nom);
      console.log(`Feuille créée : ${config.nom}`);
    } else {
      console.log(`La feuille ${config.nom} existe déjà. Vérification des en-têtes...`);
    }

    // Configuration visuelle
    try {
      feuille.setTabColor(config.couleurOnglet);
    } catch(e) {} // Ignore erreur couleur si non supporté

    // Si la feuille est vide, on injecte les en-têtes
    if (feuille.getLastRow() === 0) {
      const plageEntete = feuille.getRange(1, 1, 1, config.entetes.length);
      plageEntete.setValues([config.entetes]);
      
      // Style Professionnel
      plageEntete.setFontWeight('bold')
                 .setBackground('#EEEEEE')
                 .setBorder(true, true, true, true, false, false);
      
      feuille.setFrozenRows(1);
      
      // Ajustement largeurs
      config.colsLargeur.forEach((largeur, index) => {
        feuille.setColumnWidth(index + 1, largeur);
      });
    }
  });

  // Nettoyage : Suppression de "Feuille 1" ou "Sheet1" si elles sont vides et inutiles
  const feuillesVides = ['Feuille 1', 'Sheet1'];
  feuillesVides.forEach(nom => {
    const f = ss.getSheetByName(nom);
    if (f && f.getLastRow() === 0 && ss.getSheets().length > structure.length) {
      try {
        ss.deleteSheet(f);
        console.log(`Feuille vide par défaut '${nom}' supprimée.`);
      } catch (e) {
        console.log(`Impossible de supprimer ${nom} (c'est peut-être la dernière feuille active).`);
      }
    }
  });

  console.log('Installation terminée.');
  ui.alert('Succès', 'L\'installation est terminée !\nVos onglets sont prêts à être utilisés.', ui.ButtonSet.OK);
}
