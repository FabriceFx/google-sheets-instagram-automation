# Google Sheets Instagram Automation

![License MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Google%20Apps%20Script-green)
![Runtime](https://img.shields.io/badge/Google%20Apps%20Script-V8-green)
![Author](https://img.shields.io/badge/Auteur-Fabrice%20Faucheux-orange)

Une solution professionnelle et robuste pour automatiser la planification et la publication de contenus (Images et Reels) sur Instagram directement depuis Google Sheets, en utilisant Google Apps Script et l'API Graph de Meta.

## 📋 Fonctionnalités Clés

* **Multi-Comptes** : Gestion centralisée de plusieurs comptes Instagram Business.
* **Support Média Complet** : Publication automatisée d'**Images** et de **Reels** (Vidéos).
* **Planification Intelligente** : Algorithme de distribution automatique du contenu sur la semaine (Reels le matin/après-midi, Images le soir).
* **Surveillance des Jetons** : Vérification automatique de la validité des tokens Facebook/Instagram avec alertes email avant expiration.
* **Journalisation Détaillée** : Logs complets des actions techniques et journal dédié aux publications réussies pour le reporting client.
* **Gestion d'Erreurs** : Système de tentatives multiples (polling) pour le traitement vidéo et gestion des erreurs d'API.

## ⚙️ Prérequis

1.  Un compte **Google** avec accès à Google Sheets.
2.  Une **Application Facebook (Meta for Developers)** configurée avec les permissions suivantes :
    * `instagram_basic`
    * `instagram_content_publish`
    * `pages_show_list`
    * `pages_read_engagement`
3.  Un **Token Utilisateur Longue Durée** (User Long-Lived Token) généré via l'outil Graph API Explorer.

## 🚀 Installation

### 1. Mise en place du Script
1.  Créez un nouveau **Google Sheets**.
2.  Allez dans **Extensions** > **Apps Script**.
3.  Copiez les fichiers `.gs` du projet dans l'éditeur (respectez la structure des fichiers : `Code.gs`, `Installation.gs`, etc.).

### 2. Configuration des Propriétés du Script
Pour sécuriser votre jeton d'accès principal, ne le mettez pas en dur dans le code.
1.  Dans l'éditeur Apps Script, allez dans **Paramètres du projet** (roue dentée à gauche).
2.  Descendez tout en bas à **Propriétés du script**.
3.  Cliquez sur **Ajouter une propriété de script**.
    * **Propriété** : `FB_USER_LONG_LIVED_TOKEN`
    * **Valeur** : *Votre Token Utilisateur Longue Durée Meta*
4.  Cliquez sur **Enregistrer**.

### 3. Initialisation de la Feuille
1.  Sélectionnez la fonction `installerApplication` dans la liste des fonctions (fichier `Installation.gs`).
2.  Cliquez sur **Exécuter**.
3.  Acceptez les demandes d'autorisation Google.
    * *Résultat* : Le script va générer automatiquement les onglets nécessaires (`IG_Comptes`, `IG_File_Attente`, etc.) avec le formatage adéquat.

### 4. Synchronisation des Comptes
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

### Planification Automatique (Optionnel)
Si vous avez rempli la file d'attente sans mettre de dates, vous pouvez utiliser l'algorithme de planification :
1.  Exécutez la fonction `planifierSemaineSuivante`.
2.  Le script va remplir automatiquement les dates pour la semaine à venir (Images à 19h, Reels à 11h et 16h).

## 📂 Structure du Projet

* `Code.gs` : Cœur du système, gestion du trigger de publication et appels API de publication.
* `Installation.gs` : Script "One-shot" pour construire l'interface dans Google Sheets.
* `GestionJetons.gs` : Synchronisation des comptes Meta et surveillance des expirations.
* `Planification.gs` : Algorithme de distribution temporelle des posts.
* `Outils.gs` : Fonctions utilitaires (lecture de tableau, logs, helpers).


## 🆕 Nouveautés v2.1
* **Support Google Drive** : Vous pouvez désormais coller des liens de partage Drive (ex: `https://drive.google.com/file/d/.../view?usp=sharing`) directement dans la colonne URL. Le script les convertit automatiquement en liens de téléchargement direct pour l'API.
* **Vérification Pré-Publication** : Le script vérifie si l'URL est accessible publiquement (Code 200) avant de contacter Facebook, évitant les erreurs d'API inutiles.


## 📄 Licence

Distribué sous la licence MIT. Voir le fichier `LICENSE` pour plus d'informations.

Copyright (c) 2025 Fabrice Faucheux
