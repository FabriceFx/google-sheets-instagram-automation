# Google Sheets Instagram Automation

![License MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Google%20Apps%20Script-green)
![Runtime](https://img.shields.io/badge/Google%20Apps%20Script-V8-green)
![Author](https://img.shields.io/badge/Auteur-Fabrice%20Faucheux-orange)

Une solution professionnelle et robuste pour automatiser la planification et la publication de contenus (Images et Reels) sur Instagram directement depuis Google Sheets, en utilisant Google Apps Script et l'API Graph de Meta.

## 📋 Fonctionnalités clés

* **Multi-comptes** : Gestion centralisée de plusieurs comptes Instagram Business.
* **Support média complet** : Publication automatisée d'**Images** et de **Reels** (Vidéos).
* **Planification intelligente** : Algorithme de distribution automatique du contenu sur la semaine (Reels le matin/après-midi, Images le soir).
* **Surveillance des jetons** : Vérification automatique de la validité des tokens Facebook/Instagram avec alertes email avant expiration.
* **Journalisation détaillée** : Logs complets des actions techniques et journal dédié aux publications réussies pour le reporting client.
* **Gestion d'erreurs** : Système de tentatives multiples (polling) pour le traitement vidéo et gestion des erreurs d'API.

## ⚙️ Prérequis

1.  Un compte **Google** avec accès à Google Sheets.
2.  Une **Application Facebook (Meta for Developers)** configurée avec les permissions suivantes :
    * `instagram_basic`
    * `instagram_content_publish`
    * `pages_show_list`
    * `pages_read_engagement`
3.  Un **Token Utilisateur Longue Durée** (User Long-Lived Token) généré via l'outil Graph API Explorer.

## 🚀 Installation

### 1. Mise en place du script
1.  Créez un nouveau **Google Sheets**.
2.  Allez dans **Extensions** > **Apps Script**.
3.  Copiez les fichiers `.gs` du projet dans l'éditeur (respectez la structure des fichiers : `Code.gs`, `Installation.gs`, etc.).

### 2. Configuration des propriétés du script
Pour sécuriser votre jeton d'accès principal, ne le mettez pas en dur dans le code.
1.  Dans l'éditeur Apps Script, allez dans **Paramètres du projet** (roue dentée à gauche).
2.  Descendez tout en bas à **Propriétés du script**.
3.  Cliquez sur **Ajouter une propriété de script**.
    * **Propriété** : `FB_USER_LONG_LIVED_TOKEN`
    * **Valeur** : *Votre Token Utilisateur Longue Durée Meta*
4.  Cliquez sur **Enregistrer**.

### 3. Initialisation de la feuille
1.  Sélectionnez la fonction `installerApplication` dans la liste des fonctions (fichier `Installation.gs`).
2.  Cliquez sur **Exécuter**.
3.  Acceptez les demandes d'autorisation Google.
    * *Résultat* : Le script va générer automatiquement les onglets nécessaires (`IG_Comptes`, `IG_File_Attente`, etc.) avec le formatage adéquat.

### 4. Synchronisation des comptes
1.  Une fois l'installation terminée, exécutez la fonction `synchroniserComptesInstagram` (fichier `GestionJetons.gs`).
    * *Résultat* : L'onglet `IG_Comptes` se remplit avec vos pages Facebook et comptes Instagram liés.
2.  Dans l'onglet `IG_Comptes`, colonne **Cle_Compte** (Col A), attribuez un identifiant unique à chaque compte (ex: `CLIENT_A`, `MA_MARQUE`).
3.  Passez la colonne **Actif** (Col B) à `Oui` pour les comptes à utiliser.

## ⏰ Automatisation (Déclencheurs)

Pour que le système fonctionne sans intervention, configurez les déclencheurs (Triggers) via le menu "Déclencheurs" (icône réveil) à gauche :

| Fonction | Type de déclencheur | Fréquence recommandée | Description |
| :--- | :--- | :--- | :--- |
| `traiterFileAttenteInstagram` | Basé sur le temps | Toutes les 10 ou 15 minutes | Scanne la file et publie les posts prêts. |
| `verifierExpirationJetonsEtNotifier` | Basé sur le temps | Une fois par jour | Vérifie si vos tokens vont expirer. |

## 📖 Utilisation

### Ajouter du contenu
Remplissez l'onglet `IG_File_Attente` :

1.  **Cle_Compte** : L'identifiant défini dans `IG_Comptes`.
2.  **Pret_Pour_Plateforme** : Mettez `Non` tant que vous rédigez, `Oui` quand c'est prêt.
3.  **Planifie_Pour_Local** : Date et heure de publication souhaitée (JJ/MM/AAAA HH:mm).
4.  **Type_Media** : `IMAGE` ou `VIDEO`.
5.  **URL_Media** : Lien public direct vers le fichier (Google Drive, Dropbox, etc. *Le lien doit être accessible publiquement par les serveurs de Facebook*).
6.  **Legende_Finale** : Le texte de votre post.

### Planification automatique (Optionnel)
Si vous avez rempli la file d'attente sans mettre de dates, vous pouvez utiliser l'algorithme de planification :
1.  Exécutez la fonction `planifierSemaineSuivante`.
2.  Le script va remplir automatiquement les dates pour la semaine à venir (Images à 19h, Reels à 11h et 16h).

## 📂 Structure du projet

* `Code.gs` : Cœur du système, gestion du trigger de publication et appels API de publication.
* `Installation.gs` : Script "One-shot" pour construire l'interface dans Google Sheets.
* `GestionJetons.gs` : Synchronisation des comptes Meta et surveillance des expirations.
* `Planification.gs` : Algorithme de distribution temporelle des posts.
* `Outils.gs` : Fonctions utilitaires (lecture de tableau, logs, helpers).


## 🔐 Configuration 

La sécurité repose sur un **Jeton Utilisateur Longue Durée** (valide 60 jours). Suivez ces étapes scrupuleusement.

### Étape A : Obtenir le jeton via Graph API Explorer
1.  Rendez-vous sur [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2.  Sélectionnez votre Application dans le menu "Meta App".
3.  Dans la section **Permissions**, ajoutez :
    * `pages_show_list`
    * `pages_read_engagement`
    * `instagram_basic`
    * `instagram_content_publish`
4.  Cliquez sur **Generate Access Token** et validez les popups.
    * *Note : Ce jeton ne dure que 1 heure. Ne l'utilisez pas encore.*

### Étape B : Convertir en jeton Longue Durée (60 jours)
1.  Cliquez sur l'icône **"i" (Info)** bleue à côté du jeton généré.
2.  Cliquez sur **Open in Access Token Tool**.
3.  En bas de la page qui s'ouvre, cliquez sur le bouton bleu **Extend Access Token**.
4.  Copiez le **nouveau jeton** qui apparaît (c'est le jeton longue durée).

### Étape C : Sécuriser le jeton dans Apps Script
1.  Dans l'éditeur Apps Script, ouvrez les **Paramètres du projet** (roue dentée ⚙️ à gauche).
2.  Section **Propriétés de script**, cliquez sur **Ajouter une propriété**.
3.  Nom : `FB_USER_LONG_LIVED_TOKEN`
4.  Valeur : *Collez votre jeton longue durée ici*.
5.  Cliquez sur **Enregistrer**.

### Étape D : Synchronisation
1.  Lancez la fonction `synchroniserComptesInstagram` (fichier `GestionJetons.gs`).
2.  Allez dans l'onglet `IG_Comptes` : vos pages sont là !
3.  Remplissez la colonne **Cle_Compte** (ex: `CLIENT1`) et mettez **Actif** sur `Oui`.

---


## 📄 Licence

Distribué sous la licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

Copyright (c) 2025 Fabrice Faucheux
